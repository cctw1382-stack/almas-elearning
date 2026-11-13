package learningapi

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/getkin/kin-openapi/openapi3filter"
)

func TestMediaLinks(t *testing.T) {
	const school = "00000000-0000-4000-8000-000000000011"
	const asset = "00000000-0000-4000-8000-000000000070"
	now := time.Unix(2000000000, 0)
	enrolled := true
	object := MediaObject{Key: "sample.mp4", ContentType: "video/mp4"}
	resolve := func(_ context.Context, identity VerifiedIdentity, schoolID, assetID string) (MediaObject, error) {
		if !enrolled || schoolID != school || assetID != asset || identity.Subject != "student" {
			return MediaObject{}, ErrMediaUnavailable
		}
		return object, nil
	}
	handler, err := NewMediaHandler(bytes.Repeat([]byte{42}, 32), time.Minute, func() time.Time { return now },
		func(_ context.Context, input *openapi3filter.AuthenticationInput) error {
			r := input.RequestValidationInput.Request
			subject := r.Header.Get("Authorization")
			if subject == "" {
				return ErrMediaUnavailable
			}
			*r = *r.WithContext(context.WithValue(r.Context(), identityContextKey{}, VerifiedIdentity{
				Issuer: "https://fixture.invalid", Subject: subject,
			}))
			return nil
		}, resolve, func(_ context.Context, object MediaObject) (MediaReader, error) {
			if object.ContentType == "application/vnd.apple.mpegurl" {
				return mediaTestReader{bytes.NewReader([]byte("#EXTM3U\n#EXTINF:1,\nsegment-1.ts\n#EXT-X-ENDLIST\n"))}, nil
			}
			return mediaTestReader{bytes.NewReader([]byte("fixture video"))}, nil
		}, nil)
	if err != nil {
		t.Fatal(err)
	}
	call := func(method, path, user string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, nil)
		r.Header.Set("Authorization", user)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	issue := "/api/v1/schools/" + school + "/media/" + asset + "/link"
	issued := call(http.MethodPost, issue, "student")
	link := issued.Header().Get("Location")
	if issued.Code != http.StatusCreated || link == "" {
		t.Fatalf("issue link: %d", issued.Code)
	}
	if got := call(http.MethodGet, link, "student"); got.Code != http.StatusOK || got.Body.String() != "fixture video" {
		t.Fatalf("authorized playback: %d", got.Code)
	}
	if got := call(http.MethodGet, link, "outsider"); got.Code != http.StatusNotFound {
		t.Fatalf("shared link accepted: %d", got.Code)
	}
	if got := call(http.MethodGet, link, ""); got.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous link accepted: %d", got.Code)
	}
	if got := call(http.MethodPost, issue, "outsider"); got.Code != http.StatusNotFound {
		t.Fatalf("unregistered student got a link: %d", got.Code)
	}
	foreign := "00000000-0000-4000-8000-000000000012"
	if got := call(http.MethodPost, strings.Replace(issue, school, foreign, 1), "student"); got.Code != http.StatusNotFound {
		t.Fatalf("foreign school issued a link: %d", got.Code)
	}
	if got := call(http.MethodGet, strings.Replace(link, school, foreign, 1), "student"); got.Code != http.StatusNotFound {
		t.Fatalf("changed school accepted: %d", got.Code)
	}
	tampered, err := url.Parse(link)
	if err != nil {
		t.Fatal(err)
	}
	query := tampered.Query()
	query.Set("sig", "not-the-signature")
	tampered.RawQuery = query.Encode()
	if got := call(http.MethodGet, tampered.String(), "student"); got.Code != http.StatusNotFound {
		t.Fatalf("modified signature accepted: %d", got.Code)
	}
	enrolled = false
	if got := call(http.MethodGet, link, "student"); got.Code != http.StatusNotFound {
		t.Fatalf("revoked enrollment accepted: %d", got.Code)
	}
	enrolled = true
	object = MediaObject{Key: "playlist.m3u8", ContentType: "application/vnd.apple.mpegurl"}
	playlist := call(http.MethodGet, link, "student")
	segment := link + "&segment=segment-1.ts"
	if playlist.Code != http.StatusOK || !strings.Contains(playlist.Body.String(), segment) {
		t.Fatalf("playlist did not preserve the signed URL: %d", playlist.Code)
	}
	if got := call(http.MethodGet, segment, "student"); got.Code != http.StatusOK {
		t.Fatalf("authorized segment: %d", got.Code)
	}
	if got := call(http.MethodGet, segment, "outsider"); got.Code != http.StatusNotFound {
		t.Fatalf("shared segment accepted: %d", got.Code)
	}
	if got := call(http.MethodGet, link+"&segment=..%2Fprivate.ts", "student"); got.Code != http.StatusNotFound {
		t.Fatalf("invalid segment accepted: %d", got.Code)
	}
	now = now.Add(time.Minute)
	if got := call(http.MethodGet, segment, "student"); got.Code != http.StatusNotFound {
		t.Fatalf("expired segment accepted: %d", got.Code)
	}
	if got := call(http.MethodGet, link, "student"); got.Code != http.StatusNotFound {
		t.Fatalf("expired link accepted: %d", got.Code)
	}
}

type mediaTestReader struct{ *bytes.Reader }

func (mediaTestReader) Close() error { return nil }
