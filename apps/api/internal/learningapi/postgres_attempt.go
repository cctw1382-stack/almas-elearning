package learningapi

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresAttempts struct {
	pool *pgxpool.Pool
}

func NewPostgresAttempts(pool *pgxpool.Pool) *PostgresAttempts {
	return &PostgresAttempts{pool: pool}
}

func (s *PostgresAttempts) StartAttempt(ctx context.Context, request StartAttemptRequestObject) (StartAttemptResponseObject, error) {
	identity, ok := IdentityFromContext(ctx)
	if !ok {
		problem := Error{Code: Unauthenticated, Message: "تعذر التحقق من الهوية.", RequestId: uuid.NewString()}
		return StartAttempt401JSONResponse{ErrorJSONResponse: ErrorJSONResponse(problem)}, nil
	}
	tx, userID, err := s.beginWrite(ctx, identity)
	if errors.Is(err, pgx.ErrNoRows) {
		return startNotFound(), nil
	}
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	exam, err := readStudentExam(ctx, tx, GetStudentExamRequestObject{SchoolId: request.SchoolId, ExamId: request.ExamId}, identity)
	if errors.Is(err, pgx.ErrNoRows) {
		return startNotFound(), nil
	}
	if err != nil {
		return nil, err
	}
	now, err := databaseNow(ctx, tx)
	if err != nil {
		return nil, err
	}
	target := attemptScope{school: request.SchoolId, exam: exam.Id, user: userID}
	receipt, err := findAttemptReceipt(ctx, tx, target, request.Params.IdempotencyKey)
	if err == nil {
		if !receipt.matches("start", "", now) {
			return StartAttempt409JSONResponse(attemptKeyConflict()), nil
		}
		active, err := receipt.active(exam.Id)
		if err != nil {
			return nil, err
		}
		return commitStart(ctx, tx, active, receipt.created)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if (exam.OpensAt != nil && now.Before(*exam.OpensAt)) || (exam.ClosesAt != nil && !now.Before(*exam.ClosesAt)) {
		return startClosed(), nil
	}

	var attemptID string
	var deadline time.Time
	var revision int
	var submitted bool
	err = tx.QueryRow(ctx, `
		SELECT id::text, deadline, revision, submission IS NOT NULL FROM almas.exam_attempts
		WHERE school_id = $1::uuid AND exam_id = $2::uuid AND user_id = $3::uuid`,
		request.SchoolId, exam.Id, userID).Scan(&attemptID, &deadline, &revision, &submitted)
	created := errors.Is(err, pgx.ErrNoRows)
	if created {
		deadline = now.Add(time.Duration(exam.DurationSeconds) * time.Second)
		if exam.ClosesAt != nil && exam.ClosesAt.Before(deadline) {
			deadline = exam.ClosesAt.Truncate(time.Millisecond)
		}
		if !deadline.After(now) {
			return startClosed(), nil
		}
		snapshot, err := json.Marshal(exam.StudentExam)
		if err != nil {
			return nil, err
		}
		if err := tx.QueryRow(ctx, `
			INSERT INTO almas.exam_attempts (school_id, exam_id, user_id, started_at, deadline, public_exam, grading_key)
			VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb, (
				SELECT jsonb_object_agg(question_id, id)
				FROM almas.exam_options
				WHERE school_id = $1::uuid AND exam_id = $2::uuid AND is_correct
			))
			RETURNING id::text`, request.SchoolId, exam.Id, userID, now, deadline, snapshot).Scan(&attemptID); err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	} else if submitted || !deadline.After(now) {
		return startClosed(), nil
	}
	answers, err := loadAttemptAnswers(ctx, tx, target)
	if err != nil {
		return nil, err
	}
	active := ActiveAttempt{Id: attemptID, ExamId: exam.Id, Status: Active, Deadline: deadline.UnixMilli(),
		ServerTime: now.UnixMilli(), Revision: revision, Answers: answers}
	err = recordAttemptReceipt(ctx, tx, target, request.Params.IdempotencyKey, "start", "", created, now, active)
	if errors.Is(err, errAttemptKeyConflict) {
		return StartAttempt409JSONResponse(attemptKeyConflict()), nil
	}
	if err != nil {
		return nil, err
	}
	return commitStart(ctx, tx, active, created)
}

func startNotFound() StartAttempt404JSONResponse {
	return StartAttempt404JSONResponse(Error{Code: NotFound, Message: "الاختبار غير متاح.", RequestId: uuid.NewString()})
}

func startClosed() StartAttempt409JSONResponse {
	return StartAttempt409JSONResponse(Error{Code: AttemptClosed, Message: "بدء المحاولة غير متاح في هذا الوقت.", RequestId: uuid.NewString()})
}

func commitStart(ctx context.Context, tx pgx.Tx, active ActiveAttempt, created bool) (StartAttemptResponseObject, error) {
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	if created {
		return StartAttempt201JSONResponse(active), nil
	}
	return StartAttempt200JSONResponse(active), nil
}
