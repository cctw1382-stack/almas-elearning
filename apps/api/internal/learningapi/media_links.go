package learningapi

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/google/uuid"
)

var ErrMediaUnavailable = errors.New("media unavailable")

type MediaObject struct {
	Key, ContentType string
}

type MediaReader interface {
	io.ReadSeeker
	io.Closer
}

type ResolveMedia func(context.Context, VerifiedIdentity, string, string) (MediaObject, error)
type OpenMedia func(context.Context, MediaObject) (MediaReader, error)
type MediaProgress func(context.Context, VerifiedIdentity, string, string, *int) (int, error)

// NewMediaHandler issues relative playback URLs for the authenticated learner.
// The signing key is supplied by the host, and media access is rechecked on every request.
func NewMediaHandler(key []byte, ttl time.Duration, now func() time.Time, authenticate openapi3filter.AuthenticationFunc, resolve ResolveMedia, open OpenMedia, progress MediaProgress) (http.Handler, error) {
	if len(key) < 32 || ttl < time.Second || ttl > 15*time.Minute || now == nil || authenticate == nil || resolve == nil || open == nil {
		return nil, errors.New("invalid media handler configuration")
	}
	signingKey := append([]byte(nil), key...)
	signature := func(identity VerifiedIdentity, school, asset string, expires string) []byte {
		payload, _ := json.Marshal([6]string{"almas-media-v1", identity.Issuer, identity.Subject, school, asset, expires})
		mac := hmac.New(sha256.New, signingKey)
		_, _ = mac.Write(payload)
		return mac.Sum(nil)
	}
	protect := func(handler func(http.ResponseWriter, *http.Request, VerifiedIdentity, string, string)) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "private, no-store")
			w.Header().Set("Referrer-Policy", "no-referrer")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			school, asset := r.PathValue("school"), r.PathValue("asset")
			if r.URL.EscapedPath() != r.URL.Path || !validMediaID(school) || !validMediaID(asset) {
				writeProblem(w, http.StatusNotFound, NotFound, "الفيديو غير متاح.")
				return
			}
			input := &openapi3filter.AuthenticationInput{
				RequestValidationInput: &openapi3filter.RequestValidationInput{Request: r},
				SecuritySchemeName:     "bearerAuth",
			}
			err := authenticate(r.Context(), input)
			identity, ok := IdentityFromContext(r.Context())
			if err != nil || !ok {
				w.Header().Set("WWW-Authenticate", "Bearer")
				writeProblem(w, http.StatusUnauthorized, Unauthenticated, "تعذر التحقق من الهوية.")
				return
			}
			handler(w, r, identity, school, asset)
		}
	}
	lookup := func(w http.ResponseWriter, r *http.Request, identity VerifiedIdentity, school, asset string) (MediaObject, bool) {
		object, err := resolve(r.Context(), identity, school, asset)
		switch {
		case errors.Is(err, ErrMediaUnavailable):
			writeProblem(w, http.StatusNotFound, NotFound, "الفيديو غير متاح.")
		case err != nil:
			writeProblem(w, http.StatusInternalServerError, Unavailable, "تعذر إكمال الطلب.")
		}
		return object, err == nil
	}
	const prefix = "/api/v1/schools/"
	const pattern = prefix + "{school}/media/{asset}"
	mux := http.NewServeMux()
	if progress != nil {
		handler := protect(func(w http.ResponseWriter, r *http.Request, identity VerifiedIdentity, school, asset string) {
			var input struct {
				Position *int `json:"positionMs"`
			}
			if r.Method == http.MethodPut {
				decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 256))
				decoder.DisallowUnknownFields()
				if decoder.Decode(&input) != nil || input.Position == nil || *input.Position < 0 ||
					*input.Position > 86400000 || decoder.Decode(new(any)) != io.EOF {
					writeProblem(w, http.StatusBadRequest, InvalidRequest, "موضع الفيديو غير صالح.")
					return
				}
			}
			position, err := progress(r.Context(), identity, school, asset, input.Position)
			if errors.Is(err, ErrMediaUnavailable) {
				writeProblem(w, http.StatusNotFound, NotFound, "الفيديو غير متاح.")
				return
			}
			if err != nil {
				writeProblem(w, http.StatusInternalServerError, Unavailable, "تعذر حفظ تقدم الفيديو.")
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]int{"positionMs": position})
		})
		mux.Handle("GET "+pattern+"/progress", handler)
		mux.Handle("PUT "+pattern+"/progress", handler)
	}
	mux.HandleFunc("POST "+pattern+"/link", protect(func(w http.ResponseWriter, r *http.Request, identity VerifiedIdentity, school, asset string) {
		if _, ok := lookup(w, r, identity, school, asset); !ok {
			return
		}
		expires := strconv.FormatInt(now().Add(ttl).UnixMilli(), 10)
		params := url.Values{"exp": {expires}, "sig": {base64.RawURLEncoding.EncodeToString(signature(identity, school, asset, expires))}}
		location := prefix + school + "/media/" + asset + "/play?" + params.Encode()
		w.Header().Set("Location", location)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(struct {
			URL string `json:"url"`
		}{URL: location})
	}))
	mux.HandleFunc("GET "+pattern+"/play", protect(func(w http.ResponseWriter, r *http.Request, identity VerifiedIdentity, school, asset string) {
		query, err := url.ParseQuery(r.URL.RawQuery)
		segment := query.Get("segment")
		if err != nil || len(query["exp"]) != 1 || len(query["sig"]) != 1 ||
			(len(query) != 2 && (len(query) != 3 || len(query["segment"]) != 1 || !mediaSegment.MatchString(segment))) {
			writeProblem(w, http.StatusNotFound, NotFound, "الفيديو غير متاح.")
			return
		}
		exp := query.Get("exp")
		expires, expErr := strconv.ParseInt(exp, 10, 64)
		got, sigErr := base64.RawURLEncoding.Strict().DecodeString(query.Get("sig"))
		if expErr != nil || sigErr != nil || expires <= now().UnixMilli() || !hmac.Equal(got, signature(identity, school, asset, exp)) {
			writeProblem(w, http.StatusNotFound, NotFound, "الفيديو غير متاح.")
			return
		}
		object, ok := lookup(w, r, identity, school, asset)
		if !ok {
			return
		}
		if segment != "" {
			if object.ContentType != "application/vnd.apple.mpegurl" {
				writeProblem(w, http.StatusNotFound, NotFound, "الفيديو غير متاح.")
				return
			}
			object = MediaObject{Key: path.Join(path.Dir(object.Key), segment), ContentType: "video/mp2t"}
		}
		reader, err := open(r.Context(), object)
		if err != nil {
			writeProblem(w, http.StatusServiceUnavailable, Unavailable, "تعذر فتح الفيديو.")
			return
		}
		defer reader.Close()
		w.Header().Set("Content-Type", object.ContentType)
		if object.ContentType == "application/vnd.apple.mpegurl" {
			data, err := io.ReadAll(io.LimitReader(reader, 65537))
			if err != nil {
				writeProblem(w, http.StatusServiceUnavailable, Unavailable, "تعذر فتح قائمة الفيديو.")
				return
			}
			playlist, err := signMediaPlaylist(data, r.URL.Path+"?"+r.URL.RawQuery)
			if err != nil {
				writeProblem(w, http.StatusServiceUnavailable, Unavailable, "قائمة الفيديو غير صالحة.")
				return
			}
			_, _ = w.Write(playlist)
			return
		}
		http.ServeContent(w, r, "", time.Time{}, reader)
	}))
	return mux, nil
}

