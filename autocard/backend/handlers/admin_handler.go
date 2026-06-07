package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"autocard-backend/config"
	"autocard-backend/models"
	"autocard-backend/repository"
)

type AdminHandler struct {
	repo *repository.OrganizationRepo
	cfg  *config.Config
}

func NewAdminHandler(repo *repository.OrganizationRepo, cfg *config.Config) *AdminHandler {
	return &AdminHandler{repo: repo, cfg: cfg}
}

func (h *AdminHandler) ListOrganizations(w http.ResponseWriter, r *http.Request) {
	orgs, err := h.repo.GetAllOrganizations()
	if err != nil {
		http.Error(w, `{"error":"failed to fetch organizations"}`, http.StatusInternalServerError)
		return
	}

	if orgs == nil {
		orgs = []models.Organization{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orgs)
}

func (h *AdminHandler) UpdateSubscription(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("id")

	var req models.UpdateSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	tier := strings.ToLower(req.SubscriptionTier)
	if tier != "free" && tier != "premium" && tier != "enterprise" {
		http.Error(w, `{"error":"invalid tier, must be free, premium, or enterprise"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.UpdateSubscription(orgID, tier, req.SubscriptionExpires); err != nil {
		http.Error(w, `{"error":"failed to update subscription"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "subscription updated successfully"})
}

func (h *AdminHandler) DeleteOrganization(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("id")

	if err := h.repo.DeleteOrganization(orgID); err != nil {
		http.Error(w, `{"error":"failed to delete organization"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "organization deleted successfully"})
}

func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.repo.GetAllUsers()
	if err != nil {
		http.Error(w, `{"error":"failed to fetch users"}`, http.StatusInternalServerError)
		return
	}

	if users == nil {
		users = []models.User{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func (h *AdminHandler) UpdateSystemRole(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("id")

	var req models.UpdateSystemRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	role := strings.ToLower(req.SystemRole)
	if role != "user" && role != "system_admin" {
		http.Error(w, `{"error":"invalid system role, must be user or system_admin"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.UpdateSystemRole(userID, role); err != nil {
		http.Error(w, `{"error":"failed to update system role"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "system role updated successfully"})
}

// === PACKAGES CRUD HANDLERS ===

func (h *AdminHandler) ListPackages(w http.ResponseWriter, r *http.Request) {
	pkgs, err := h.repo.GetAllPackages()
	if err != nil {
		http.Error(w, `{"error":"failed to fetch packages"}`, http.StatusInternalServerError)
		return
	}

	if pkgs == nil {
		pkgs = []models.SubscriptionPackage{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pkgs)
}

func (h *AdminHandler) CreatePackage(w http.ResponseWriter, r *http.Request) {
	var pkg models.SubscriptionPackage
	if err := json.NewDecoder(r.Body).Decode(&pkg); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if pkg.Name == "" || pkg.Code == "" {
		http.Error(w, `{"error":"name and code are required"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.CreatePackage(&pkg); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to create package: %s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(pkg)
}

func (h *AdminHandler) UpdatePackage(w http.ResponseWriter, r *http.Request) {
	pkgID := r.PathValue("id")

	var pkg models.SubscriptionPackage
	if err := json.NewDecoder(r.Body).Decode(&pkg); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.UpdatePackage(pkgID, &pkg); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to update package: %s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "package updated successfully"})
}

func (h *AdminHandler) DeletePackage(w http.ResponseWriter, r *http.Request) {
	pkgID := r.PathValue("id")

	if err := h.repo.DeletePackage(pkgID); err != nil {
		http.Error(w, `{"error":"failed to delete package"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "package deleted successfully"})
}

func (h *AdminHandler) AssignPackage(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("id")

	var req models.AssignPackageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.PackageID == "" {
		http.Error(w, `{"error":"package_id is required"}`, http.StatusBadRequest)
		return
	}

	// 1. Fetch package detail to get duration and price
	pkgs, err := h.repo.GetAllPackages()
	if err != nil {
		http.Error(w, `{"error":"failed to load packages"}`, http.StatusInternalServerError)
		return
	}

	var targetPkg *models.SubscriptionPackage
	for i := range pkgs {
		if pkgs[i].ID == req.PackageID {
			targetPkg = &pkgs[i]
			break
		}
	}

	if targetPkg == nil {
		http.Error(w, `{"error":"package not found"}`, http.StatusNotFound)
		return
	}

	// 2. Fetch organization to get name
	orgs, err := h.repo.GetAllOrganizations()
	if err != nil {
		http.Error(w, `{"error":"failed to fetch organization"}`, http.StatusInternalServerError)
		return
	}

	var targetOrg *models.Organization
	for i := range orgs {
		if orgs[i].ID == orgID {
			targetOrg = &orgs[i]
			break
		}
	}

	if targetOrg == nil {
		http.Error(w, `{"error":"organization not found"}`, http.StatusNotFound)
		return
	}

	// 3. Compute expiration time
	expiresAt := time.Now().AddDate(0, 0, targetPkg.DurationDays)

	// 4. Update organization package and expires columns
	if err := h.repo.UpdateOrganizationPackage(orgID, targetPkg.ID, &expiresAt); err != nil {
		http.Error(w, `{"error":"failed to assign package"}`, http.StatusInternalServerError)
		return
	}

	// 5. Update fallback subscription_tier string for backward compatibility
	_ = h.repo.UpdateSubscription(orgID, targetPkg.Code, &expiresAt)

	// 6. Find organization owner & send purchase confirmation email asynchronously
	go func() {
		ownerEmail, err := h.repo.GetOrganizationOwnerEmail(orgID)
		if err != nil {
			fmt.Printf("[PURCHASE EMAIL ERROR] Failed to fetch organization owner email for org %s: %v\n", orgID, err)
			return
		}
		if ownerEmail != "" {
			h.sendPackagePurchaseEmail(ownerEmail, targetOrg.Name, targetPkg.Name, targetPkg.Price, &expiresAt)
		} else {
			fmt.Printf("[PURCHASE EMAIL Warning] No owner email resolved for organization %s\n", targetOrg.Name)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message":    "package assigned successfully",
		"expires_at": expiresAt.Format(time.RFC3339),
	})
}

func (h *AdminHandler) sendPackagePurchaseEmail(to, orgName, packageName string, price float64, expires *time.Time) {
	if h.cfg.SMTPUser == "" || h.cfg.SMTPPass == "" {
		expStr := "Lifetime"
		if expires != nil {
			expStr = expires.Format("2006-01-02")
		}
		fmt.Printf("[DEV] Subscription Purchase Email to %s: Package \"%s\" activated for Organization \"%s\" (Price: $%.2f, Expires: %s).\n", to, packageName, orgName, price, expStr)
		return
	}

	auth := smtp.PlainAuth("", h.cfg.SMTPUser, h.cfg.SMTPPass, h.cfg.SMTPHost)
	subject := "Subject: AutoCard Subscription Package Purchased!\n"
	mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"

	expStr := "Lifetime / Infinite"
	if expires != nil {
		expStr = expires.Format("2006-01-02 15:04:05 MST")
	}

	body := fmt.Sprintf(`
		<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
			<h2 style="color: #0891b2; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">AutoCard Subscription Activated!</h2>
			<p>Dear Customer,</p>
			<p>We are excited to confirm that the subscription package for your organization has been successfully activated.</p>
			<table style="width: 100%%; border-collapse: collapse; margin: 20px 0;">
				<tr style="background-color: #f8fafc;">
					<td style="padding: 10px; font-weight: bold; border: 1px solid #cbd5e1; width: 40%%;">Organization</td>
					<td style="padding: 10px; border: 1px solid #cbd5e1;">%s</td>
				</tr>
				<tr>
					<td style="padding: 10px; font-weight: bold; border: 1px solid #cbd5e1;">Package Purchased</td>
					<td style="padding: 10px; border: 1px solid #cbd5e1;">%s</td>
				</tr>
				<tr style="background-color: #f8fafc;">
					<td style="padding: 10px; font-weight: bold; border: 1px solid #cbd5e1;">Price Charged</td>
					<td style="padding: 10px; border: 1px solid #cbd5e1;">$%.2f USD</td>
				</tr>
				<tr>
					<td style="padding: 10px; font-weight: bold; border: 1px solid #cbd5e1;">Active Period Expires</td>
					<td style="padding: 10px; border: 1px solid #cbd5e1; font-family: monospace;">%s</td>
				</tr>
			</table>
			<p>Thank you for using AutoCard. If you did not authorize this transaction, please contact our support team immediately.</p>
			<p style="color: #64748b; font-size: 11px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">AutoCard CAD Systems, Inc.</p>
		</div>
	`, orgName, packageName, price, expStr)

	msg := []byte(subject + mime + body)
	err := smtp.SendMail(h.cfg.SMTPHost+":"+h.cfg.SMTPPort, auth, h.cfg.FromEmail, []string{to}, msg)
	if err != nil {
		fmt.Printf("[EMAIL ERROR] Failed to send package purchase email to %s: %v\n", to, err)
	}
}
