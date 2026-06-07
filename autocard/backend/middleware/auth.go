package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserIDKey contextKey = "userID"
const MemberIDKey contextKey = "memberID"

func Auth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, `{"error":"invalid authorization format"}`, http.StatusUnauthorized)
				return
			}

			tokenStr := parts[1]
			token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(jwtSecret), nil
			})

			if err != nil || !token.Valid {
				http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, `{"error":"invalid token claims"}`, http.StatusUnauthorized)
				return
			}

			userID, ok := claims["user_id"].(string)
			if !ok {
				http.Error(w, `{"error":"invalid user_id in token"}`, http.StatusUnauthorized)
				return
			}

			roleType, _ := claims["role_type"].(string)
			ctx := r.Context()
			if roleType == "member" {
				ctx = context.WithValue(ctx, MemberIDKey, userID)
			} else {
				ctx = context.WithValue(ctx, UserIDKey, userID)
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetPrincipalID returns the caller's ID and whether they are a member (true) or a user (false).
// Use this in handlers that should serve both users and members instead of reading context keys directly.
func GetPrincipalID(ctx context.Context) (id string, isMember bool, ok bool) {
	if v := ctx.Value(MemberIDKey); v != nil {
		return v.(string), true, true
	}
	if v := ctx.Value(UserIDKey); v != nil {
		return v.(string), false, true
	}
	return "", false, false
}

func GenerateToken(userID string, roleType string, secret string) (string, error) {
	claims := jwt.MapClaims{
		"user_id":   userID,
		"role_type": roleType,
		"exp":       time.Now().Add(24 * time.Hour).Unix(),
		"iat":       time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
