package services

import (
	"context"
	"testing"
	"time"

	"github.com/CreoCot/enose-core/backend/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeUserRepo и fakeRefreshTokenRepo — in-memory реализации репозиториев,
// достаточные для тестирования RefreshSession без поднятия БД.

type fakeUserRepo struct {
	byID map[int]*models.User
}

func (f *fakeUserRepo) FindByUsername(ctx context.Context, username string) (*models.User, error) {
	for _, u := range f.byID {
		if u.Username == username {
			return u, nil
		}
	}
	return nil, nil
}

func (f *fakeUserRepo) FindByID(ctx context.Context, id int) (*models.User, error) {
	return f.byID[id], nil
}

func (f *fakeUserRepo) Create(ctx context.Context, user *models.User) error {
	user.ID = len(f.byID) + 1
	f.byID[user.ID] = user
	return nil
}

type fakeRefreshTokenRepo struct {
	byID   map[int]*models.RefreshToken
	nextID int
}

func newFakeRefreshTokenRepo() *fakeRefreshTokenRepo {
	return &fakeRefreshTokenRepo{byID: map[int]*models.RefreshToken{}}
}

func (f *fakeRefreshTokenRepo) Create(ctx context.Context, token *models.RefreshToken) error {
	f.nextID++
	token.ID = f.nextID
	f.byID[token.ID] = token
	return nil
}

func (f *fakeRefreshTokenRepo) FindByHash(ctx context.Context, hash string) (*models.RefreshToken, error) {
	for _, t := range f.byID {
		if t.TokenHash == hash {
			return t, nil
		}
	}
	return nil, nil
}

func (f *fakeRefreshTokenRepo) Revoke(ctx context.Context, id int) error {
	if t, ok := f.byID[id]; ok {
		now := time.Now()
		t.RevokedAt = &now
	}
	return nil
}

func (f *fakeRefreshTokenRepo) RevokeAllForUser(ctx context.Context, userID int) error {
	now := time.Now()
	for _, t := range f.byID {
		if t.UserID == userID && t.RevokedAt == nil {
			t.RevokedAt = &now
		}
	}
	return nil
}

func newTestAuthService() (*authService, *fakeRefreshTokenRepo, int) {
	users := &fakeUserRepo{byID: map[int]*models.User{
		1: {ID: 1, Username: "alice", Role: RoleOperator},
	}}
	tokens := newFakeRefreshTokenRepo()
	svc := &authService{
		users:         users,
		refreshTokens: tokens,
		jwtSecret:     []byte("test-secret"),
		tokenTTL:      time.Hour,
	}
	return svc, tokens, 1
}

func TestRefreshSession_RotatesToken(t *testing.T) {
	svc, tokens, userID := newTestAuthService()

	raw, err := svc.IssueRefreshToken(context.Background(), userID)
	require.NoError(t, err)
	require.Len(t, tokens.byID, 1)

	accessToken, newRaw, err := svc.RefreshSession(context.Background(), raw)
	require.NoError(t, err)
	assert.NotEmpty(t, accessToken)
	assert.NotEmpty(t, newRaw)
	assert.NotEqual(t, raw, newRaw)

	// Старый токен отозван, новый — активен.
	assert.Len(t, tokens.byID, 2)
	var oldRevoked, newActive bool
	for _, tok := range tokens.byID {
		if tok.UserID != userID {
			continue
		}
		if tok.RevokedAt != nil {
			oldRevoked = true
		} else {
			newActive = true
		}
	}
	assert.True(t, oldRevoked, "old token should be revoked")
	assert.True(t, newActive, "new token should be active")
}

func TestRefreshSession_ReuseOfRevokedTokenRevokesAll(t *testing.T) {
	svc, tokens, userID := newTestAuthService()

	raw, err := svc.IssueRefreshToken(context.Background(), userID)
	require.NoError(t, err)

	// Первая ротация — легитимная.
	_, secondRaw, err := svc.RefreshSession(context.Background(), raw)
	require.NoError(t, err)

	// Повторное предъявление УЖЕ отозванного (первого) токена — реюз.
	_, _, err = svc.RefreshSession(context.Background(), raw)
	assert.ErrorIs(t, err, ErrInvalidRefreshToken)

	// Реюз должен был отозвать ВСЕ токены пользователя, включая второй,
	// легитимно выданный при ротации выше.
	_, _, err = svc.RefreshSession(context.Background(), secondRaw)
	assert.ErrorIs(t, err, ErrInvalidRefreshToken)

	for _, tok := range tokens.byID {
		assert.NotNil(t, tok.RevokedAt, "all tokens for the user must be revoked after reuse detection")
	}
}

func TestRefreshSession_ExpiredTokenRejected(t *testing.T) {
	svc, tokens, userID := newTestAuthService()

	raw, hash, err := newRawRefreshToken()
	require.NoError(t, err)
	require.NoError(t, tokens.Create(context.Background(), &models.RefreshToken{
		UserID:    userID,
		TokenHash: hash,
		ExpiresAt: time.Now().Add(-time.Minute), // уже истёк
	}))

	_, _, err = svc.RefreshSession(context.Background(), raw)
	assert.ErrorIs(t, err, ErrInvalidRefreshToken)
}

func TestRefreshSession_UnknownTokenRejected(t *testing.T) {
	svc, _, _ := newTestAuthService()

	_, _, err := svc.RefreshSession(context.Background(), "not-a-real-token")
	assert.ErrorIs(t, err, ErrInvalidRefreshToken)
}

func TestRevokeRefreshToken_IsIdempotent(t *testing.T) {
	svc, tokens, userID := newTestAuthService()

	raw, err := svc.IssueRefreshToken(context.Background(), userID)
	require.NoError(t, err)

	assert.NoError(t, svc.RevokeRefreshToken(context.Background(), raw))
	assert.NoError(t, svc.RevokeRefreshToken(context.Background(), raw)) // повторный вызов — не ошибка
	assert.NoError(t, svc.RevokeRefreshToken(context.Background(), "unknown-token"))

	for _, tok := range tokens.byID {
		assert.NotNil(t, tok.RevokedAt)
	}
}
