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

func NewPostgresMediaUploadHandler(pool *pgxpool.Pool, limit int64, authenticate openapi3filter.AuthenticationFunc, store StoreUpload) http.Handler {
	return NewMediaUploadHandler(limit, authenticate, func(ctx context.Context, actor VerifiedIdentity, school, lesson string) error {
		tx, err := beginIdentityRead(ctx, pool, actor)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)
		var owner string
		err = tx.QueryRow(ctx, `
			SELECT o.teacher_id::text FROM almas.lesson_owners AS o
			JOIN almas.users AS u ON u.id = o.teacher_id
			WHERE o.school_id = $1::uuid AND o.lesson_id = $2::uuid AND u.issuer = $3 AND u.subject = $4`,
			school, lesson, actor.Issuer, actor.Subject).Scan(&owner)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrMediaUnavailable
		}
		return err
	}, store)
}

// NewPostgresMediaHandler supplies the lesson-enrollment policy for the playback routes.
func NewPostgresMediaHandler(pool *pgxpool.Pool, key []byte, ttl time.Duration, authenticate openapi3filter.AuthenticationFunc, open OpenMedia) (http.Handler, error) {
	if pool == nil {
		return nil, errors.New("media handler requires PostgreSQL")
	}
	return NewMediaHandler(key, ttl, time.Now, authenticate, func(ctx context.Context, identity VerifiedIdentity, school, asset string) (MediaObject, error) {
		return resolvePostgresMedia(ctx, pool, identity, school, asset)
	}, open, func(ctx context.Context, identity VerifiedIdentity, school, asset string, position *int) (int, error) {
		return postgresMediaProgress(ctx, pool, identity, school, asset, position)
	})
}

func postgresMediaProgress(ctx context.Context, pool *pgxpool.Pool, identity VerifiedIdentity, school, asset string, position *int) (int, error) {
	access := pgx.ReadOnly
	if position != nil {
		access = pgx.ReadWrite
	}
	tx, err := beginIdentityTx(ctx, pool, identity, access)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	var user string
	err = tx.QueryRow(ctx, `
		SELECT u.id::text FROM almas.media_assets AS a
		JOIN almas.lesson_enrollments AS e USING (school_id, lesson_id)
		JOIN almas.users AS u ON u.id = e.user_id
		WHERE a.school_id = $1::uuid AND a.id = $2::uuid AND u.issuer = $3 AND u.subject = $4`,
		school, asset, identity.Issuer, identity.Subject).Scan(&user)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrMediaUnavailable
	}
	if err != nil {
		return 0, err
	}
	var saved int
	if position == nil {
		err = tx.QueryRow(ctx, `
			SELECT COALESCE((SELECT position_ms FROM almas.media_progress
			WHERE school_id = $1::uuid AND asset_id = $2::uuid AND user_id = $3::uuid), 0)`,
			school, asset, user).Scan(&saved)
	} else {
		err = tx.QueryRow(ctx, `
			INSERT INTO almas.media_progress (school_id, asset_id, user_id, position_ms)
			VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
			ON CONFLICT (school_id, asset_id, user_id) DO UPDATE SET position_ms = EXCLUDED.position_ms
			RETURNING position_ms`, school, asset, user, *position).Scan(&saved)
	}
	if err != nil {
		return 0, err
	}
	return saved, tx.Commit(ctx)
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
