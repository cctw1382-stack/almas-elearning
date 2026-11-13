package learningapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"path"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers/legacy"
	"github.com/google/uuid"
)

const (
	apiBasePath    = "/api/v1"
	maxRequestBody = 16 * 1024
)

// NewValidatedHandler applies the embedded learning contract before dispatch.
// The caller supplies identity verification. Services enforce school access.
func NewValidatedHandler(service StrictServerInterface, authenticate openapi3filter.AuthenticationFunc) (http.Handler, error) {
	if service == nil || authenticate == nil {
		return nil, errors.New("learning API requires a service and an authenticator")
	}
	spec, err := GetSpec()
	if err != nil {
		return nil, err
	}
	// Match the generated mount path on any configured deployment host.
	spec.Servers = openapi3.Servers{&openapi3.Server{URL: apiBasePath}}
	router, err := legacy.NewRouter(spec)
	if err != nil {
		return nil, err
	}
	options := &openapi3filter.Options{AuthenticationFunc: authenticate, KeepValidatedValue: true}
	badRequest := func(w http.ResponseWriter, _ *http.Request, _ error) {
		writeProblem(w, http.StatusBadRequest, InvalidRequest, "الطلب لا يطابق عقد التعلم.")
	}
	strict := NewStrictHandlerWithOptions(service, nil, StrictHTTPServerOptions{
		RequestErrorHandlerFunc: badRequest,
		ResponseErrorHandlerFunc: func(w http.ResponseWriter, _ *http.Request, _ error) {
			writeProblem(w, http.StatusInternalServerError, Unavailable, "تعذر إكمال الطلب.")
		},
	})
	handler := HandlerWithOptions(strict, StdHTTPServerOptions{BaseURL: apiBasePath, ErrorHandlerFunc: badRequest})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		// Keep validation and net/http dispatch on the same canonical path.
		if r.URL.EscapedPath() != r.URL.Path || path.Clean(r.URL.Path) != r.URL.Path {
			badRequest(w, r, nil)
			return
		}
		route, params, err := router.FindRoute(r)
		if err != nil {
			writeProblem(w, http.StatusNotFound, NotFound, "المسار غير موجود.")
			return
		}
		if r.ContentLength > maxRequestBody {
			writeProblem(w, http.StatusRequestEntityTooLarge, InvalidRequest, "حجم الطلب يتجاوز الحد المسموح.")
			return
		}
		if route.Operation.RequestBody == nil && r.ContentLength != 0 {
			badRequest(w, r, nil)
			return
		}
		if r.Body != nil {
			body := http.MaxBytesReader(w, r.Body, maxRequestBody)
			data, readErr := io.ReadAll(body)
			_ = body.Close()
			var sizeError *http.MaxBytesError
			if errors.As(readErr, &sizeError) {
				writeProblem(w, http.StatusRequestEntityTooLarge, InvalidRequest, "حجم الطلب يتجاوز الحد المسموح.")
				return
			}
			if readErr != nil || (route.Operation.RequestBody != nil && !json.Valid(data)) {
				badRequest(w, r, nil)
				return
			}
			r.Body = io.NopCloser(bytes.NewReader(data))
		}
		input := &openapi3filter.RequestValidationInput{Request: r, PathParams: params, Route: route, Options: options}
		if err := openapi3filter.ValidateRequest(r.Context(), input); err != nil {
			var securityError *openapi3filter.SecurityRequirementsError
			switch {
			case errors.As(err, &securityError):
				w.Header().Set("WWW-Authenticate", "Bearer")
				writeProblem(w, http.StatusUnauthorized, Unauthenticated, "تعذر التحقق من الهوية.")
			default:
				badRequest(w, r, nil)
			}
			return
		}
		handler.ServeHTTP(w, r)
	}), nil
}

func writeProblem(w http.ResponseWriter, status int, code ErrorCode, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(Error{Code: code, Message: message, RequestId: uuid.NewString()})
}
