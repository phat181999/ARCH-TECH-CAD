import { create } from "zustand";

type Language = "en" | "vi";

const TRANSLATIONS = {
  en: {
    // Navigation
    dashboard: "Dashboard",
    workspaces: "Workspaces",
    assets: "Assets",
    team: "Team",
    admin: "Admin",
    settings: "Settings",

    // Sidebar
    general: "General",
    project: "Project",
    organization: "Organization",
    members: "Members",
    trash: "Trash",
    inviteMember: "Invite Member",
    adminConsole: "Admin Console",
    logOut: "Log Out",

    // General terms
    create: "Create",
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    saved: "Saved!",
    newProject: "New Project",
    loading: "Loading...",
    name: "Name",
    email: "Email",
    role: "Role",
    actions: "Actions",

    // Admin Console
    platformAdmin: "Platform Administration",
    adminSubtitle: "System admin console to manage organizations, packages, users, and member roles.",
    sysAdminTag: "System Administrator",
    tabOrgs: "Organizations",
    tabUsers: "System Users",
    tabMembers: "Org Members",
    tabPackages: "Packages",

    // Organizations Admin
    orgName: "Organization Name",
    orgId: "ID",
    subTier: "Subscription Tier",
    expPeriod: "Expiration Period",
    createdAt: "Created At",
    managePkg: "Manage Package",
    deleteOrg: "Delete Organization",
    lifetime: "Lifetime / Infinite",

    // Users Admin
    userCol: "User",
    sysRole: "System Role",
    joinedAt: "Joined At",
    demote: "Demote",
    promote: "Promote",

    // Packages Admin
    pkgName: "Package Name",
    pkgCode: "Unique Code",
    pkgPrice: "Price ($)",
    pkgDuration: "Duration (Days)",
    maxMembers: "Max Members",
    maxDrawings: "Max Drawings",
    features: "Features",
    createPkg: "Create Package",
    editPkg: "Edit Package",
    applyChanges: "Apply Changes",
    newExpiration: "Expiration Date (Active Period)",
    subPkgTier: "Subscription Package Tier",

    // Team workspace
    teamWorkspace: "Team Workspace",
    teamSubtitle: "Manage active organization members and pending invitations.",
    activeMembers: "Active Members",
    pendingInvites: "Pending Invitations (Redis TTL Capped)",
    newOrg: "New Org",
    workspaceRole: "Workspace Role",
    invitedOn: "Invited On",
    cancelInvite: "Cancel Invite",

    // Drawing Dashboard
    projectsTitle: "Projects",
    projectsSubtitle: "Last accessed within the past 7 days",
    initializeDrawing: "Initialize New Drawing",
    initializing: "Initializing...",
    workspaceHealth: "Workspace Health",
    cloudStorage: "Cloud Storage Used",
    activeProjects: "Active Projects",
    deleteDrawingConfirm: "Delete this drawing?",
    justNow: "Just now",
    minutesAgo: "m ago",
    hoursAgo: "h ago",
    daysAgo: "d ago",
    editProjectDetails: "Edit Project Details",
    projectName: "Project Name",
    projectThumbnail: "Project Thumbnail/Avatar",
    uploadThumbnail: "Upload Thumbnail Image",
    noImage: "No Image",
    enterProjectName: "Enter project name...",
    renameProject: "Rename Project",

    // Settings
    orgSettingsTitle: "Organization Settings",
    orgSettingsSubtitle: "Manage your organization's core identity, visual assets, and industry classification.",
    generalIdentity: "General Identity",
    industrySector: "Industry Sector",
    structuralEngineering: "Structural Engineering",
    architecture: "Architecture",
    mechanical: "Mechanical",
    orgLogo: "Organization Logo",
    uploadLogoHelp: "Upload a high-resolution SVG or PNG.",
    logoSizeHelp: "Recommended size: 512x512px. Max file size: 2MB.",
    removeLogo: "Remove current logo",
    storageResidency: "Data Storage & Residency",
    primaryRegion: "Primary Region",
    change: "Change",
    authRules: "Auth Rules",
    ssoRequired: "SSO Required",
    twoFAEnforced: "2FA Enforced",
    dangerZone: "Danger Zone",
    deleteOrgHelp: "Permanently delete this organization and all associated CAD assets, project histories, and member access. This action cannot be undone.",
    unsavedChanges: "Unsaved changes detected in General Identity",
    discard: "Discard",

    // Additional Team Workspace Terms
    owner: "Owner",
    editor: "Editor",
    viewer: "Viewer",
    noPendingInvites: "No pending invitations.",
    proposedRole: "Proposed Role",
    createOrgTitle: "Create New Organization",
    noOrgsFound: "No Organizations Found",
    orgNameLabel: "Organization Name",
    orgNamePlaceholder: "e.g. Acme Architecture Ltd.",
    creating: "Creating...",
    removeMemberConfirm: "Remove this member from this organization?",
    cancelInviteConfirm: "Cancel pending invitation for this email?",
    orgCreatedSuccess: "Organization created successfully.",
    memberRoleUpdated: "Member role updated.",
    memberRemovedSuccess: "Removed member from organization.",
    inviteCancelledSuccess: "Cancelled invitation.",
    selectOrgFirst: "Please select or create an organization first.",
    inspectOrgLabel: "Select Organization to Inspect",
    activeMembersInspect: "active members.",
    viewingMembersCount: "Currently viewing",

    // Admin Console Extra
    selectPlan: "— Select Plan —",
    calculatedFromCycle: "Calculated automatically from active package cycle period.",
    noOrgsRegistered: "No organizations registered yet.",
    noPackagesFound: "No packages found. Click \"Create Package\" to add one.",
    selectOrgInspect: "Select Organization to Inspect",
    currentlyViewing: "Currently viewing",
    activeMembersLower: "active members.",
    commaSeparated: "(comma separated)",
    featuresPlaceholder: "3D Drafting, DXF Import, AI Generation",
    deleteOrgConfirmAdmin: "Are you sure you want to permanently delete the organization \"{name}\"? This deletes all associated CAD data and drawings!",
    deletePkgConfirmAdmin: "Are you sure you want to delete subscription package \"{name}\"? Organizations using this package will keep their expiration dates but have no package reference.",
  },
  vi: {
    // Navigation
    dashboard: "Bảng điều khiển",
    workspaces: "Không gian làm việc",
    assets: "Tài sản",
    team: "Nhóm",
    admin: "Quản trị",
    settings: "Cài đặt",

    // Sidebar
    general: "Tổng quan",
    project: "Dự án",
    organization: "Tổ chức",
    members: "Thành viên",
    trash: "Thùng rác",
    inviteMember: "Mời thành viên",
    adminConsole: "Bảng điều khiển Admin",
    logOut: "Đăng xuất",

    // General terms
    create: "Tạo mới",
    edit: "Sửa",
    delete: "Xóa",
    cancel: "Hủy",
    save: "Lưu",
    saving: "Đang lưu...",
    saved: "Đã lưu!",
    newProject: "Dự án mới",
    loading: "Đang tải...",
    name: "Tên",
    email: "Email",
    role: "Vai trò",
    actions: "Hành động",

    // Admin Console
    platformAdmin: "Quản trị hệ thống",
    adminSubtitle: "Bảng điều khiển quản trị hệ thống quản lý tổ chức, gói dịch vụ, người dùng và vai trò thành viên.",
    sysAdminTag: "Quản trị viên hệ thống",
    tabOrgs: "Tổ chức",
    tabUsers: "Người dùng hệ thống",
    tabMembers: "Thành viên tổ chức",
    tabPackages: "Gói dịch vụ",

    // Organizations Admin
    orgName: "Tên tổ chức",
    orgId: "Mã định danh",
    subTier: "Mức dịch vụ",
    expPeriod: "Thời gian hết hạn",
    createdAt: "Ngày tạo",
    managePkg: "Quản lý gói",
    deleteOrg: "Xóa tổ chức",
    lifetime: "Trọn đời / Vô hạn",

    // Users Admin
    userCol: "Người dùng",
    sysRole: "Vai trò hệ thống",
    joinedAt: "Ngày tham gia",
    demote: "Hạ cấp",
    promote: "Thăng cấp",

    // Packages Admin
    pkgName: "Tên gói dịch vụ",
    pkgCode: "Mã định danh duy nhất",
    pkgPrice: "Giá ($)",
    pkgDuration: "Thời gian (Ngày)",
    maxMembers: "Số thành viên tối đa",
    maxDrawings: "Số bản vẽ tối đa",
    features: "Tính năng",
    createPkg: "Tạo gói dịch vụ",
    editPkg: "Sửa gói dịch vụ",
    applyChanges: "Áp dụng thay đổi",
    newExpiration: "Ngày hết hạn (Thời gian hoạt động)",
    subPkgTier: "Mức gói dịch vụ",

    // Team workspace
    teamWorkspace: "Không gian làm việc nhóm",
    teamSubtitle: "Quản lý các thành viên đang hoạt động và lời mời đang chờ xử lý.",
    activeMembers: "Thành viên đang hoạt động",
    pendingInvites: "Lời mời đang chờ (Hạn chế bởi Redis TTL)",
    newOrg: "Tổ chức mới",
    workspaceRole: "Vai trò làm việc",
    invitedOn: "Đã mời vào ngày",
    cancelInvite: "Hủy lời mời",

    // Drawing Dashboard
    projectsTitle: "Dự án",
    projectsSubtitle: "Truy cập gần đây trong vòng 7 ngày qua",
    initializeDrawing: "Khởi tạo bản vẽ mới",
    initializing: "Đang khởi tạo...",
    workspaceHealth: "Sức khỏe không gian làm việc",
    cloudStorage: "Dung lượng lưu trữ đám mây đã dùng",
    activeProjects: "Dự án đang hoạt động",
    deleteDrawingConfirm: "Xóa bản vẽ này?",
    justNow: "Vừa xong",
    minutesAgo: "phút trước",
    hoursAgo: "giờ trước",
    daysAgo: "ngày trước",
    editProjectDetails: "Sửa thông tin dự án",
    projectName: "Tên dự án",
    projectThumbnail: "Hình thu nhỏ/Ảnh đại diện dự án",
    uploadThumbnail: "Tải lên ảnh thu nhỏ",
    noImage: "Không có ảnh",
    enterProjectName: "Nhập tên dự án...",
    renameProject: "Đổi tên dự án",

    // Settings
    orgSettingsTitle: "Cài đặt tổ chức",
    orgSettingsSubtitle: "Quản lý thông tin cơ bản, tài sản hình ảnh và phân loại ngành của tổ chức.",
    generalIdentity: "Thông tin chung",
    industrySector: "Lĩnh vực ngành",
    structuralEngineering: "Kỹ thuật kết cấu",
    architecture: "Kiến trúc",
    mechanical: "Cơ khí",
    orgLogo: "Logo tổ chức",
    uploadLogoHelp: "Tải lên tệp hình ảnh SVG hoặc PNG độ phân giải cao.",
    logoSizeHelp: "Kích thước khuyên dùng: 512x512px. Dung lượng tối đa: 2MB.",
    removeLogo: "Xóa logo hiện tại",
    storageResidency: "Lưu trữ dữ liệu & Vị trí",
    primaryRegion: "Khu vực chính",
    change: "Thay đổi",
    authRules: "Quy tắc xác thực",
    ssoRequired: "Yêu cầu SSO",
    twoFAEnforced: "Bắt buộc 2FA",
    dangerZone: "Vùng nguy hiểm",
    deleteOrgHelp: "Xóa vĩnh viễn tổ chức này cùng tất cả tài sản CAD, lịch sử dự án và quyền truy cập thành viên liên quan. Hành động này không thể hoàn tác.",
    unsavedChanges: "Phát hiện thay đổi chưa lưu trong mục Thông tin chung",
    discard: "Hủy bỏ",

    // Additional Team Workspace Terms
    owner: "Chủ sở hữu",
    editor: "Biên tập viên",
    viewer: "Người xem",
    noPendingInvites: "Không có lời mời nào đang chờ.",
    proposedRole: "Vai trò đề xuất",
    createOrgTitle: "Tạo tổ chức mới",
    noOrgsFound: "Không tìm thấy tổ chức nào",
    orgNameLabel: "Tên tổ chức",
    orgNamePlaceholder: "vd: Công ty Kiến trúc Acme",
    creating: "Đang tạo...",
    removeMemberConfirm: "Xóa thành viên này khỏi tổ chức?",
    cancelInviteConfirm: "Hủy lời mời đang chờ cho email này?",
    orgCreatedSuccess: "Tổ chức đã được tạo thành công.",
    memberRoleUpdated: "Đã cập nhật vai trò thành viên.",
    memberRemovedSuccess: "Đã xóa thành viên khỏi tổ chức.",
    inviteCancelledSuccess: "Đã hủy lời mời.",
    selectOrgFirst: "Vui lòng chọn hoặc tạo tổ chức trước.",
    inspectOrgLabel: "Chọn tổ chức để kiểm tra",
    activeMembersInspect: "thành viên đang hoạt động.",
    viewingMembersCount: "Hiện đang xem",

    // Admin Console Extra
    selectPlan: "— Chọn gói —",
    calculatedFromCycle: "Được tính toán tự động từ chu kỳ hoạt động của gói.",
    noOrgsRegistered: "Chưa có tổ chức nào được đăng ký.",
    noPackagesFound: "Không tìm thấy gói nào. Nhấp vào \"Tạo gói dịch vụ\" để thêm.",
    selectOrgInspect: "Chọn tổ chức để kiểm tra",
    currentlyViewing: "Hiện đang xem",
    activeMembersLower: "thành viên đang hoạt động.",
    commaSeparated: "(ngăn cách bằng dấu phẩy)",
    featuresPlaceholder: "Bản vẽ 2D/3D, Nhập tệp DXF, Tạo mô hình bằng AI",
    deleteOrgConfirmAdmin: "Bạn có chắc chắn muốn xóa vĩnh viễn tổ chức \"{name}\"? Thao tác này sẽ xóa tất cả dữ liệu CAD và bản vẽ liên quan!",
    deletePkgConfirmAdmin: "Bạn có chắc chắn muốn xóa gói dịch vụ \"{name}\"? Các tổ chức đang sử dụng gói này vẫn giữ nguyên ngày hết hạn nhưng sẽ mất liên kết với gói.",
  }
};

interface TranslationStore {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof TRANSLATIONS.en) => string;
}

export const useTranslationStore = create<TranslationStore>((set: any, get: any) => ({
  language: (localStorage.getItem("language") as Language) || "en",
  setLanguage: (lang) => {
    localStorage.setItem("language", lang);
    set({ language: lang });
  },
  t: (key) => {
    const lang = get().language;
    const dictionary = TRANSLATIONS[lang] || TRANSLATIONS.en;
    return (dictionary as any)[key] || (TRANSLATIONS.en as any)[key] || key;
  }
}));
