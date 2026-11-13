package learningapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/jackc/pgx/v5/pgxpool"
)

type postgresSessionProbe struct {
	StrictServerInterface
	sessions *PostgresSessions
}

func (probe postgresSessionProbe) GetSession(ctx context.Context, request GetSessionRequestObject) (GetSessionResponseObject, error) {
	return probe.sessions.GetSession(ctx, request)
}

func TestPostgresSessions(t *testing.T) {
	dsn := os.Getenv("ALMAS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires isolated PostgreSQL membership fixture")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal("invalid fixture connection configuration")
	}
	config.MaxConns = 1
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal("could not open fixture pool")
	}
	defer pool.Close()
	var restricted bool
	err = pool.QueryRow(ctx, `
		SELECT current_user = 'almas_app' AND NOT rolsuper AND NOT rolbypassrls
			AND NOT has_table_privilege(current_user, 'almas.school_memberships', 'INSERT')
			AND NOT has_table_privilege(current_user, 'almas.school_memberships', 'UPDATE')
		FROM pg_roles WHERE rolname = current_user`).Scan(&restricted)
	if err != nil || !restricted {
		t.Fatalf("expected restricted database role: %v", err)
	}

	const schoolA = "00000000-0000-4000-8000-000000000011"
	const schoolB = "00000000-0000-4000-8000-000000000012"
	identityA := VerifiedIdentity{Issuer: "https://issuer-a.example.invalid", Subject: "shared-subject"}
	identityB := VerifiedIdentity{Issuer: "https://issuer-b.example.invalid", Subject: "shared-subject"}
	service := NewPostgresSessions(pool)
	for _, tc := range []struct {
		name     string
		identity VerifiedIdentity
		user     string
		want     []Membership
	}{
		{"first school", identityA, "00000000-0000-4000-8000-000000000001", []Membership{{SchoolId: schoolA, Roles: []MembershipRoles{Student, Teacher}}}},
		{"same subject different issuer", identityB, "00000000-0000-4000-8000-000000000002", []Membership{{SchoolId: schoolB, Roles: []MembershipRoles{Guardian}}}},
		{"no memberships", VerifiedIdentity{Issuer: identityA.Issuer, Subject: "no-school"}, "00000000-0000-4000-8000-000000000003", []Membership{}},
		{"reused pooled connection", identityA, "00000000-0000-4000-8000-000000000001", []Membership{{SchoolId: schoolA, Roles: []MembershipRoles{Student, Teacher}}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			identityContext := context.WithValue(ctx, identityContextKey{}, tc.identity)
			response, err := service.GetSession(identityContext, GetSessionRequestObject{})
			if err != nil {
				t.Fatal(err)
			}
			got, ok := response.(GetSession200JSONResponse)
			if !ok || got.UserId != tc.user || !reflect.DeepEqual(got.Memberships, tc.want) {
				t.Fatalf("unexpected scoped session: %+v", response)
			}
		})
	}

	t.Run("unknown identity", func(t *testing.T) {
		request := context.WithValue(ctx, identityContextKey{}, VerifiedIdentity{Issuer: identityA.Issuer, Subject: "unknown"})
		response, err := service.GetSession(request, GetSessionRequestObject{})
		if _, ok := response.(GetSession404JSONResponse); err != nil || !ok {
			t.Fatalf("expected unknown identity to return 404: %T %v", response, err)
		}
	})
	t.Run("unauthenticated", func(t *testing.T) {
		response, err := service.GetSession(ctx, GetSessionRequestObject{})
		if _, ok := response.(GetSession401JSONResponse); err != nil || !ok {
			t.Fatalf("expected missing identity to return 401: %T %v", response, err)
		}
	})
	t.Run("RLS blocks another school without application filters", func(t *testing.T) {
		tx, err := beginIdentityRead(ctx, pool, identityA)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		var own, foreign int
		err = tx.QueryRow(ctx, `
			SELECT count(*) FILTER (WHERE school_id = $1::uuid),
			       count(*) FILTER (WHERE school_id = $2::uuid)
			FROM almas.school_memberships`, schoolA, schoolB).Scan(&own, &foreign)
		if err != nil || own != 2 || foreign != 0 {
			t.Fatalf("unexpected RLS counts own=%d foreign=%d: %v", own, foreign, err)
		}
	})
	t.Run("identity is cleared on pool reuse", func(t *testing.T) {
		var accounts, memberships int
		err := pool.QueryRow(ctx, `
			SELECT (SELECT count(*) FROM almas.users),
			       (SELECT count(*) FROM almas.school_memberships)`).Scan(&accounts, &memberships)
		if err != nil || accounts != 0 || memberships != 0 {
			t.Fatalf("unscoped read visible accounts=%d memberships=%d: %v", accounts, memberships, err)
		}
	})
	t.Run("HTTP session ignores client school and role", func(t *testing.T) {
		handler, err := NewValidatedHandler(postgresSessionProbe{sessions: service}, func(_ context.Context, input *openapi3filter.AuthenticationInput) error {
			req := input.RequestValidationInput.Request
			*req = *req.WithContext(context.WithValue(req.Context(), identityContextKey{}, identityA))
			return nil
		})
		if err != nil {
			t.Fatal(err)
		}
		request := httptest.NewRequest(http.MethodGet, "/api/v1/session", nil).WithContext(ctx)
		request.Header.Set("X-School-ID", schoolB)
		request.Header.Set("X-Role", "school-admin")
		result := httptest.NewRecorder()
		handler.ServeHTTP(result, request)
		var session Session
		if result.Code != http.StatusOK || json.Unmarshal(result.Body.Bytes(), &session) != nil {
			t.Fatalf("session endpoint failed: %d", result.Code)
		}
		want := []Membership{{SchoolId: schoolA, Roles: []MembershipRoles{Student, Teacher}}}
		if !reflect.DeepEqual(session.Memberships, want) {
			t.Fatalf("unexpected HTTP session memberships: %+v", session.Memberships)
		}
	})
}
