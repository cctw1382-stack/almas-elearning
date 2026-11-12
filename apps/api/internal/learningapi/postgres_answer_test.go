package learningapi

import (
	"context"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresSaveAnswer(t *testing.T) {
	dsn := os.Getenv("ALMAS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires isolated PostgreSQL answer fixture")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal("could not configure fixture pool")
	}
	defer pool.Close()
	identity := VerifiedIdentity{Issuer: "https://issuer-a.example.invalid", Subject: "attempt-subject"}
	ctx = context.WithValue(ctx, identityContextKey{}, identity)
	store := NewPostgresAttempts(pool)
	const school = "00000000-0000-4000-8000-000000000011"
	const exam = "00000000-0000-4000-8000-000000000047"
	const question = "00000000-0000-4000-8000-000000000051"
	const firstOption = "00000000-0000-4000-8000-000000000052"
	const secondOption = "00000000-0000-4000-8000-000000000053"
	const startKey = "00000000-0000-4000-8000-000000000401"
	start := StartAttemptRequestObject{SchoolId: school, ExamId: exam, Params: StartAttemptParams{IdempotencyKey: startKey}}
	created, err := store.StartAttempt(ctx, start)
	initial, ok := created.(StartAttempt201JSONResponse)
	if err != nil || !ok {
		t.Fatalf("expected fresh attempt: %T %v", created, err)
	}
	request := func(option, key string, revision int) SaveAnswerRequestObject {
		return SaveAnswerRequestObject{SchoolId: school, AttemptId: initial.Id, QuestionId: question,
			Params: SaveAnswerParams{IdempotencyKey: key},
			Body:   &SaveAnswerJSONRequestBody{OptionId: option, ExpectedRevision: revision}}
	}
	a := request(firstOption, "00000000-0000-4000-8000-000000000402", 0)
	b := request(secondOption, "00000000-0000-4000-8000-000000000403", 0)
	type result struct {
		response SaveAnswerResponseObject
		err      error
		request  SaveAnswerRequestObject
	}
	gate, replies := make(chan struct{}), make(chan result, 2)
	for _, req := range []SaveAnswerRequestObject{a, b} {
		go func(req SaveAnswerRequestObject) {
			<-gate
			response, err := store.SaveAnswer(ctx, req)
			replies <- result{response, err, req}
		}(req)
	}
	close(gate)
	var saved SaveAnswer200JSONResponse
	var winning SaveAnswerRequestObject
	writes, conflicts := 0, 0
	for i := 0; i < 2; i++ {
		res := <-replies
		if res.err != nil {
			t.Fatal(res.err)
		}
		switch v := res.response.(type) {
		case SaveAnswer200JSONResponse:
			saved, winning = v, res.request
			writes++
		case SaveAnswer409JSONResponse:
			if v.Code != RevisionConflict {
				t.Fatalf("unexpected conflict: %s", v.Code)
			}
			conflicts++
		default:
			t.Fatalf("unexpected response: %T", res.response)
		}
	}
	if writes != 1 || conflicts != 1 || saved.Revision != 1 || len(saved.Answers) != 1 ||
		saved.Answers[0].OptionId != winning.Body.OptionId {
		t.Fatalf("concurrent write outcome: writes=%d conflicts=%d state=%+v", writes, conflicts, saved)
	}
	t.Run("invalid frozen question and option are rejected", func(t *testing.T) {
		bad := request("00000000-0000-4000-8000-000000000099", "00000000-0000-4000-8000-000000000404", 1)
		got, err := store.SaveAnswer(ctx, bad)
		if _, ok := got.(SaveAnswer400JSONResponse); err != nil || !ok {
			t.Fatalf("expected invalid option: %T %v", got, err)
		}
		bad.QuestionId = "00000000-0000-4000-8000-000000000098"
		got, err = store.SaveAnswer(ctx, bad)
		if _, ok := got.(SaveAnswer400JSONResponse); err != nil || !ok {
			t.Fatalf("expected invalid question: %T %v", got, err)
		}
	})
	t.Run("migration preserves original start receipt", func(t *testing.T) {
		legacy := StartAttemptRequestObject{SchoolId: school, ExamId: "00000000-0000-4000-8000-000000000048",
			Params: StartAttemptParams{IdempotencyKey: "00000000-0000-4000-8000-000000000408"}}
		got, err := store.StartAttempt(ctx, legacy)
		active, ok := got.(StartAttempt201JSONResponse)
		if err != nil || !ok || active.Revision != 0 || active.Answers == nil || active.Deadline-active.ServerTime != 600000 {
			t.Fatalf("legacy receipt was not preserved: %T %v", got, err)
		}
	})
	t.Run("changed payload and cross-operation key conflict", func(t *testing.T) {
		changed := request(winning.Body.OptionId, winning.Params.IdempotencyKey, 1)
		for _, key := range []string{changed.Params.IdempotencyKey, startKey} {
			changed.Params.IdempotencyKey = key
			got, err := store.SaveAnswer(ctx, changed)
			problem, ok := got.(SaveAnswer409JSONResponse)
			if err != nil || !ok || problem.Code != IdempotencyConflict {
				t.Fatalf("expected key conflict: %T %v", got, err)
			}
		}
	})
	t.Run("stored reply and resumed attempt preserve revisions", func(t *testing.T) {
		option := secondOption
		if winning.Body.OptionId == secondOption {
			option = firstOption
		}
		next := request(option, "00000000-0000-4000-8000-000000000405", 1)
		got, err := store.SaveAnswer(ctx, next)
		updated, ok := got.(SaveAnswer200JSONResponse)
		if err != nil || !ok || updated.Revision != 2 || len(updated.Answers) != 1 || updated.Answers[0].OptionId != option {
			t.Fatalf("expected updated answer: %T %v", got, err)
		}
		replayed, err := store.SaveAnswer(ctx, winning)
		if err != nil || !reflect.DeepEqual(replayed, saved) {
			t.Fatalf("expected original save replay: %T %v", replayed, err)
		}
		original, err := store.StartAttempt(ctx, start)
		if err != nil || !reflect.DeepEqual(original, initial) {
			t.Fatalf("expected original start replay: %T %v", original, err)
		}
		resume := start
		resume.Params.IdempotencyKey = winning.Params.IdempotencyKey
		wrongOperation, err := store.StartAttempt(ctx, resume)
		problem, ok := wrongOperation.(StartAttempt409JSONResponse)
		if err != nil || !ok || problem.Code != IdempotencyConflict {
			t.Fatalf("save key accepted for start: %T %v", wrongOperation, err)
		}
		resume.Params.IdempotencyKey = "00000000-0000-4000-8000-000000000406"
		current, err := store.StartAttempt(ctx, resume)
		state, ok := current.(StartAttempt200JSONResponse)
		if err != nil || !ok || state.Id != initial.Id || state.Revision != 2 || !reflect.DeepEqual(state.Answers, updated.Answers) {
			t.Fatalf("resume lost saved answers: %T %v", current, err)
		}
	})
	t.Run("foreign student and school cannot save", func(t *testing.T) {
		other := context.WithValue(ctx, identityContextKey{}, VerifiedIdentity{Issuer: identity.Issuer, Subject: "shared-subject"})
		got, err := store.SaveAnswer(other, winning)
		if _, ok := got.(SaveAnswer404JSONResponse); err != nil || !ok {
			t.Fatalf("foreign student response: %T %v", got, err)
		}
		foreign := winning
		foreign.SchoolId = "00000000-0000-4000-8000-000000000012"
		got, err = store.SaveAnswer(ctx, foreign)
		if _, ok := got.(SaveAnswer404JSONResponse); err != nil || !ok {
			t.Fatalf("foreign school response: %T %v", got, err)
		}
	})
	t.Run("late write closes attempt without changing answers", func(t *testing.T) {
		tx, err := beginIdentityRead(ctx, pool, identity)
		if err != nil {
			t.Fatal(err)
		}
		var expiredID string
		err = tx.QueryRow(ctx, `SELECT id::text FROM almas.exam_attempts WHERE exam_id = '00000000-0000-4000-8000-000000000045'`).Scan(&expiredID)
		_ = tx.Rollback(ctx)
		if err != nil {
			t.Fatal(err)
		}
		late := request(secondOption, "00000000-0000-4000-8000-000000000407", 1)
		late.AttemptId = expiredID
		got, err := store.SaveAnswer(ctx, late)
		problem, ok := got.(SaveAnswer409JSONResponse)
		if err != nil || !ok || problem.Code != AttemptClosed {
			t.Fatalf("expected expired attempt: %T %v", got, err)
		}
		tx, err = beginIdentityRead(ctx, pool, identity)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		var closed bool
		var revision, answers int
		var preserved string
		err = tx.QueryRow(ctx, `
			SELECT closed_at IS NOT NULL, revision,
			       count(b.option_id), coalesce(min(b.option_id::text), '')
			FROM almas.exam_attempts AS a
			LEFT JOIN almas.exam_answers AS b USING (school_id, exam_id, user_id)
			WHERE a.id = $1::uuid GROUP BY a.school_id, a.exam_id, a.user_id`, expiredID).Scan(&closed, &revision, &answers, &preserved)
		if err != nil || !closed || revision != 1 || answers != 1 || preserved != firstOption {
			t.Fatalf("late write altered state: closed=%v revision=%d answers=%d error=%v", closed, revision, answers, err)
		}
	})
	t.Run("submission replays the same final result", func(t *testing.T) {
		submit := SubmitAttemptRequestObject{
			SchoolId: school, AttemptId: initial.Id,
			Params: SubmitAttemptParams{IdempotencyKey: "00000000-0000-4000-8000-000000000409"},
			Body:   &SubmitAttemptJSONRequestBody{ExpectedRevision: 2},
		}
		response, err := store.SubmitAttempt(ctx, submit)
		final, ok := response.(SubmitAttempt200JSONResponse)
		if err != nil || !ok || final.Reason != Manual || final.Total != 1 || len(final.Answers) != 1 {
			t.Fatalf("expected a graded result from the saved attempt: %T %v", response, err)
		}
		replay, err := store.SubmitAttempt(ctx, submit)
		if err != nil || !reflect.DeepEqual(replay, final) {
			t.Fatalf("same key must replay the final result: %T %v", replay, err)
		}
		submit.Params.IdempotencyKey = "00000000-0000-4000-8000-000000000410"
		replay, err = store.SubmitAttempt(ctx, submit)
		if err != nil || !reflect.DeepEqual(replay, final) {
			t.Fatalf("new key must preserve the final result: %T %v", replay, err)
		}
	})
	t.Run("grading uses the saved key after the live correct option changes", func(t *testing.T) {
		resume := start
		resume.ExamId = "00000000-0000-4000-8000-000000000048"
		resume.Params.IdempotencyKey = "00000000-0000-4000-8000-000000000411"
		response, err := store.StartAttempt(ctx, resume)
		active, ok := response.(StartAttempt200JSONResponse)
		if err != nil || !ok {
			t.Fatalf("resume grading fixture: %T %v", response, err)
		}
		answer := request(firstOption, "00000000-0000-4000-8000-000000000412", 0)
		answer.AttemptId = active.Id
		saved, err := store.SaveAnswer(ctx, answer)
		if _, ok := saved.(SaveAnswer200JSONResponse); err != nil || !ok {
			t.Fatalf("save formerly correct option: %T %v", saved, err)
		}
		submit := SubmitAttemptRequestObject{
			SchoolId: school, AttemptId: active.Id,
			Params: SubmitAttemptParams{IdempotencyKey: "00000000-0000-4000-8000-000000000413"},
			Body:   &SubmitAttemptJSONRequestBody{ExpectedRevision: 1},
		}
		graded, err := store.SubmitAttempt(ctx, submit)
		final, ok := graded.(SubmitAttempt200JSONResponse)
		if err != nil || !ok || final.Score != 1 || final.Total != 1 {
			t.Fatalf("expected grade from the frozen key: %T %v", graded, err)
		}
	})
}
