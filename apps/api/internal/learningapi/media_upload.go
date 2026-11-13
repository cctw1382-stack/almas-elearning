package learningapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/google/uuid"
)

var (
	ErrUploadSize = errors.New("video exceeds upload limit")
	ErrUploadType = errors.New("unsupported video type")
)

type AuthorizeUpload func(context.Context, VerifiedIdentity, string, string) error
type StoreUpload func(context.Context, string, io.Reader) error

func NewMediaUploadHandler(limit int64, authenticate openapi3filter.AuthenticationFunc, authorize AuthorizeUpload, store StoreUpload) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/schools/{school}/lessons/{lesson}/media", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		input := &openapi3filter.AuthenticationInput{
			RequestValidationInput: &openapi3filter.RequestValidationInput{Request: r},
			SecuritySchemeName:     "bearerAuth",
		}
		err := authenticate(r.Context(), input)
		actor, ok := IdentityFromContext(r.Context())
		if err != nil || !ok {
			writeProblem(w, http.StatusUnauthorized, Unauthenticated, "تعذر التحقق من الهوية.")
			return
		}
		key, err := UploadMP4(r.Context(), actor, r.PathValue("school"), r.PathValue("lesson"),
			r.Header.Get("Content-Type"), limit, r.Body, authorize, store)
		switch {
		case errors.Is(err, ErrMediaUnavailable):
			writeProblem(w, http.StatusNotFound, NotFound, "الدرس غير متاح.")
		case errors.Is(err, ErrUploadSize):
			writeProblem(w, http.StatusRequestEntityTooLarge, InvalidRequest, "حجم الفيديو يتجاوز الحد.")
		case errors.Is(err, ErrUploadType):
			writeProblem(w, http.StatusUnsupportedMediaType, InvalidRequest, "نوع الفيديو غير مدعوم.")
		case err != nil:
			writeProblem(w, http.StatusServiceUnavailable, Unavailable, "تعذر حفظ الفيديو.")
		default:
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]string{"uploadId": key})
		}
	})
	return mux
}

// UploadMP4 accepts only a bounded MP4 source. Store must publish atomically
// after consuming the whole reader. The generated object key ignores filenames.
func UploadMP4(ctx context.Context, actor VerifiedIdentity, school, lesson, contentType string, limit int64, source io.Reader, authorize AuthorizeUpload, store StoreUpload) (string, error) {
	if actor.Issuer == "" || actor.Subject == "" || !validMediaID(school) || !validMediaID(lesson) {
		return "", ErrMediaUnavailable
	}
	if err := authorize(ctx, actor, school, lesson); err != nil {
		return "", err
	}
	kind, _, err := mime.ParseMediaType(contentType)
	if err != nil || kind != "video/mp4" {
		return "", ErrUploadType
	}
	if limit < 1 || limit > 64<<20 {
		return "", ErrUploadSize
	}
	data, err := io.ReadAll(io.LimitReader(source, limit+1))
	if err != nil {
		return "", err
	}
	if int64(len(data)) > limit {
		return "", ErrUploadSize
	}
	if http.DetectContentType(data) != "video/mp4" {
		return "", ErrUploadType
	}
	key := school + "/" + lesson + "/" + uuid.NewString() + ".mp4"
	if err := store(ctx, key, bytes.NewReader(data)); err != nil {
		return "", err
	}
	return key, nil
}
