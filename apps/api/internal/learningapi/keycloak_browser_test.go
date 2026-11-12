package learningapi

import (
	"context"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestKeycloakBrowser(t *testing.T) {
	if os.Getenv("ALMAS_TEST_BROWSER") != "1" {
		t.Skip("requires isolated Keycloak, PostgreSQL and Chromium fixtures")
	}
	issuer, dsn := os.Getenv("ALMAS_OIDC_TEST_ISSUER"), os.Getenv("ALMAS_TEST_DATABASE_URL")
	password := os.Getenv("ALMAS_OIDC_PROBE_PASSWORD")
	if issuer == "" || dsn == "" || password == "" {
		t.Fatal("browser fixture configuration missing")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal("configure browser fixture pool")
	}
	defer pool.Close()
	auth, err := NewKeycloakAuthenticator(ctx, issuer, "almas-api", "almas-web-local")
	if err != nil {
		t.Fatal(err)
	}
	api, err := NewPostgresLearningHandler(pool, auth)
	if err != nil {
		t.Fatal(err)
	}
	root, err := filepath.Abs("../../../..")
	if err != nil {
		t.Fatal(err)
	}
	dist := t.TempDir()
	build := exec.CommandContext(ctx, "node", "node_modules/vite/bin/vite.js", "build", "--outDir", dist)
	build.Dir = filepath.Join(root, "apps", "web")
	build.Env = append(os.Environ(), "VITE_ALMAS_ISSUER="+issuer, "VITE_ALMAS_CLIENT_ID=almas-web-local", "VITE_ALMAS_API_BASE=/api/v1/")
	if output, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build browser fixture: %v\n%s", err, output)
	}
	listener, err := net.Listen("tcp", "127.0.0.1:4174")
	if err != nil {
		t.Fatalf("browser fixture requires an available port 4174: %v", err)
	}
	mux := http.NewServeMux()
	mux.Handle("/api/v1/", api)
	mux.HandleFunc("GET /student/exam", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, filepath.Join(dist, "index.html"))
	})
	mux.HandleFunc("GET /auth/callback", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		http.ServeFile(w, r, filepath.Join(dist, "index.html"))
	})
	mux.Handle("/assets/", http.FileServer(http.Dir(dist)))
	server := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go server.Serve(listener)
	defer server.Close()
	browser := exec.CommandContext(ctx, "node", filepath.Join(root, "tests", "phase3", "keycloak-browser.cjs"))
	if output, err := browser.CombinedOutput(); err != nil {
		t.Fatalf("Chromium fixture: %v\n%s", err, output)
	} else {
		t.Log(string(output))
	}
}
