package learningapi

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPostgresMediaHandler supplies the lesson-enrollment policy for the playback routes.
func NewPostgresMediaHandler(pool *pgxpool.Pool, key []byte, ttl time.Duration, authenticate openapi3filter.AuthenticationFunc, open OpenMedia) (http.Handler, error) {
	if pool == nil {
		return nil, errors.New("media handler requires PostgreSQL")
	}
	return NewMediaHandler(key, ttl, time.Now, authenticate, func(ctx context.Context, identity VerifiedIdentity, school, asset string) (MediaObject, error) {
		return resolvePostgresMedia(ctx, pool, identity, school, asset)
	}, open)
}

func resolvePostgresMedia(ctx context.Context, pool *pgxpool.Pool, identity VerifiedIdentity, school, asset string) (MediaObject, error) {
	tx, err := beginIdentityRead(ctx, pool, identity)
	if err != nil {
		return MediaObject{}, err
	}
	defer tx.Rollback(ctx)
	var object MediaObject
	err = tx.QueryRow(ctx, `
		SELECT a.object_key, a.content_type FROM almas.media_assets AS a
		JOIN almas.lesson_enrollments AS e USING (school_id, lesson_id)
		JOIN almas.users AS u ON u.id = e.user_id
		WHERE a.school_id = $1::uuid AND a.id = $2::uuid AND u.issuer = $3 AND u.subject = $4`,
		school, asset, identity.Issuer, identity.Subject).Scan(&object.Key, &object.ContentType)
	if errors.Is(err, pgx.ErrNoRows) {
		return MediaObject{}, ErrMediaUnavailable
	}
	return object, err
}
