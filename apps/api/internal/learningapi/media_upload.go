package learningapi

import (
	"bytes"
	"context"
	"errors"
	"io"
	"mime"
	"net/http"

	"github.com/google/uuid"
)

var (
	ErrUploadSize = errors.New("video exceeds upload limit")
	ErrUploadType = errors.New("unsupported video type")
)

type AuthorizeUpload func(context.Context, VerifiedIdentity, string, string) error
type StoreUpload func(context.Context, string, io.Reader) error

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
