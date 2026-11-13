package learningapi

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type attemptScope struct {
	school, exam, user string
}

func (s *PostgresAttempts) beginWrite(ctx context.Context, identity VerifiedIdentity) (pgx.Tx, string, error) {
	tx, err := beginIdentityTx(ctx, s.pool, identity, pgx.ReadWrite)
	if err != nil {
		return nil, "", err
	}
	var user string
	err = tx.QueryRow(ctx, `SELECT id::text FROM almas.users WHERE issuer = $1 AND subject = $2`, identity.Issuer, identity.Subject).Scan(&user)
	if err == nil {
		// Both operations share the same per-user lock and key namespace.
		_, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 73019))`, user)
	}
	if err != nil {
		_ = tx.Rollback(ctx)
		return nil, "", err
	}
	return tx, user, nil
}

func databaseNow(ctx context.Context, tx pgx.Tx) (time.Time, error) {
	var now time.Time
	err := tx.QueryRow(ctx, `SELECT date_trunc('milliseconds', clock_timestamp())`).Scan(&now)
	return now, err
}

type attemptReceipt struct {
	sameScope, created                bool
	operation, fingerprint, attemptID string
	recordedAt, deadline              time.Time
	response                          []byte
}

func findAttemptReceipt(ctx context.Context, tx pgx.Tx, scope attemptScope, key string) (attemptReceipt, error) {
	var receipt attemptReceipt
	err := tx.QueryRow(ctx, `
		SELECT k.school_id = $3::uuid AND k.exam_id = $4::uuid, k.created,
		       k.operation, k.fingerprint, a.id::text, k.server_time, a.deadline, k.response
		FROM almas.exam_write_keys AS k
		JOIN almas.exam_attempts AS a USING (school_id, exam_id, user_id)
		WHERE k.user_id = $1::uuid AND k.key = $2::uuid`, scope.user, key, scope.school, scope.exam).
		Scan(&receipt.sameScope, &receipt.created, &receipt.operation, &receipt.fingerprint, &receipt.attemptID,
			&receipt.recordedAt, &receipt.deadline, &receipt.response)
	return receipt, err
}

func (receipt attemptReceipt) matches(operation, fingerprint string, now time.Time) bool {
	return receipt.sameScope && receipt.operation == operation && receipt.fingerprint == fingerprint &&
		now.Sub(receipt.recordedAt) < 24*time.Hour
}

func (receipt attemptReceipt) active(examID string) (ActiveAttempt, error) {
	if receipt.response == nil {
		// Rows from migration 0003 predate answer writes and carried revision zero.
		return ActiveAttempt{Id: receipt.attemptID, ExamId: examID, Status: Active,
			Deadline: receipt.deadline.UnixMilli(), ServerTime: receipt.recordedAt.UnixMilli(), Answers: []SavedAnswer{}}, nil
	}
	var active ActiveAttempt
	err := json.Unmarshal(receipt.response, &active)
	return active, err
}

var errAttemptKeyConflict = errors.New("attempt write key conflict")

func attemptKeyConflict() Error {
	return Error{Code: IdempotencyConflict, Message: "مفتاح الطلب مستخدم أو منتهي.", RequestId: uuid.NewString()}
}

func recordAttemptReceipt(ctx context.Context, tx pgx.Tx, scope attemptScope, key, operation, fingerprint string, created bool, now time.Time, response any) error {
	body, err := json.Marshal(response)
	if err != nil {
		return err
	}
	result, err := tx.Exec(ctx, `
		INSERT INTO almas.exam_write_keys (user_id, key, school_id, exam_id, operation, fingerprint, created, server_time, response)
		VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9::jsonb)
		ON CONFLICT (user_id, key) DO NOTHING`, scope.user, key, scope.school, scope.exam, operation, fingerprint, created, now, body)
	if err == nil && result.RowsAffected() == 0 {
		return errAttemptKeyConflict
	}
	return err
}

func loadAttemptAnswers(ctx context.Context, tx pgx.Tx, scope attemptScope) ([]SavedAnswer, error) {
	rows, err := tx.Query(ctx, `
		SELECT question_id::text, option_id::text FROM almas.exam_answers
		WHERE school_id = $1::uuid AND exam_id = $2::uuid AND user_id = $3::uuid ORDER BY question_id`,
		scope.school, scope.exam, scope.user)
	if err != nil {
		return nil, err
	}
	return pgx.AppendRows([]SavedAnswer{}, rows, func(row pgx.CollectableRow) (SavedAnswer, error) {
		var answer SavedAnswer
		err := row.Scan(&answer.QuestionId, &answer.OptionId)
		return answer, err
	})
}
