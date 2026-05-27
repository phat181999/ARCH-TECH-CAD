package middleware

import (
	"context"
	"net/http"

	"autocard-backend/repository"
)

type roleContextKey string

const OrgRoleKey roleContextKey = "orgRole"

func RequireSystemAdmin(userRepo *repository.UserRepo) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := r.Context().Value(UserIDKey).(string)
			if !ok {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			user, err := userRepo.FindByID(userID)
			if err != nil {
				http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
				return
			}

			if user.SystemRole != "system_admin" {
				http.Error(w, `{"error":"forbidden: requires system administrator status"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func RequireOrgRole(userRepo *repository.UserRepo, orgRepo *repository.OrganizationRepo, minRole string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := r.Context().Value(UserIDKey).(string)
			if !ok {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			// PathValue "id" represents organization ID in organizations endpoints
			orgID := r.PathValue("id")
			if orgID == "" {
				orgID = r.URL.Query().Get("orgId")
			}

			// System Admins bypass all organization checks
			user, err := userRepo.FindByID(userID)
			if err == nil && user.SystemRole == "system_admin" {
				ctx := context.WithValue(r.Context(), OrgRoleKey, "system_admin")
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			if orgID == "" {
				http.Error(w, `{"error":"missing organization id"}`, http.StatusBadRequest)
				return
			}

			member, err := orgRepo.GetUserMembership(orgID, userID)
			if err != nil {
				http.Error(w, `{"error":"forbidden: not a member of this organization"}`, http.StatusForbidden)
				return
			}

			// Role hierarchy: owner > editor > viewer
			hasAccess := false
			switch minRole {
			case "viewer":
				hasAccess = member.Role == "owner" || member.Role == "editor" || member.Role == "viewer"
			case "editor":
				hasAccess = member.Role == "owner" || member.Role == "editor"
			case "owner":
				hasAccess = member.Role == "owner"
			}

			if !hasAccess {
				http.Error(w, `{"error":"forbidden: insufficient organization privileges"}`, http.StatusForbidden)
				return
			}

			ctx := context.WithValue(r.Context(), OrgRoleKey, member.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
