package learningapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

var _ int64 = ActiveAttempt{}.Deadline

type answerProbe struct {
	StrictServerInterface
	requests []SaveAnswerRequestObject
}

func (probe *answerProbe) SaveAnswer(_ context.Context, request SaveAnswerRequestObject) (SaveAnswerResponseObject, error) {
	probe.requests = append(probe.requests, request)
	return SaveAnswer200JSONResponse{
		Id: request.AttemptId, ExamId: "00000000-0000-4000-8000-000000000006",
		Status: "active", Deadline: 1800000000000, ServerTime: 1799999990000,
		Revision: request.Body.ExpectedRevision + 1,
		Answers:  []SavedAnswer{{QuestionId: request.QuestionId, OptionId: request.Body.OptionId}},
	}, nil
}

func TestSaveAnswerRoutingAndBinding(t *testing.T) {
	const school = "00000000-0000-4000-8000-000000000001"
	const attempt = "00000000-0000-4000-8000-000000000002"
	const question = "00000000-0000-4000-8000-000000000003"
	const option = "00000000-0000-4000-8000-000000000004"
	const key = "00000000-0000-4000-8000-000000000005"
	validBody := `{"optionId":"` + option + `","expectedRevision":2}`
	url := "/api/v1/schools/" + school + "/attempts/" + attempt + "/answers/" + question
	for _, tc := range []struct {
		name, key, body string
		status          int
	}{
		{"valid", key, validBody, http.StatusOK},
		{"missing idempotency key", "", validBody, http.StatusBadRequest},
		{"malformed body", key, "{", http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			probe := &answerProbe{}
			handler := HandlerWithOptions(NewStrictHandler(probe, nil), StdHTTPServerOptions{BaseURL: "/api/v1"})
			request := httptest.NewRequest(http.MethodPut, url, strings.NewReader(tc.body))
			request.Header.Set("Content-Type", "application/json")
			if tc.key != "" {
				request.Header.Set("Idempotency-Key", tc.key)
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != tc.status {
				t.Fatalf("status = %d, want %d: %s", response.Code, tc.status, response.Body)
			}
			if tc.status != http.StatusOK {
				if len(probe.requests) != 0 {
					t.Fatal("invalid request reached the handler")
				}
				return
			}
			if len(probe.requests) != 1 {
				t.Fatalf("handler called %d times", len(probe.requests))
			}
			got := probe.requests[0]
			if got.SchoolId != school || got.AttemptId != attempt || got.QuestionId != question ||
				got.Params.IdempotencyKey != key || got.Body == nil ||
				got.Body.OptionId != option || got.Body.ExpectedRevision != 2 {
				t.Fatalf("request parameters did not bind: %+v", got)
			}
			var payload ActiveAttempt
			if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
				t.Fatal(err)
			}
			if payload.Deadline != 1800000000000 || payload.Status != "active" {
				t.Fatalf("unexpected attempt response: %+v", payload)
			}
		})
	}
}

func TestStudentExamJSONExcludesGradingFields(t *testing.T) {
	const fixture = `{"id":"00000000-0000-4000-8000-000000000001","title":"اختبار","durationSeconds":60,"questions":[{"id":"00000000-0000-4000-8000-000000000002","text":"سؤال","correct":0,"options":[{"id":"00000000-0000-4000-8000-000000000003","text":"خيار","correct":true}]}],"answerKey":[0]}`
	var exam StudentExam
	if err := json.Unmarshal([]byte(fixture), &exam); err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(exam)
	if err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{`"correct"`, `"answerKey"`} {
		if bytes.Contains(data, []byte(key)) {
			t.Errorf("student payload contains %s", key)
		}
	}
	if !bytes.Contains(data, []byte("سؤال")) || !bytes.Contains(data, []byte("خيار")) {
		t.Fatal("student payload lost the question or option")
	}
}
