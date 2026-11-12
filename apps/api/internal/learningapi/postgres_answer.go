package learningapi

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *PostgresAttempts) SaveAnswer(ctx context.Context, request SaveAnswerRequestObject) (SaveAnswerResponseObject, error) {
	identity, ok := IdentityFromContext(ctx)
	if !ok {
		return SaveAnswer401JSONResponse(Error{Code: Unauthenticated, Message: "تعذر التحقق من الهوية.", RequestId: uuid.NewString()}), nil
	}
	if request.Body == nil {
		return answerInvalid(), nil
	}
	tx, user, err := s.beginWrite(ctx, identity)
	if errors.Is(err, pgx.ErrNoRows) {
		return answerNotFound(), nil
	}
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var active ActiveAttempt
	var deadline time.Time
	var closedAt *time.Time
	var frozen []byte
	err = tx.QueryRow(ctx, `
		SELECT a.id::text, a.exam_id::text, a.deadline, a.closed_at, a.revision, a.public_exam
		FROM almas.exam_attempts AS a
		JOIN almas.exams AS e ON e.school_id = a.school_id AND e.id = a.exam_id
		WHERE a.school_id = $1::uuid AND a.id = $2::uuid AND a.user_id = $3::uuid
		FOR UPDATE OF a`, request.SchoolId, request.AttemptId, user).
		Scan(&active.Id, &active.ExamId, &deadline, &closedAt, &active.Revision, &frozen)
	if errors.Is(err, pgx.ErrNoRows) {
		return answerNotFound(), nil
	}
	if err != nil {
		return nil, err
	}
	scope := attemptScope{school: request.SchoolId, exam: active.ExamId, user: user}
	question, option := strings.ToLower(request.QuestionId), strings.ToLower(request.Body.OptionId)
	fingerprint := fmt.Sprintf("%x", sha256.Sum256([]byte(fmt.Sprintf("%s:%s:%s:%d", active.Id, question, option, request.Body.ExpectedRevision))))
	now, err := databaseNow(ctx, tx)
	if err != nil {
		return nil, err
	}
	receipt, err := findAttemptReceipt(ctx, tx, scope, request.Params.IdempotencyKey)
	if err == nil {
		if !receipt.matches("save_answer", fingerprint, now) {
			return SaveAnswer409JSONResponse(attemptKeyConflict()), nil
		}
		replayed, err := receipt.active(active.ExamId)
		if err != nil {
			return nil, err
		}
		return commitAnswer(ctx, tx, replayed)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if closedAt != nil || !deadline.After(now) {
		return closeLateAnswer(ctx, tx, active.Id, scope)
	}
	if active.Revision != request.Body.ExpectedRevision || active.Revision == 2147483647 {
		return SaveAnswer409JSONResponse(Error{Code: RevisionConflict, Message: "تغيرت المحاولة. حدّث المراجعة قبل الحفظ.", RequestId: uuid.NewString()}), nil
	}
	var exam StudentExam
	if err := json.Unmarshal(frozen, &exam); err != nil {
		return nil, err
	}
	if !containsFrozenOption(exam, question, option) {
		return answerInvalid(), nil
	}

	err = tx.QueryRow(ctx, `
		WITH stamp AS MATERIALIZED (SELECT date_trunc('milliseconds', clock_timestamp()) AS now)
		UPDATE almas.exam_attempts AS a SET revision = a.revision + 1 FROM stamp
		WHERE a.school_id = $1::uuid AND a.id = $2::uuid AND a.user_id = $3::uuid
		  AND a.closed_at IS NULL AND a.revision = $4 AND a.deadline > stamp.now
		RETURNING a.revision, stamp.now`, scope.school, active.Id, scope.user, active.Revision).Scan(&active.Revision, &now)
	if errors.Is(err, pgx.ErrNoRows) {
		return closeLateAnswer(ctx, tx, active.Id, scope)
	}
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO almas.exam_answers (school_id, exam_id, user_id, question_id, option_id)
		VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid)
		ON CONFLICT (school_id, exam_id, user_id, question_id) DO UPDATE SET option_id = EXCLUDED.option_id`,
		scope.school, scope.exam, scope.user, question, option); err != nil {
		return nil, err
	}
	active.Status, active.Deadline, active.ServerTime = Active, deadline.UnixMilli(), now.UnixMilli()
	active.Answers, err = loadAttemptAnswers(ctx, tx, scope)
	if err != nil {
		return nil, err
	}
	err = recordAttemptReceipt(ctx, tx, scope, request.Params.IdempotencyKey, "save_answer", fingerprint, false, now, active)
	if errors.Is(err, errAttemptKeyConflict) {
		return SaveAnswer409JSONResponse(attemptKeyConflict()), nil
	}
	if err != nil {
		return nil, err
	}
	return commitAnswer(ctx, tx, active)
}

func containsFrozenOption(exam StudentExam, question, option string) bool {
	for _, q := range exam.Questions {
		if q.Id == question {
			for _, o := range q.Options {
				if o.Id == option {
					return true
				}
			}
			return false
		}
	}
	return false
}

func closeLateAnswer(ctx context.Context, tx pgx.Tx, attemptID string, scope attemptScope) (SaveAnswerResponseObject, error) {
	if _, err := tx.Exec(ctx, `
		UPDATE almas.exam_attempts SET closed_at = clock_timestamp()
		WHERE school_id = $1::uuid AND id = $2::uuid AND user_id = $3::uuid
		  AND closed_at IS NULL AND deadline <= clock_timestamp()`, scope.school, attemptID, scope.user); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return SaveAnswer409JSONResponse(Error{Code: AttemptClosed, Message: "انتهت مهلة حفظ الإجابة.", RequestId: uuid.NewString()}), nil
}

func answerNotFound() SaveAnswer404JSONResponse {
	return SaveAnswer404JSONResponse(Error{Code: NotFound, Message: "المحاولة غير متاحة.", RequestId: uuid.NewString()})
}

func answerInvalid() SaveAnswer400JSONResponse {
	problem := Error{Code: InvalidRequest, Message: "السؤال أو الخيار غير صالح لهذه المحاولة.", RequestId: uuid.NewString()}
	return SaveAnswer400JSONResponse{ErrorJSONResponse: ErrorJSONResponse(problem)}
}

func commitAnswer(ctx context.Context, tx pgx.Tx, active ActiveAttempt) (SaveAnswerResponseObject, error) {
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return SaveAnswer200JSONResponse(active), nil
}
