package learningapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type postgresReadProbe struct {
	postgresSessionProbe
	exams    *PostgresExams
	attempts *PostgresAttempts
}

func (probe postgresReadProbe) StartAttempt(ctx context.Context, request StartAttemptRequestObject) (StartAttemptResponseObject, error) {
	return probe.attempts.StartAttempt(ctx, request)
}

func (probe postgresReadProbe) SaveAnswer(ctx context.Context, request SaveAnswerRequestObject) (SaveAnswerResponseObject, error) {
	return probe.attempts.SaveAnswer(ctx, request)
}

func (probe postgresReadProbe) GetAttempt(ctx context.Context, request GetAttemptRequestObject) (GetAttemptResponseObject, error) {
	return probe.attempts.GetAttempt(ctx, request)
}

func (probe postgresReadProbe) SubmitAttempt(ctx context.Context, request SubmitAttemptRequestObject) (SubmitAttemptResponseObject, error) {
	return probe.attempts.SubmitAttempt(ctx, request)
}

func (probe postgresReadProbe) GetStudentExam(ctx context.Context, request GetStudentExamRequestObject) (GetStudentExamResponseObject, error) {
	return probe.exams.GetStudentExam(ctx, request)
}

func TestKeycloakPostgresSession(t *testing.T) {
	issuer, dsn := os.Getenv("ALMAS_OIDC_TEST_ISSUER"), os.Getenv("ALMAS_TEST_DATABASE_URL")
	if issuer == "" || dsn == "" {
		t.Skip("requires isolated Keycloak and PostgreSQL fixtures")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal("could not configure fixture pool")
	}
	defer pool.Close()
	auth, err := NewKeycloakAuthenticator(ctx, issuer, "almas-api", "almas-web-local")
	if err != nil {
		t.Fatal(err)
	}
	handler, err := NewValidatedHandler(postgresReadProbe{
		postgresSessionProbe: postgresSessionProbe{sessions: NewPostgresSessions(pool)},
		exams:                NewPostgresExams(pool),
		attempts:             NewPostgresAttempts(pool),
	}, auth)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(handler)
	defer server.Close()

	const sessionPath = "/api/v1/session"
	const ownExam = "/api/v1/schools/00000000-0000-4000-8000-000000000011/exams/00000000-0000-4000-8000-000000000021"
	const foreignExam = "/api/v1/schools/00000000-0000-4000-8000-000000000012/exams/00000000-0000-4000-8000-000000000024"
	for _, tc := range []struct {
		name, tokenEnv, path string
		status               int
	}{
		{"access token yields database membership", "ALMAS_OIDC_TEST_ACCESS", sessionPath, http.StatusOK},
		{"ID token rejected", "ALMAS_OIDC_TEST_ID", sessionPath, http.StatusUnauthorized},
		{"missing token rejected", "", sessionPath, http.StatusUnauthorized},
		{"assigned exam uses verified student", "ALMAS_OIDC_TEST_ACCESS", ownExam, http.StatusOK},
		{"foreign exam is hidden", "ALMAS_OIDC_TEST_ACCESS", foreignExam, http.StatusNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+tc.path, nil)
			if err != nil {
				t.Fatal(err)
			}
			if tc.tokenEnv != "" {
				token := os.Getenv(tc.tokenEnv)
				if token == "" {
					t.Fatal("fixture token missing")
				}
				req.Header.Set("Authorization", "Bearer "+token)
			}
			req.Header.Set("X-School-ID", "00000000-0000-4000-8000-000000000012")
			req.Header.Set("X-Role", "school-admin")
			res, err := server.Client().Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer res.Body.Close()
			if res.StatusCode != tc.status || res.Header.Get("Cache-Control") != "no-store" {
				t.Fatalf("status = %d, want %d and no-store", res.StatusCode, tc.status)
			}
			if tc.status != http.StatusOK {
				return
			}
			decoder := json.NewDecoder(res.Body)
			decoder.DisallowUnknownFields()
			if tc.path == ownExam {
				var exam StudentExam
				if err := decoder.Decode(&exam); err != nil || len(exam.Questions) != 1 || len(exam.Questions[0].Options) != 2 {
					t.Fatalf("unexpected student exam response: %v", err)
				}
				return
			}
			var session Session
			if err := decoder.Decode(&session); err != nil {
				t.Fatal(err)
			}
			want := []Membership{{SchoolId: "00000000-0000-4000-8000-000000000011", Roles: []MembershipRoles{Student}}}
			if session.UserId != "00000000-0000-4000-8000-000000000004" || !reflect.DeepEqual(session.Memberships, want) {
				t.Fatalf("unexpected database session: %+v", session)
			}
		})
	}
	t.Run("real bearer starts one attempt and replays its response", func(t *testing.T) {
		token := os.Getenv("ALMAS_OIDC_TEST_ACCESS")
		if token == "" {
			t.Fatal("fixture access token missing")
		}
		start := func(body io.Reader) (int, []byte) {
			t.Helper()
			req, err := http.NewRequestWithContext(ctx, http.MethodPost, server.URL+ownExam+"/attempts", body)
			if err != nil {
				t.Fatal(err)
			}
			req.Header.Set("Authorization", "Bearer "+token)
			req.Header.Set("Idempotency-Key", "00000000-0000-4000-8000-000000000311")
			if body != nil {
				req.Header.Set("Content-Type", "application/json")
			}
			res, err := server.Client().Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer res.Body.Close()
			data, err := io.ReadAll(res.Body)
			if err != nil {
				t.Fatal(err)
			}
			return res.StatusCode, data
		}
		if status, _ := start(bytes.NewBufferString(`{"deadline":9999999999999}`)); status != http.StatusBadRequest {
			t.Fatalf("client deadline accepted with status %d", status)
		}
		status, first := start(nil)
		replayed, second := start(nil)
		var attempt ActiveAttempt
		if status != http.StatusCreated || replayed != status || !bytes.Equal(first, second) ||
			json.Unmarshal(first, &attempt) != nil || attempt.Deadline-attempt.ServerTime != 600000 {
			t.Fatalf("unexpected start and replay statuses %d and %d", status, replayed)
		}
		t.Run("save answer and retry over HTTP", func(t *testing.T) {
			const option = "00000000-0000-4000-8000-000000000032"
			const question = "00000000-0000-4000-8000-000000000031"
			path := "/api/v1/schools/00000000-0000-4000-8000-000000000011/attempts/" + attempt.Id + "/answers/" + question
			var original []byte
			for i := 0; i < 2; i++ {
				req, err := http.NewRequestWithContext(ctx, http.MethodPut, server.URL+path, bytes.NewBufferString(`{"expectedRevision":0,"optionId":"`+option+`"}`))
				if err != nil {
					t.Fatal(err)
				}
				req.Header.Set("Authorization", "Bearer "+token)
				req.Header.Set("Idempotency-Key", "00000000-0000-4000-8000-000000000312")
				req.Header.Set("Content-Type", "application/json")
				res, err := server.Client().Do(req)
				if err != nil {
					t.Fatal(err)
				}
				data, err := io.ReadAll(res.Body)
				_ = res.Body.Close()
				if err != nil || res.StatusCode != http.StatusOK {
					t.Fatalf("save status %d: %v", res.StatusCode, err)
				}
				if i == 0 {
					original = data
				} else if !bytes.Equal(data, original) {
					t.Fatal("save replay response changed")
				}
			}
			var saved ActiveAttempt
			if err := json.Unmarshal(original, &saved); err != nil || saved.Revision != 1 || len(saved.Answers) != 1 ||
				saved.Answers[0] != (SavedAnswer{OptionId: option, QuestionId: question}) {
				t.Fatalf("unexpected saved answer: %+v", saved)
			}
		})
		t.Run("read final attempt over HTTP", func(t *testing.T) {
			path := "/api/v1/schools/00000000-0000-4000-8000-000000000011/attempts/" + attempt.Id
			call := func(method, suffix, body string) []byte {
				t.Helper()
				req, err := http.NewRequestWithContext(ctx, method, server.URL+path+suffix, bytes.NewBufferString(body))
				if err != nil {
					t.Fatal(err)
				}
				req.Header.Set("Authorization", "Bearer "+token)
				if method == http.MethodPost {
					req.Header.Set("Idempotency-Key", "00000000-0000-4000-8000-000000000313")
					req.Header.Set("Content-Type", "application/json")
				}
				res, err := server.Client().Do(req)
				if err != nil {
					t.Fatal(err)
				}
				defer res.Body.Close()
				data, err := io.ReadAll(res.Body)
				if err != nil || res.StatusCode != http.StatusOK {
					t.Fatalf("%s attempt status %d: %v", method, res.StatusCode, err)
				}
				return data
			}
			submitted := call(http.MethodPost, "/submit", `{"expectedRevision":1}`)
			read := call(http.MethodGet, "", "")
			var expected, actual SubmittedAttempt
			if json.Unmarshal(submitted, &expected) != nil || json.Unmarshal(read, &actual) != nil ||
				expected.Status != Submitted || expected.Score != 1 || !reflect.DeepEqual(expected, actual) {
				t.Fatal("GET did not return the saved submission")
			}
		})
	})
}
