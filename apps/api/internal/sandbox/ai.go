package sandbox

import (
	"context"
	"errors"
	"sync"
)

type AiProvider interface {
	Generate(context.Context, string) (string, error)
}

type MockAI struct{}

func (MockAI) Generate(_ context.Context, _ string) (string, error) {
	return "مراجعة تعليمية تجريبية", nil
}

var (
	ErrAIPrivacy     = errors.New("AI request blocked by privacy policy")
	ErrAILimit       = errors.New("AI sandbox quota exceeded")
	ErrAIUnavailable = errors.New("AI sandbox provider unavailable")
)

type AIUsage struct {
	School, User, Request string
	CostMicros            int64
	Failed                bool
}

type AI struct {
	mu                sync.Mutex
	provider          AiProvider
	maxRequests       int
	budget, fixedCost int64
	log               []AIUsage
}

func NewAI(provider AiProvider, maxRequests int, budget, fixedCost int64) *AI {
	return &AI{provider: provider, maxRequests: maxRequests, budget: budget, fixedCost: fixedCost}
}

// Run receives caller attributes from the server. The sandbox accepts only
// predefined topics, so arbitrary learner text never reaches the provider.
func (a *AI) Run(ctx context.Context, school, user, request, topic string, minor bool) (string, error) {
	if minor || (topic != "study-plan" && topic != "review-lesson") {
		return "", ErrAIPrivacy
	}
	a.mu.Lock()
	count := 0
	var spent int64
	for _, usage := range a.log {
		if usage.School == school && usage.User == user {
			if usage.Request == request {
				a.mu.Unlock()
				return "", ErrAILimit
			}
			count++
			spent += usage.CostMicros
		}
	}
	if school == "" || user == "" || request == "" || a.provider == nil || a.fixedCost <= 0 ||
		count >= a.maxRequests || a.budget < a.fixedCost || spent > a.budget-a.fixedCost {
		a.mu.Unlock()
		return "", ErrAILimit
	}
	index := len(a.log)
	a.log = append(a.log, AIUsage{School: school, User: user, Request: request, CostMicros: a.fixedCost})
	a.mu.Unlock()
	result, err := a.provider.Generate(ctx, topic)
	if err != nil {
		a.mu.Lock()
		a.log[index].Failed = true
		a.mu.Unlock()
		return "", ErrAIUnavailable
	}
	return result, nil
}

func (a *AI) Usage(school, user string) []AIUsage {
	a.mu.Lock()
	defer a.mu.Unlock()
	var rows []AIUsage
	for _, usage := range a.log {
		if usage.School == school && usage.User == user {
			rows = append(rows, usage)
		}
	}
	return rows
}
