package learningapi

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

type sessionIdentityProbe struct {
	StrictServerInterface
	identity VerifiedIdentity
	calls    int
}

func (probe *sessionIdentityProbe) GetSession(ctx context.Context, _ GetSessionRequestObject) (GetSessionResponseObject, error) {
	probe.calls++
	probe.identity, _ = IdentityFromContext(ctx)
	return GetSession200JSONResponse{UserId: "00000000-0000-4000-8000-000000000001", Memberships: []Membership{}}, nil
}

func TestKeycloakAuthenticationAtHTTPBoundary(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	otherKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	issuerServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		issuer := "http://" + r.Host + "/realms/almas-local"
		switch r.URL.Path {
		case "/realms/almas-local/.well-known/openid-configuration":
			_ = json.NewEncoder(w).Encode(map[string]any{"issuer": issuer, "jwks_uri": issuer + "/certs"})
		case "/realms/almas-local/certs":
			_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
				"kid": "test", "kty": "RSA", "use": "sig", "alg": "RS256",
				"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
				"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
			}}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer issuerServer.Close()
	issuer := issuerServer.URL + "/realms/almas-local"
	auth, err := NewKeycloakAuthenticator(context.Background(), issuer, "almas-api", "almas-web-local")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	for _, tc := range []struct {
		name, claim string
		value       any
		key         *rsa.PrivateKey
		status      int
	}{
		{"valid access token", "", nil, key, 200},
		{"wrong signature", "", nil, otherKey, 401},
		{"wrong issuer", "iss", issuer + "-other", key, 401},
		{"wrong audience", "aud", "other-api", key, 401},
		{"expired", "exp", now.Add(-time.Minute).Unix(), key, 401},
		{"not yet valid", "nbf", now.Add(time.Minute).Unix(), key, 401},
		{"ID token substitution", "typ", "ID", key, 401},
		{"wrong authorized client", "azp", "other-client", key, 401},
		{"empty subject", "sub", "", key, 401},
		{"unsigned token", "", nil, nil, 401},
		{"missing token", "", nil, key, 401},
		{"duplicate authorization", "", nil, key, 401},
	} {
		t.Run(tc.name, func(t *testing.T) {
			claims := map[string]any{
				"iss": issuer, "sub": "synthetic-student", "aud": []string{"almas-api", "account"},
				"azp": "almas-web-local", "typ": "Bearer", "exp": now.Add(time.Minute).Unix(),
				"realm_access": map[string]any{"roles": []string{"school-admin"}},
			}
			if tc.claim != "" {
				claims[tc.claim] = tc.value
			}
			token := signTestToken(t, claims, tc.key)
			probe := &sessionIdentityProbe{}
			handler, err := NewValidatedHandler(probe, auth)
			if err != nil {
				t.Fatal(err)
			}
			request := httptest.NewRequest(http.MethodGet, "/api/v1/session", nil)
			if tc.name != "missing token" {
				request.Header.Set("Authorization", "Bearer "+token)
			}
			if tc.name == "duplicate authorization" {
				request.Header.Add("Authorization", "Bearer "+token)
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != tc.status {
				t.Fatalf("status = %d, want %d: %s", response.Code, tc.status, response.Body)
			}
			if tc.status == 200 {
				if probe.calls != 1 || probe.identity != (VerifiedIdentity{Issuer: issuer, Subject: "synthetic-student"}) {
					t.Fatal("verified identity was not passed to the service")
				}
			} else if probe.calls != 0 {
				t.Fatal("invalid identity reached the service")
			}
		})
	}
}

func signTestToken(t *testing.T, claims map[string]any, key *rsa.PrivateKey) string {
	t.Helper()
	header := `{"alg":"RS256","kid":"test","typ":"JWT"}`
	if key == nil {
		header = `{"alg":"none","typ":"JWT"}`
	}
	payload, err := json.Marshal(claims)
	if err != nil {
		t.Fatal(err)
	}
	input := base64.RawURLEncoding.EncodeToString([]byte(header)) + "." + base64.RawURLEncoding.EncodeToString(payload)
	if key == nil {
		return input + "."
	}
	digest := sha256.Sum256([]byte(input))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	if err != nil {
		t.Fatal(err)
	}
	return input + "." + base64.RawURLEncoding.EncodeToString(signature)
}

// TestKeycloakIssuedTokens is opt-in. The local PKCE probe supplies synthetic
// tokens in the child process environment and never writes them to the log.
func TestKeycloakIssuedTokens(t *testing.T) {
	issuer := os.Getenv("ALMAS_OIDC_TEST_ISSUER")
	if issuer == "" {
		t.Skip("requires isolated Keycloak PKCE fixture")
	}
	auth, err := NewKeycloakAuthenticator(context.Background(), issuer, "almas-api", "almas-web-local")
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name, env string
		status    int
	}{
		{"access token", "ALMAS_OIDC_TEST_ACCESS", http.StatusOK},
		{"ID token", "ALMAS_OIDC_TEST_ID", http.StatusUnauthorized},
	} {
		t.Run(tc.name, func(t *testing.T) {
			token := os.Getenv(tc.env)
			if token == "" {
				t.Fatal("missing test token")
			}
			probe := &sessionIdentityProbe{}
			handler, err := NewValidatedHandler(probe, auth)
			if err != nil {
				t.Fatal(err)
			}
			req := httptest.NewRequest(http.MethodGet, "/api/v1/session", nil)
			req.Header.Set("Authorization", "Bearer "+token)
			res := httptest.NewRecorder()
			handler.ServeHTTP(res, req)
			if res.Code != tc.status {
				t.Fatalf("status = %d, want %d", res.Code, tc.status)
			}
			if tc.status == http.StatusOK && (probe.calls != 1 || probe.identity.Issuer != issuer || probe.identity.Subject == "") {
				t.Fatal("missing verified Keycloak identity")
			}
			if tc.status != http.StatusOK && probe.calls != 0 {
				t.Fatal("rejected token reached service")
			}
		})
	}
}
