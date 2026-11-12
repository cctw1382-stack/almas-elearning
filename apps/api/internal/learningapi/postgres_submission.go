package learningapi

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *PostgresAttempts) SubmitAttempt(ctx context.Context, request SubmitAttemptRequestObject) (SubmitAttemptResponseObject, error) {
	identity, ok := IdentityFromContext(ctx)
	if !ok {
		return SubmitAttempt401JSONResponse(Error{Code: Unauthenticated, Message: "تعذر التحقق من الهوية.", RequestId: uuid.NewString()}), nil
	}
	if request.Body == nil {
		return SubmitAttempt400JSONResponse{ErrorJSONResponse(Error{Code: InvalidRequest, Message: "مراجعة المحاولة مطلوبة.", RequestId: uuid.NewString()})}, nil
	}
	notFound := SubmitAttempt404JSONResponse(answerNotFound())
	tx, user, err := s.beginWrite(ctx, identity)
	if errors.Is(err, pgx.ErrNoRows) {
		return notFound, nil
	}
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var result SubmittedAttempt
	var deadline time.Time
	var snapshot, grading, previous []byte
	err = tx.QueryRow(ctx, `
		SELECT a.id::text, a.exam_id::text, a.deadline, a.revision, a.public_exam, a.grading_key, a.submission
		FROM almas.exam_attempts AS a
		JOIN almas.exams AS e ON e.school_id = a.school_id AND e.id = a.exam_id
		WHERE a.school_id = $1::uuid AND a.id = $2::uuid AND a.user_id = $3::uuid
		FOR UPDATE OF a`, request.SchoolId, request.AttemptId, user).
		Scan(&result.Id, &result.ExamId, &deadline, &result.Revision, &snapshot, &grading, &previous)
	if errors.Is(err, pgx.ErrNoRows) {
		return notFound, nil
	}
	if err != nil {
		return nil, err
	}
	scope := attemptScope{school: request.SchoolId, exam: result.ExamId, user: user}
	key := request.Params.IdempotencyKey
	fingerprint := fmt.Sprintf("%x", sha256.Sum256([]byte(fmt.Sprintf("%s:%d", result.Id, request.Body.ExpectedRevision))))
	now, err := databaseNow(ctx, tx)
	if err != nil {
		return nil, err
	}
	receipt, err := findAttemptReceipt(ctx, tx, scope, key)
	switch {
	case err == nil:
		if !receipt.matches("submit", fingerprint, now) {
			return SubmitAttempt409JSONResponse(attemptKeyConflict()), nil
		}
		if err := json.Unmarshal(receipt.response, &result); err != nil {
			return nil, err
		}
		return SubmitAttempt200JSONResponse(result), nil
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, err
	}

	if previous != nil {
		if err := json.Unmarshal(previous, &result); err != nil {
			return nil, err
		}
	} else {
		if deadline.After(now) && result.Revision != request.Body.ExpectedRevision {
			return SubmitAttempt409JSONResponse(Error{Code: RevisionConflict, Message: "تغيرت المحاولة. حدّث المراجعة قبل التسليم.", RequestId: uuid.NewString()}), nil
		}
		if err := finalizeAttempt(ctx, tx, scope, &result, deadline, snapshot, grading); err != nil {
			if errors.Is(err, errGradingUnavailable) {
				return unavailableGrading(), nil
			}
			return nil, err
		}
	}
	err = recordAttemptReceipt(ctx, tx, scope, key, "submit", fingerprint, false, now, result)
	if errors.Is(err, errAttemptKeyConflict) {
		return SubmitAttempt409JSONResponse(attemptKeyConflict()), nil
	}
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return SubmitAttempt200JSONResponse(result), nil
}

func unavailableGrading() SubmitAttempt409JSONResponse {
	return SubmitAttempt409JSONResponse(Error{Code: AttemptClosed, Message: "نسخة تصحيح هذه المحاولة غير متاحة.", RequestId: uuid.NewString()})
}

var errGradingUnavailable = errors.New("frozen grading key unavailable")

func finalizeAttempt(ctx context.Context, tx pgx.Tx, scope attemptScope, result *SubmittedAttempt, deadline time.Time, snapshot, grading []byte) error {
	var exam StudentExam
	var correct map[string]string
	if err := json.Unmarshal(snapshot, &exam); err != nil {
		return err
	}
	if grading != nil {
		if err := json.Unmarshal(grading, &correct); err != nil {
			return err
		}
	}
	if len(exam.Questions) == 0 || len(correct) != len(exam.Questions) {
		return errGradingUnavailable
	}
	for _, question := range exam.Questions {
		if !containsFrozenOption(exam, question.Id, correct[question.Id]) {
			return errGradingUnavailable
		}
	}
	answers, err := loadAttemptAnswers(ctx, tx, scope)
	if err != nil {
		return err
	}
	for _, answer := range answers {
		if correct[answer.QuestionId] == answer.OptionId {
			result.Score++
		}
	}
	result.Answers = answers
	now, err := databaseNow(ctx, tx)
	if err != nil {
		return err
	}
	result.Reason = Manual
	if !deadline.After(now) {
		result.Reason = Timeout
	}
	result.Status, result.Total = Submitted, len(exam.Questions)
	result.Deadline, result.ServerTime, result.SubmittedAt = deadline.UnixMilli(), now.UnixMilli(), now.UnixMilli()
	body, err := json.Marshal(result)
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE almas.exam_attempts SET submission = $1::jsonb
		WHERE id = $2::uuid AND submission IS NULL`, body, result.Id); err != nil {
		return err
	}
	return nil
}
