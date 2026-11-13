package learningapi

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresAttemptStart(t *testing.T) {
	dsn := os.Getenv("ALMAS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires isolated PostgreSQL attempt fixture")
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
	const exam = "00000000-0000-4000-8000-000000000041"
	request := func(id, key string) StartAttemptRequestObject {
		return StartAttemptRequestObject{SchoolId: school, ExamId: id, Params: StartAttemptParams{IdempotencyKey: key}}
	}
	key := func(n int) string { return fmt.Sprintf("00000000-0000-4000-8000-%012d", n) }

	const concurrent = 8
	type result struct {
		response StartAttemptResponseObject
		err      error
		key      string
	}
	start := make(chan struct{})
	results := make(chan result, concurrent)
	for i := 0; i < concurrent; i++ {
		go func(k string) {
			<-start
			response, err := store.StartAttempt(ctx, request(exam, k))
			results <- result{response: response, err: err, key: k}
		}(key(100 + i))
	}
	close(start)
	var winner StartAttempt201JSONResponse
	var winningKey, attemptID string
	created := 0
	for i := 0; i < concurrent; i++ {
		got := <-results
		if got.err != nil {
			t.Fatal(got.err)
		}
		var active ActiveAttempt
		switch response := got.response.(type) {
		case StartAttempt201JSONResponse:
			created++
			winner, winningKey = response, got.key
			active = ActiveAttempt(response)
		case StartAttempt200JSONResponse:
			active = ActiveAttempt(response)
		default:
			t.Fatalf("unexpected start response %T", response)
		}
		if attemptID == "" {
			attemptID = active.Id
		}
		if active.Id != attemptID || active.ExamId != exam || active.Status != Active || active.Answers == nil {
			t.Fatalf("unexpected active attempt: %+v", active)
		}
	}
	if created != 1 || winner.Deadline-winner.ServerTime != 600000 {
		t.Fatalf("expected one creation with 600-second server deadline, got %d", created)
	}

	t.Run("same key replays original status and body", func(t *testing.T) {
		got, err := store.StartAttempt(ctx, request(exam, winningKey))
		if err != nil || !reflect.DeepEqual(got, winner) {
			t.Fatalf("creation was not replayed: %T %v", got, err)
		}
	})
	t.Run("key reused for another assigned exam conflicts", func(t *testing.T) {
		got, err := store.StartAttempt(ctx, request("00000000-0000-4000-8000-000000000042", winningKey))
		problem, ok := got.(StartAttempt409JSONResponse)
		if err != nil || !ok || problem.Code != IdempotencyConflict {
			t.Fatalf("expected idempotency conflict: %T %v", got, err)
		}
	})
	t.Run("simultaneous same-key requests replay one creation", func(t *testing.T) {
		const otherExam = "00000000-0000-4000-8000-000000000042"
		gate := make(chan struct{})
		replies := make(chan result, 2)
		for i := 0; i < 2; i++ {
			go func() {
				<-gate
				response, err := store.StartAttempt(ctx, request(otherExam, key(210)))
				replies <- result{response: response, err: err}
			}()
		}
		close(gate)
		first, second := <-replies, <-replies
		if _, ok := first.response.(StartAttempt201JSONResponse); !ok ||
			first.err != nil || second.err != nil || !reflect.DeepEqual(first.response, second.response) {
			t.Fatalf("same-key requests did not replay one creation: %T %T", first.response, second.response)
		}
	})
	t.Run("closed or not yet open window blocks creation", func(t *testing.T) {
		for i, id := range []string{"00000000-0000-4000-8000-000000000043", "00000000-0000-4000-8000-000000000044"} {
			got, err := store.StartAttempt(ctx, request(id, key(200+i)))
			problem, ok := got.(StartAttempt409JSONResponse)
			if err != nil || !ok || problem.Code != AttemptClosed {
				t.Fatalf("expected window conflict: %T %v", got, err)
			}
		}
	})
	t.Run("expired attempt cannot be restarted with a new key", func(t *testing.T) {
		got, err := store.StartAttempt(ctx, request("00000000-0000-4000-8000-000000000045", key(205)))
		problem, ok := got.(StartAttempt409JSONResponse)
		if err != nil || !ok || problem.Code != AttemptClosed {
			t.Fatalf("expected expired attempt conflict: %T %v", got, err)
		}
	})
	t.Run("expired key cannot replay or restart", func(t *testing.T) {
		got, err := store.StartAttempt(ctx, request("00000000-0000-4000-8000-000000000045", key(206)))
		problem, ok := got.(StartAttempt409JSONResponse)
		if err != nil || !ok || problem.Code != IdempotencyConflict {
			t.Fatalf("expected expired key conflict: %T %v", got, err)
		}
	})
	t.Run("deadline is capped by exam closing time", func(t *testing.T) {
		got, err := store.StartAttempt(ctx, request("00000000-0000-4000-8000-000000000046", key(207)))
		active, ok := got.(StartAttempt201JSONResponse)
		if err != nil || !ok || active.Deadline <= active.ServerTime || active.Deadline-active.ServerTime > 3600000 {
			t.Fatalf("expected closing-time deadline: %T %v", got, err)
		}
	})
	t.Run("foreign school cannot use a valid replay key", func(t *testing.T) {
		req := request(exam, winningKey)
		req.SchoolId = "00000000-0000-4000-8000-000000000012"
		got, err := store.StartAttempt(ctx, req)
		if _, ok := got.(StartAttempt404JSONResponse); err != nil || !ok {
			t.Fatalf("expected scoped not found: %T %v", got, err)
		}
	})
	t.Run("one attempt and one key record per concurrent request", func(t *testing.T) {
		tx, err := beginIdentityRead(ctx, pool, identity)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		var attempts, keys, snapshotQuestions int
		err = tx.QueryRow(ctx, `
			SELECT (SELECT count(*) FROM almas.exam_attempts WHERE exam_id = $1::uuid),
			       (SELECT count(*) FROM almas.exam_write_keys WHERE exam_id = $1::uuid),
			       (SELECT jsonb_array_length(public_exam->'questions') FROM almas.exam_attempts WHERE exam_id = $1::uuid)`, exam).
			Scan(&attempts, &keys, &snapshotQuestions)
		if err != nil || attempts != 1 || keys != concurrent || snapshotQuestions != 1 {
			t.Fatalf("attempts=%d keys=%d snapshot questions=%d: %v", attempts, keys, snapshotQuestions, err)
		}
	})
	t.Run("same-school student cannot read another user's attempt or keys", func(t *testing.T) {
		other := VerifiedIdentity{Issuer: identity.Issuer, Subject: "shared-subject"}
		tx, err := beginIdentityRead(ctx, pool, other)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		var attempts, keys int
		err = tx.QueryRow(ctx, `
			SELECT (SELECT count(*) FROM almas.exam_attempts WHERE exam_id = $1::uuid),
			       (SELECT count(*) FROM almas.exam_write_keys WHERE exam_id = $1::uuid)`, exam).Scan(&attempts, &keys)
		if err != nil || attempts != 0 || keys != 0 {
			t.Fatalf("foreign attempt state visible: attempts=%d keys=%d: %v", attempts, keys, err)
		}
	})
}
