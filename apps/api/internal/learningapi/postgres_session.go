package learningapi

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresSessions resolves verified identities and their school memberships.
type PostgresSessions struct {
	pool *pgxpool.Pool
}

func NewPostgresSessions(pool *pgxpool.Pool) *PostgresSessions {
	return &PostgresSessions{pool: pool}
}

func beginIdentityRead(ctx context.Context, pool *pgxpool.Pool, identity VerifiedIdentity) (pgx.Tx, error) {
	return beginIdentityTx(ctx, pool, identity, pgx.ReadOnly)
}

func beginIdentityTx(ctx context.Context, pool *pgxpool.Pool, identity VerifiedIdentity, access pgx.TxAccessMode) (pgx.Tx, error) {
	tx, err := pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted, AccessMode: access})
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `SELECT set_config('almas.issuer', $1, true), set_config('almas.subject', $2, true)`,
		identity.Issuer, identity.Subject)
	if err != nil {
		_ = tx.Rollback(ctx)
		return nil, err
	}
	return tx, nil
}

func (s *PostgresSessions) GetSession(ctx context.Context, _ GetSessionRequestObject) (GetSessionResponseObject, error) {
	identity, ok := IdentityFromContext(ctx)
	if !ok {
		problem := Error{Code: Unauthenticated, Message: "تعذر التحقق من الهوية.", RequestId: uuid.NewString()}
		return GetSession401JSONResponse{ErrorJSONResponse: ErrorJSONResponse(problem)}, nil
	}
	tx, err := beginIdentityRead(ctx, s.pool, identity)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	type sessionRow struct {
		UserID   string
		SchoolID *string
		Role     *string
	}
	rows, err := tx.Query(ctx, `
		SELECT u.id::text, m.school_id::text, m.role
		FROM almas.users AS u
		LEFT JOIN almas.school_memberships AS m ON m.user_id = u.id
		WHERE u.issuer = $1 AND u.subject = $2
		ORDER BY m.school_id, m.role
		LIMIT 401`, identity.Issuer, identity.Subject)
	if err != nil {
		return nil, err
	}
	records, err := pgx.CollectRows(rows, pgx.RowToStructByPos[sessionRow])
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return GetSession404JSONResponse{Code: NotFound, Message: "الحساب غير موجود.", RequestId: uuid.NewString()}, nil
	}
	if len(records) > 400 {
		return nil, errors.New("school memberships exceed the session contract")
	}
	memberships := make([]Membership, 0)
	for _, row := range records {
		if row.SchoolID == nil {
			continue
		}
		if len(memberships) == 0 || memberships[len(memberships)-1].SchoolId != *row.SchoolID {
			memberships = append(memberships, Membership{SchoolId: *row.SchoolID})
		}
		membership := &memberships[len(memberships)-1]
		membership.Roles = append(membership.Roles, MembershipRoles(*row.Role))
	}
	if len(memberships) > 100 {
		return nil, errors.New("schools exceed the session contract")
	}
	return GetSession200JSONResponse{
		UserId: records[0].UserID, Memberships: memberships, ServerTime: time.Now().UnixMilli(),
	}, nil
}
