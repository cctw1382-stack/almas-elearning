package sandbox

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBilling(t *testing.T) {
	key := bytes.Repeat([]byte{1}, 32)
	billing := NewBilling(key)
	if !billing.Open("order", "school", "student") {
		t.Fatal("open order")
	}
	send := func(body string, valid bool) int {
		r := httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(body))
		mac := hmac.New(sha256.New, key)
		mac.Write([]byte(body))
		if valid {
			r.Header.Set("X-Sandbox-Signature", hex.EncodeToString(mac.Sum(nil)))
		}
		w := httptest.NewRecorder()
		billing.ServeHTTP(w, r)
		return w.Code
	}
	paid := `{"id":"evt-1","order":"order","state":"paid"}`
	if send(paid, false) != 401 || billing.Access("school", "student") {
		t.Fatal("unsigned payment accepted")
	}
	for range 10 {
		if send(paid, true) != 204 {
			t.Fatal("paid retry failed")
		}
	}
	if billing.Applied() != 1 || !billing.Access("school", "student") || billing.Access("other", "student") {
		t.Fatal("duplicate effect or invalid access")
	}
	if send(`{"id":"evt-1","order":"order","state":"refunded"}`, true) != 409 {
		t.Fatal("changed duplicate accepted")
	}
	if send(`{"id":"evt-2","order":"order","state":"refunded"}`, true) != 204 || billing.Access("school", "student") {
		t.Fatal("refund must revoke access")
	}
	billing.Open("other", "school", "student")
	if send(`{"id":"evt-3","order":"other","state":"failed"}`, true) != 204 || billing.Access("school", "student") {
		t.Fatal("failure must not grant access")
	}
}
