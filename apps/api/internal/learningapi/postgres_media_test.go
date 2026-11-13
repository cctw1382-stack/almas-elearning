package learningapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresMedia(t *testing.T) {
	dsn := os.Getenv("ALMAS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires PostgreSQL media fixtures")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal("could not configure fixture pool")
	}
	defer pool.Close()
	const school = "00000000-0000-4000-8000-000000000011"
	const asset = "00000000-0000-4000-8000-000000000070"
	identity := VerifiedIdentity{Issuer: "https://issuer-a.example.invalid", Subject: "shared-subject"}
	object, err := resolvePostgresMedia(ctx, pool, identity, school, asset)
	if err != nil || object.Key != "school-a/fixture.mp4" {
		t.Fatalf("expected enrolled media: %v", err)
	}
	for _, denied := range []struct {
		school   string
		identity VerifiedIdentity
	}{
		{school, VerifiedIdentity{Issuer: identity.Issuer, Subject: "attempt-subject"}},
		{school, VerifiedIdentity{Issuer: "https://issuer-b.example.invalid", Subject: identity.Subject}},
		{"00000000-0000-4000-8000-000000000012", identity},
	} {
		if _, err := resolvePostgresMedia(ctx, pool, denied.identity, denied.school, asset); !errors.Is(err, ErrMediaUnavailable) {
			t.Fatalf("unexpected cross-scope lookup result: %v", err)
		}
	}
	tx, err := beginIdentityRead(ctx, pool, identity)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	var count int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM almas.media_assets`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("RLS should hide the matching asset in the other school: count=%d error=%v", count, err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	position := 17000
	if saved, err := postgresMediaProgress(ctx, pool, identity, school, asset, &position); err != nil || saved != position {
		t.Fatalf("save progress: %d %v", saved, err)
	}
	if saved, err := postgresMediaProgress(ctx, pool, identity, school, asset, nil); err != nil || saved != position {
		t.Fatalf("restore progress: %d %v", saved, err)
	}
	second := VerifiedIdentity{Issuer: identity.Issuer, Subject: "second-viewer"}
	if saved, err := postgresMediaProgress(ctx, pool, second, school, asset, nil); err != nil || saved != 0 {
		t.Fatalf("another learner must see only their progress: %d %v", saved, err)
	}
	video := []byte{0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm', 0, 0, 0, 0, 'i', 's', 'o', 'm', 'm', 'p', '4', '2'}
	writes := 0
	for _, tc := range []struct {
		name   string
		actor  VerifiedIdentity
		status int
	}{
		{"lesson owner", identity, http.StatusCreated},
		{"enrolled student", second, http.StatusNotFound},
		{"teacher from another school", VerifiedIdentity{Issuer: "https://issuer-b.example.invalid", Subject: "foreign-media-teacher"}, http.StatusNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			handler := NewPostgresMediaIngestHandler(pool, int64(len(video)),
				func(_ context.Context, input *openapi3filter.AuthenticationInput) error {
					request := input.RequestValidationInput.Request
					*request = *request.WithContext(context.WithValue(request.Context(), identityContextKey{}, tc.actor))
					return nil
				},
				func(_ context.Context, _, dir string) error {
					if err := os.WriteFile(filepath.Join(dir, "segment-0.ts"), []byte("fixture segment"), 0600); err != nil {
						return err
					}
					return os.WriteFile(filepath.Join(dir, "index.m3u8"), []byte("#EXTM3U\n#EXTINF:1,\nsegment-0.ts\n#EXT-X-ENDLIST\n"), 0600)
				},
				func(_ context.Context, _ string, source io.Reader) error {
					writes++
					_, err := io.Copy(io.Discard, source)
					return err
				})
			request := httptest.NewRequest(http.MethodPost, "/api/v1/schools/"+school+"/lessons/00000000-0000-4000-8000-000000000071/media", bytes.NewReader(video))
			request.Header.Set("Content-Type", "video/mp4")
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != tc.status {
				t.Fatalf("upload status %d, expected %d", response.Code, tc.status)
			}
			if tc.status == http.StatusCreated {
				var created struct {
					UploadID string `json:"uploadId"`
				}
				if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil {
					t.Fatal(err)
				}
				id := strings.TrimSuffix(filepath.Base(created.UploadID), ".mp4")
				object, err := resolvePostgresMedia(ctx, pool, second, school, id)
				if err != nil || object.Key != created.UploadID+"/index.m3u8" ||
					object.ContentType != "application/vnd.apple.mpegurl" {
					t.Fatalf("published rendition unavailable to enrolled student: %v", err)
				}
			}
		})
	}
	if writes != 2 {
		t.Fatalf("expected only the authorized segment and playlist writes, got %d", writes)
	}
}
