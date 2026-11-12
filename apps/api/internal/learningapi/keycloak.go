package learningapi

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/getkin/kin-openapi/openapi3filter"
)

// VerifiedIdentity identifies a user independently of school membership.
type VerifiedIdentity struct {
	Issuer  string
	Subject string
}

type identityContextKey struct{}

func IdentityFromContext(ctx context.Context) (VerifiedIdentity, bool) {
	identity, ok := ctx.Value(identityContextKey{}).(VerifiedIdentity)
	return identity, ok
}

// NewKeycloakAuthenticator uses the configured realm and API audience.
// Development HTTP is restricted to numeric loopback addresses.
func NewKeycloakAuthenticator(ctx context.Context, issuer, audience, clientID string) (openapi3filter.AuthenticationFunc, error) {
	endpoint, err := url.Parse(issuer)
	if err != nil || endpoint.Host == "" || endpoint.User != nil ||
		endpoint.RawQuery != "" || endpoint.ForceQuery || endpoint.Fragment != "" ||
		(endpoint.Scheme != "https" && !(endpoint.Scheme == "http" && net.ParseIP(endpoint.Hostname()).IsLoopback())) {
		return nil, errors.New("Keycloak issuer must use HTTPS or numeric loopback HTTP")
	}
	if strings.TrimSpace(audience) == "" || strings.TrimSpace(clientID) == "" || audience == clientID {
		return nil, errors.New("Keycloak requires a separate API audience and browser client")
	}
	client := &http.Client{
		Timeout:       5 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	provider, err := oidc.NewProvider(oidc.ClientContext(ctx, client), issuer)
	if err != nil {
		return nil, fmt.Errorf("discover Keycloak provider: %w", err)
	}
	var metadata struct {
		JWKSURI string `json:"jwks_uri"`
	}
	if err := provider.Claims(&metadata); err != nil {
		return nil, fmt.Errorf("read Keycloak metadata: %w", err)
	}
	keys, err := url.Parse(metadata.JWKSURI)
	if err != nil || keys.Scheme != endpoint.Scheme || keys.Host != endpoint.Host || keys.User != nil {
		return nil, errors.New("Keycloak signing keys must be on the issuer origin")
	}
	verifier := provider.Verifier(&oidc.Config{ClientID: audience, SupportedSigningAlgs: []string{oidc.RS256}})
	invalidIdentity := errors.New("invalid Keycloak access token")
	return func(ctx context.Context, input *openapi3filter.AuthenticationInput) error {
		request := input.RequestValidationInput.Request
		values := request.Header.Values("Authorization")
		if input.SecuritySchemeName != "bearerAuth" || len(values) != 1 {
			return invalidIdentity
		}
		scheme, token, found := strings.Cut(values[0], " ")
		if !found || !strings.EqualFold(scheme, "Bearer") || token == "" || len(token) > 16*1024 ||
			strings.ContainsAny(token, " \t\r\n,") {
			return invalidIdentity
		}
		verified, err := verifier.Verify(ctx, token)
		if err != nil || strings.TrimSpace(verified.Subject) == "" || !verified.Expiry.After(time.Now()) {
			return invalidIdentity
		}
		var claims struct {
			Type      string `json:"typ"`
			ClientID  string `json:"azp"`
			NotBefore *int64 `json:"nbf"`
		}
		if err := verified.Claims(&claims); err != nil || claims.Type != "Bearer" || claims.ClientID != clientID ||
			(claims.NotBefore != nil && *claims.NotBefore > time.Now().Unix()) {
			return invalidIdentity
		}
		identity := VerifiedIdentity{Issuer: verified.Issuer, Subject: verified.Subject}
		*request = *request.WithContext(context.WithValue(request.Context(), identityContextKey{}, identity))
		return nil
	}, nil
}
