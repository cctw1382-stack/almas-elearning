package learningapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *PostgresAttempts) GetAttempt(ctx context.Context, request GetAttemptRequestObject) (GetAttemptResponseObject, error) {
	identity, ok := IdentityFromContext(ctx)
	if !ok {
		return GetAttempt401JSONResponse{ErrorJSONResponse(Error{Code: Unauthenticated, Message: "تعذر التحقق من الهوية.", RequestId: uuid.NewString()})}, nil
	}
	notFound := GetAttempt404JSONResponse(answerNotFound())
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
	now, err := databaseNow(ctx, tx)
	if err != nil {
		return nil, err
	}
	var response GetAttempt200JSONResponseBody
	switch {
	case previous != nil:
		if err := json.Unmarshal(previous, &result); err != nil {
			return nil, err
		}
		err = response.FromSubmittedAttempt(result)
	case !deadline.After(now):
		if err := finalizeAttempt(ctx, tx, scope, &result, deadline, snapshot, grading); err != nil {
			if errors.Is(err, errGradingUnavailable) {
				return GetAttemptdefaultJSONResponse{StatusCode: http.StatusConflict, Body: Error(unavailableGrading())}, nil
			}
			return nil, err
		}
		err = response.FromSubmittedAttempt(result)
	default:
		answers, err := loadAttemptAnswers(ctx, tx, scope)
		if err != nil {
			return nil, err
		}
		if err := response.FromActiveAttempt(ActiveAttempt{Id: result.Id, ExamId: result.ExamId,
			Status: Active, Deadline: deadline.UnixMilli(), ServerTime: now.UnixMilli(),
			Revision: result.Revision, Answers: answers}); err != nil {
			return nil, err
		}
	}
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return response, nil
}
