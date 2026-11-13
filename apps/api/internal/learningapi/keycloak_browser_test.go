package learningapi

import (
	"context"
	"crypto/rand"
	"io"
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
	if binary := os.Getenv("ALMAS_TEST_FFMPEG"); binary != "" {
		objects := t.TempDir()
		source := filepath.Join(objects, "source.mp4")
		generate := exec.CommandContext(ctx, binary, "-nostdin", "-loglevel", "error", "-f", "lavfi", "-i",
			"color=blue:s=160x90:r=10", "-t", "5", "-c:v", "libx264", source)
		if output, err := generate.CombinedOutput(); err != nil {
			t.Fatalf("generate video fixture: %v %s", err, output)
		}
		store := func(_ context.Context, key string, body io.Reader) error {
			target := filepath.Join(objects, filepath.FromSlash(key))
			if err := os.MkdirAll(filepath.Dir(target), 0700); err != nil {
				return err
			}
			file, err := os.Create(target)
			if err != nil {
				return err
			}
			_, copyErr := io.Copy(file, body)
			closeErr := file.Close()
			if copyErr != nil {
				return copyErr
			}
			return closeErr
		}
		open := func(_ context.Context, object MediaObject) (MediaReader, error) {
			return os.Open(filepath.Join(objects, filepath.FromSlash(object.Key)))
		}
		key := make([]byte, 32)
		rand.Read(key)
		media, err := NewPostgresMediaHandler(pool, key, 8*time.Second, auth, open)
		if err != nil {
			t.Fatal(err)
		}
		mux.Handle("/api/v1/schools/{school}/media/{asset}/{operation}", media)
		convert := FFmpegConverter(binary)
		mux.Handle("/api/v1/schools/{school}/lessons/{lesson}/media", NewPostgresMediaIngestHandler(pool, 1<<20, auth,
			func(ctx context.Context, source, dir string) error {
				err := convert(ctx, source, dir)
				if err != nil {
					t.Logf("fixture converter: %v", err)
				}
				return err
			}, store))
		mux.HandleFunc("GET /fixture/source", func(w http.ResponseWriter, r *http.Request) { http.ServeFile(w, r, source) })
		mux.HandleFunc("GET /student/video", func(w http.ResponseWriter, r *http.Request) { http.ServeFile(w, r, filepath.Join(dist, "index.html")) })
	}
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
