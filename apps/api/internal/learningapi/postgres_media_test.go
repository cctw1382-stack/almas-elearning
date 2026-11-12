package learningapi

import (
	"context"
	"errors"
	"os"
	"testing"

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
}
