package learningapi

import (
	"context"
	"errors"
	"net/http"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type postgresLearning struct {
	*PostgresSessions
	*PostgresExams
	*PostgresAttempts
	pool *pgxpool.Pool
}

func NewPostgresLearningHandler(pool *pgxpool.Pool, authenticate openapi3filter.AuthenticationFunc) (http.Handler, error) {
	return NewValidatedHandler(postgresLearning{
		PostgresSessions: NewPostgresSessions(pool),
		PostgresExams:    NewPostgresExams(pool),
		PostgresAttempts: NewPostgresAttempts(pool),
		pool:             pool,
	}, authenticate)
}

func (s postgresLearning) GetGuardianChild(ctx context.Context, request GetGuardianChildRequestObject) (GetGuardianChildResponseObject, error) {
	identity, ok := IdentityFromContext(ctx)
	if !ok {
		return GetGuardianChild401JSONResponse{ErrorJSONResponse(Error{
			Code: Unauthenticated, Message: "تعذر التحقق من الهوية.", RequestId: uuid.NewString(),
		})}, nil
	}
	tx, err := beginIdentityRead(ctx, s.pool, identity)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	var child GuardianChild
	err = tx.QueryRow(ctx, `
		SELECT l.school_id::text, l.child_id::text FROM almas.guardian_links AS l
		JOIN almas.users AS u ON u.id = l.guardian_id
		WHERE l.school_id = $1::uuid AND l.child_id = $2::uuid AND u.issuer = $3 AND u.subject = $4`,
		request.SchoolId, request.ChildId, identity.Issuer, identity.Subject).
		Scan(&child.SchoolId, &child.ChildId)
	if errors.Is(err, pgx.ErrNoRows) {
		return GetGuardianChild404JSONResponse(Error{
			Code: NotFound, Message: "الطفل غير متاح.", RequestId: uuid.NewString(),
		}), nil
	}
	if err != nil {
		return nil, err
	}
	return GetGuardianChild200JSONResponse(child), nil
}
