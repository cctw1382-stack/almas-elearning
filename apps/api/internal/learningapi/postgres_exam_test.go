package learningapi

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresStudentExam(t *testing.T) {
	dsn := os.Getenv("ALMAS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires isolated PostgreSQL exam fixture")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal("could not configure fixture pool")
	}
	defer pool.Close()
	exams := NewPostgresExams(pool)
	const a = "00000000-0000-4000-8000-000000000011"
	const b = "00000000-0000-4000-8000-000000000012"
	const assigned = "00000000-0000-4000-8000-000000000021"
	const draft = "00000000-0000-4000-8000-000000000022"
	const unassigned = "00000000-0000-4000-8000-000000000023"
	const foreign = "00000000-0000-4000-8000-000000000024"
	student := VerifiedIdentity{Issuer: "https://issuer-a.example.invalid", Subject: "shared-subject"}
	guardian := VerifiedIdentity{Issuer: "https://issuer-b.example.invalid", Subject: "shared-subject"}
	for _, tc := range []struct {
		name, school, exam string
		identity           VerifiedIdentity
		allowed            bool
	}{
		{"assigned published exam", a, assigned, student, true},
		{"draft remains hidden", a, draft, student, false},
		{"unassigned exam remains hidden", a, unassigned, student, false},
		{"foreign school remains hidden", b, foreign, student, false},
		{"school path substitution", b, assigned, student, false},
		{"assigned guardian is not a student", b, foreign, guardian, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := context.WithValue(ctx, identityContextKey{}, tc.identity)
			got, err := exams.GetStudentExam(req, GetStudentExamRequestObject{SchoolId: tc.school, ExamId: tc.exam})
			if err != nil {
				t.Fatal(err)
			}
			if !tc.allowed {
				if _, ok := got.(GetStudentExam404JSONResponse); !ok {
					t.Fatalf("expected 404, got %T", got)
				}
				return
			}
			exam, ok := got.(GetStudentExam200JSONResponse)
			if !ok || exam.Id != assigned || exam.DurationSeconds != 600 || len(exam.Questions) != 1 ||
				len(exam.Questions[0].Options) != 2 || exam.Questions[0].Options[0].Text != "First option" {
				t.Fatalf("unexpected public exam: %+v", got)
			}
		})
	}
	t.Run("raw question and option reads are scoped", func(t *testing.T) {
		tx, err := beginIdentityRead(ctx, pool, student)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		var questions, options int
		err = tx.QueryRow(ctx, `SELECT (SELECT count(*) FROM almas.exam_questions), (SELECT count(*) FROM almas.exam_options)`).Scan(&questions, &options)
		if err != nil || questions != 1 || options != 2 {
			t.Fatalf("unfiltered reads returned questions=%d options=%d: %v", questions, options, err)
		}
	})
}
