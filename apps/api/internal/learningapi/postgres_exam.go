package learningapi

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresExams struct {
	pool *pgxpool.Pool
}

func NewPostgresExams(pool *pgxpool.Pool) *PostgresExams {
	return &PostgresExams{pool: pool}
}

func (s *PostgresExams) GetStudentExam(ctx context.Context, request GetStudentExamRequestObject) (GetStudentExamResponseObject, error) {
	identity, ok := IdentityFromContext(ctx)
	if !ok {
		problem := Error{Code: Unauthenticated, Message: "تعذر التحقق من الهوية.", RequestId: uuid.NewString()}
		return GetStudentExam401JSONResponse{ErrorJSONResponse: ErrorJSONResponse(problem)}, nil
	}
	tx, err := beginIdentityRead(ctx, s.pool, identity)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	exam, err := readStudentExam(ctx, tx, request, identity)
	if errors.Is(err, pgx.ErrNoRows) {
		return GetStudentExam404JSONResponse(Error{Code: NotFound, Message: "الاختبار غير متاح.", RequestId: uuid.NewString()}), nil
	}
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return GetStudentExam200JSONResponse(exam.StudentExam), nil
}

type assignedExam struct {
	StudentExam
	OpensAt, ClosesAt *time.Time
}

func readStudentExam(ctx context.Context, tx pgx.Tx, request GetStudentExamRequestObject, identity VerifiedIdentity) (assignedExam, error) {
	rows, err := tx.Query(ctx, `
		SELECT e.id::text, e.title, e.duration_seconds, e.opens_at, e.closes_at,
		       q.id::text, q.question_text, o.id::text, o.option_text
		FROM almas.exams AS e
		JOIN almas.exam_assignments AS a ON a.school_id = e.school_id AND a.exam_id = e.id
		JOIN almas.users AS u ON u.id = a.user_id
		JOIN almas.school_memberships AS m ON m.user_id = u.id AND m.school_id = e.school_id
		LEFT JOIN almas.exam_questions AS q ON q.school_id = e.school_id AND q.exam_id = e.id
		LEFT JOIN almas.exam_options AS o ON o.school_id = q.school_id AND o.exam_id = q.exam_id AND o.question_id = q.id
		WHERE e.school_id = $1::uuid AND e.id = $2::uuid AND e.published
		  AND u.issuer = $3 AND u.subject = $4 AND m.role = 'student'
		ORDER BY q.position, o.position`, request.SchoolId, request.ExamId, identity.Issuer, identity.Subject)
	if err != nil {
		return assignedExam{}, err
	}
	defer rows.Close()
	var exam assignedExam
	for rows.Next() {
		var questionID, questionText, optionID, optionText *string
		if err := rows.Scan(&exam.Id, &exam.Title, &exam.DurationSeconds, &exam.OpensAt, &exam.ClosesAt,
			&questionID, &questionText, &optionID, &optionText); err != nil {
			return assignedExam{}, err
		}
		if questionID == nil || optionID == nil {
			return assignedExam{}, errors.New("published exam has incomplete public questions")
		}
		count := len(exam.Questions)
		if count == 0 || exam.Questions[count-1].Id != *questionID {
			exam.Questions = append(exam.Questions, StudentQuestion{Id: *questionID, Text: *questionText})
		}
		question := &exam.Questions[len(exam.Questions)-1]
		question.Options = append(question.Options, Option{Id: *optionID, Text: *optionText})
	}
	if err := rows.Err(); err != nil {
		return assignedExam{}, err
	}
	if len(exam.Questions) == 0 {
		return assignedExam{}, pgx.ErrNoRows
	}
	for _, question := range exam.Questions {
		if len(question.Options) < 2 {
			return assignedExam{}, errors.New("published question has fewer than two options")
		}
	}
	return exam, nil
}
