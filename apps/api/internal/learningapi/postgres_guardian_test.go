package learningapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresGuardian(t *testing.T) {
	dsn := os.Getenv("ALMAS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires isolated PostgreSQL guardian fixture")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal("could not configure fixture pool")
	}
	defer pool.Close()
	const school = "00000000-0000-4000-8000-000000000011"
	const child = "00000000-0000-4000-8000-000000000005"
	for _, tc := range []struct {
		name, subject, school, child string
		status                       int
	}{
		{"linked child", "linked-guardian", school, child, http.StatusOK},
		{"altered childId", "linked-guardian", school, "00000000-0000-4000-8000-000000000001", http.StatusNotFound},
		{"altered schoolId", "linked-guardian", "00000000-0000-4000-8000-000000000012", child, http.StatusNotFound},
		{"guardian without a link", "unlinked-guardian", school, child, http.StatusNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			handler, err := NewPostgresLearningHandler(pool, func(_ context.Context, input *openapi3filter.AuthenticationInput) error {
				r := input.RequestValidationInput.Request
				*r = *r.WithContext(context.WithValue(r.Context(), identityContextKey{}, VerifiedIdentity{
					Issuer: "https://issuer-a.example.invalid", Subject: tc.subject,
				}))
				return nil
			})
			if err != nil {
				t.Fatal(err)
			}
			request := httptest.NewRequest(http.MethodGet, "/api/v1/schools/"+tc.school+"/guardian/children/"+tc.child, nil)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != tc.status {
				t.Fatalf("status %d, want %d", response.Code, tc.status)
			}
			if tc.status == http.StatusOK {
				var result GuardianChild
				if json.Unmarshal(response.Body.Bytes(), &result) != nil || result.ChildId != child || result.SchoolId != school {
					t.Fatal("response did not contain only the linked child")
				}
			}
		})
	}
}
