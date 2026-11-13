package sandbox

import (
	"context"
	"errors"
	"testing"
)

type failingAI struct{ calls int }

func (f *failingAI) Generate(context.Context, string) (string, error) {
	f.calls++
	return "", errors.New("fixture error")
}

func TestAI(t *testing.T) {
	provider := &failingAI{}
	service := NewAI(provider, 3, 100, 60)
	ctx := context.Background()
	if _, err := service.Run(ctx, "s", "u", "a", "study-plan", true); !errors.Is(err, ErrAIPrivacy) {
		t.Fatal(err)
	}
	if _, err := service.Run(ctx, "s", "u", "a", "student name", false); !errors.Is(err, ErrAIPrivacy) || provider.calls != 0 {
		t.Fatal("private input reached provider")
	}
	if _, err := service.Run(ctx, "s", "u", "a", "study-plan", false); !errors.Is(err, ErrAIUnavailable) {
		t.Fatal(err)
	}
	if _, err := service.Run(ctx, "s", "u", "b", "study-plan", false); !errors.Is(err, ErrAILimit) || provider.calls != 1 {
		t.Fatal("budget or failure policy not enforced")
	}
	if rows := service.Usage("s", "u"); len(rows) != 1 || rows[0].CostMicros != 60 || !rows[0].Failed {
		t.Fatalf("unexpected ledger: %+v", rows)
	}
	if rows := service.Usage("s", "other"); len(rows) != 0 {
		t.Fatal("unexpected usage for another user")
	}
	mock := NewAI(MockAI{}, 1, 1000, 60)
	if value, err := mock.Run(ctx, "s", "u", "a", "review-lesson", false); err != nil || value == "" {
		t.Fatal("mock request failed")
	}
	if _, err := mock.Run(ctx, "s", "u", "b", "study-plan", false); !errors.Is(err, ErrAILimit) {
		t.Fatal("request limit not enforced")
	}
}
