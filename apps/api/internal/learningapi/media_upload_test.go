package learningapi

import (
	"bytes"
	"context"
	"errors"
	"io"
	"strings"
	"testing"
)

func TestMediaUpload(t *testing.T) {
	actor := VerifiedIdentity{Issuer: "fixture", Subject: "owner"}
	const school = "00000000-0000-4000-8000-000000000011"
	const lesson = "00000000-0000-4000-8000-000000000071"
	video := []byte{0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm', 0, 0, 0, 0, 'i', 's', 'o', 'm', 'm', 'p', '4', '2'}
	writes := 0
	store := func(_ context.Context, key string, r io.Reader) error {
		writes++
		got, err := io.ReadAll(r)
		if err != nil || !bytes.Equal(got, video) || !strings.HasPrefix(key, school+"/") || !strings.HasSuffix(key, ".mp4") || strings.Contains(key, "..") {
			t.Fatalf("unexpected stored object: %v", err)
		}
		return nil
	}
	authorize := func(_ context.Context, who VerifiedIdentity, s, l string) error {
		if who != actor || s != school || l != lesson {
			return ErrMediaUnavailable
		}
		return nil
	}
	for _, tc := range []struct {
		name, kind string
		who        VerifiedIdentity
		data       []byte
		want       error
	}{
		{"wrong owner", "video/mp4", VerifiedIdentity{Subject: "other"}, video, ErrMediaUnavailable},
		{"unsupported type", "text/plain", actor, video, ErrUploadType},
		{"spoofed type", "video/mp4", actor, []byte("not video"), ErrUploadType},
		{"oversized", "video/mp4", actor, append(append([]byte{}, video...), 0), ErrUploadSize},
		{"valid", "video/mp4", actor, video, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := UploadMP4(context.Background(), tc.who, school, lesson, tc.kind, int64(len(video)), bytes.NewReader(tc.data), authorize, store)
			if !errors.Is(err, tc.want) {
				t.Fatalf("got %v, want %v", err, tc.want)
			}
		})
	}
	if writes != 1 {
		t.Fatalf("expected one storage write, got %d", writes)
	}
}
