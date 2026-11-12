package learningapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3filter"
)

func TestValidatedHandlerRequiresAuthentication(t *testing.T) {
	if _, err := NewValidatedHandler(&answerProbe{}, nil); err == nil {
		t.Fatal("expected missing authenticator to fail startup")
	}
}

func TestValidatedSaveAnswer(t *testing.T) {
	const id = "00000000-0000-4000-8000-000000000001"
	const url = "/api/v1/schools/" + id + "/attempts/" + id + "/answers/" + id
	const valid = `{"optionId":"` + id + `","expectedRevision":2}`
	for _, tc := range []struct {
		name, path, body, key, authorization string
		status                               int
	}{
		{"valid", url, valid, id, "Bearer test", 200},
		{"missing authorization", url, valid, id, "", 401},
		{"rejected authorization", url, valid, id, "Bearer rejected", 401},
		{"invalid school ID", strings.Replace(url, id, "invalid", 1), valid, id, "Bearer test", 400},
		{"invalid key", url, valid, "invalid", "Bearer test", 400},
		{"missing key", url, valid, "", "Bearer test", 400},
		{"missing revision", url, `{"optionId":"` + id + `"}`, id, "Bearer test", 400},
		{"negative revision", url, strings.Replace(valid, ":2", ":-1", 1), id, "Bearer test", 400},
		{"fractional revision", url, strings.Replace(valid, ":2", ":2.5", 1), id, "Bearer test", 400},
		{"upper bound", url, strings.Replace(valid, ":2", ":2147483648", 1), id, "Bearer test", 400},
		{"invalid option ID", url, strings.Replace(valid, id, "invalid", 1), id, "Bearer test", 400},
		{"unknown field", url, strings.TrimSuffix(valid, "}") + `,"score":10}`, id, "Bearer test", 400},
		{"case alias", url, strings.TrimSuffix(valid, "}") + `,"ExpectedRevision":99}`, id, "Bearer test", 400},
		{"malformed JSON", url, "{", id, "Bearer test", 400},
		{"trailing JSON", url, valid + "{}", id, "Bearer test", 400},
		{"encoded path separator", strings.Replace(url, "/attempts/", "%2Fattempts/", 1), valid, id, "Bearer test", 400},
		{"oversized body", url, valid + strings.Repeat(" ", 16384), id, "Bearer test", 413},
		{"oversized streamed body", url, valid + strings.Repeat(" ", 16384), id, "Bearer test", 413},
		{"unknown route", "/api/v1/unknown", valid, id, "Bearer test", 404},
	} {
		t.Run(tc.name, func(t *testing.T) {
			probe := &answerProbe{}
			handler, err := NewValidatedHandler(probe, func(_ context.Context, input *openapi3filter.AuthenticationInput) error {
				if input.RequestValidationInput.Request.Header.Get("Authorization") != "Bearer test" {
					return errors.New("private verifier detail")
				}
				return nil
			})
			if err != nil {
				t.Fatal(err)
			}
			request := httptest.NewRequest(http.MethodPut, tc.path, strings.NewReader(tc.body))
			if tc.name == "oversized streamed body" {
				request.ContentLength = -1
			}
			request.Header.Set("Content-Type", "application/json")
			if tc.key != "" {
				request.Header.Set("Idempotency-Key", tc.key)
			}
			if tc.authorization != "" {
				request.Header.Set("Authorization", tc.authorization)
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != tc.status {
				t.Fatalf("status = %d, want %d: %s", response.Code, tc.status, response.Body)
			}
			if response.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("private response is cacheable")
			}
			if tc.status == 200 {
				if len(probe.requests) != 1 || probe.requests[0].Body.ExpectedRevision != 2 {
					t.Fatalf("validated body did not bind: %+v", probe.requests)
				}
				return
			}
			if len(probe.requests) != 0 {
				t.Fatal("rejected request reached the handler")
			}
			var problem Error
			if err := json.Unmarshal(response.Body.Bytes(), &problem); err != nil || problem.Code == "" || problem.RequestId == "" {
				t.Fatalf("invalid error response: %s", response.Body)
			}
			if strings.Contains(response.Body.String(), "private verifier detail") {
				t.Fatal("verifier detail escaped")
			}
		})
	}
}

func TestEveryLearningRouteRequiresIdentity(t *testing.T) {
	const id = "00000000-0000-4000-8000-000000000001"
	const school = "/api/v1/schools/" + id
	const exam = school + "/exams/" + id
	const attempt = school + "/attempts/" + id
	handler, err := NewValidatedHandler(&answerProbe{}, func(context.Context, *openapi3filter.AuthenticationInput) error {
		return errors.New("identity required")
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, route := range []struct{ method, path, body string }{
		{http.MethodGet, "/api/v1/session", ""},
		{http.MethodGet, exam, ""},
		{http.MethodPost, exam + "/attempts", ""},
		{http.MethodGet, attempt, ""},
		{http.MethodPut, attempt + "/answers/" + id, `{"optionId":"` + id + `","expectedRevision":0}`},
		{http.MethodPost, attempt + "/submit", `{"expectedRevision":0}`},
	} {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			response := httptest.NewRecorder()
			request := httptest.NewRequest(route.method, route.path, strings.NewReader(route.body))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Idempotency-Key", id)
			handler.ServeHTTP(response, request)
			if response.Code != http.StatusUnauthorized || response.Header().Get("WWW-Authenticate") != "Bearer" {
				t.Fatalf("expected bearer challenge, got %d: %s", response.Code, response.Body)
			}
		})
	}
}
