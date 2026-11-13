package main

import (
	"context"
	"encoding/hex"
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/cctw1382-stack/almas-elearning/apps/api/internal/learningapi"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	config, err := pgxpool.ParseConfig(os.Getenv("ALMAS_DATABASE_URL"))
	if err != nil {
		log.Fatal("invalid PostgreSQL configuration")
	}
	config.MaxConns = 8
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		log.Fatal("cannot initialize pool")
	}
	defer pool.Close()
	auth, err := learningapi.NewKeycloakAuthenticator(ctx, os.Getenv("ALMAS_ISSUER"), "almas-api", "almas-web-local")
	if err != nil {
		log.Fatal("OIDC discovery failed")
	}
	api, err := learningapi.NewPostgresLearningHandler(pool, auth)
	if err != nil {
		log.Fatal("cannot configure learning API")
	}
	role := os.Getenv("ALMAS_SERVICE")
	var handler http.Handler
	switch role {
	case "api":
		handler = api
	case "media":
		key, err := hex.DecodeString(os.Getenv("ALMAS_MEDIA_SIGNING_KEY"))
		if err != nil {
			log.Fatal("invalid media signing configuration")
		}
		root, err := os.OpenRoot(os.Getenv("ALMAS_MEDIA_ROOT"))
		if err != nil {
			log.Fatal("cannot open media root")
		}
		defer root.Close()
		handler, err = learningapi.NewPostgresMediaHandler(pool, key, 5*time.Minute, auth,
			func(_ context.Context, object learningapi.MediaObject) (learningapi.MediaReader, error) {
				if strings.Contains(object.Key, "\\") || !filepath.IsLocal(filepath.FromSlash(object.Key)) {
					return nil, errors.New("invalid media object key")
				}
				return root.Open(filepath.FromSlash(object.Key))
			})
		if err != nil {
			log.Fatal("cannot configure media handler")
		}
	default:
		log.Fatal("ALMAS_SERVICE must be api or media")
	}
	mux := http.NewServeMux()
	mux.Handle("/", handler)
	mux.HandleFunc("GET /live", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	mux.HandleFunc("GET /ready", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), time.Second)
		defer cancel()
		if pool.Ping(ctx) != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	server := &http.Server{Addr: ":8080", Handler: mux, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 60 * time.Second, IdleTimeout: 60 * time.Second}
	log.Fatal(server.ListenAndServe())
}