var mediaSegment = regexp.MustCompile(`^segment-[0-9]{1,9}\.ts$`)

// signMediaPlaylist accepts single-rendition MPEG-TS playlists from a trusted converter.
func signMediaPlaylist(data []byte, playback string) ([]byte, error) {
	lines := strings.Split(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n")
	if len(data) > 65536 || len(lines) == 0 || lines[0] != "#EXTM3U" {
		return nil, ErrMediaUnavailable
	}
	for i, line := range lines {
		switch {
		case line == "":
		case mediaSegment.MatchString(line) && path.Base(line) == line:
			lines[i] = playback + "&segment=" + line
		case line == "#EXTM3U", line == "#EXT-X-ENDLIST", line == "#EXT-X-INDEPENDENT-SEGMENTS",
			strings.HasPrefix(line, "#EXTINF:"),
			strings.HasPrefix(line, "#EXT-X-VERSION:"),
			strings.HasPrefix(line, "#EXT-X-TARGETDURATION:"),
			strings.HasPrefix(line, "#EXT-X-MEDIA-SEQUENCE:"),
			line == "#EXT-X-PLAYLIST-TYPE:VOD":
		default:
			return nil, ErrMediaUnavailable
		}
	}
	return []byte(strings.Join(lines, "\n")), nil
}

func validMediaID(value string) bool {
	id, err := uuid.Parse(value)
	return err == nil && id.String() == value
}
