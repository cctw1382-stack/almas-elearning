package sandbox

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"sync"
)

type paymentEvent struct {
	ID    string `json:"id"`
	Order string `json:"order"`
	State string `json:"state"`
}

type subscription struct{ school, user, state string }

// Billing is an in-memory sandbox adapter. Orders are opened by the server.
type Billing struct {
	key    []byte
	mu     sync.Mutex
	orders map[string]subscription
	events map[string]paymentEvent
}

func NewBilling(key []byte) *Billing {
	return &Billing{key: bytes.Clone(key), orders: make(map[string]subscription), events: make(map[string]paymentEvent)}
}

func (b *Billing) Open(id, school, user string) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, exists := b.orders[id]; exists || id == "" || school == "" || user == "" {
		return false
	}
	b.orders[id] = subscription{school, user, "pending"}
	return true
}

func (b *Billing) Access(school, user string) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, order := range b.orders {
		if order.school == school && order.user == user && order.state == "paid" {
			return true
		}
	}
	return false
}

func (b *Billing) Applied() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.events)
}

func (b *Billing) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 4096))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	mac := hmac.New(sha256.New, b.key)
	_, _ = mac.Write(body)
	sig, err := hex.DecodeString(r.Header.Get("X-Sandbox-Signature"))
	if len(b.key) < 32 || err != nil || !hmac.Equal(sig, mac.Sum(nil)) {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	var event paymentEvent
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&event) != nil || decoder.Decode(new(any)) != io.EOF || event.ID == "" || event.Order == "" {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	w.WriteHeader(b.apply(event))
}

func (b *Billing) apply(event paymentEvent) int {
	b.mu.Lock()
	defer b.mu.Unlock()
	if prior, ok := b.events[event.ID]; ok {
		if prior == event {
			return http.StatusNoContent
		}
		return http.StatusConflict
	}
	order, ok := b.orders[event.Order]
	if !ok {
		return http.StatusNotFound
	}
	if !(order.state == "pending" && (event.State == "paid" || event.State == "failed") ||
		order.state == "paid" && event.State == "refunded") {
		return http.StatusConflict
	}
	order.state = event.State
	b.orders[event.Order], b.events[event.ID] = order, event
	return http.StatusNoContent
}
