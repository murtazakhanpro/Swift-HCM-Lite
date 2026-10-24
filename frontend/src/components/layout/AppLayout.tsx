import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarCheck,
  CalendarOff,
  Receipt,
  Bot,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Bell,
  Clock,
  Sparkles,
  CheckCheck
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ChangePasswordModal } from "../common/ChangePasswordModal";

interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(user?.must_change_password || false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/v1/comms/notifications?limit=15", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30000); // 30s poll
    return () => clearInterval(timer);
  }, [token]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const markAsRead = async (id: number) => {
    if (!token) return;
    try {
      await fetch(`/api/v1/comms/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    if (!token) return;
    try {
      await fetch("/api/v1/comms/notifications/read-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getRoleAvatar = (role?: string) => {
    switch (role) {
      case "Admin":
        return "/assets/Role-Based System Avatars/Corporate_operations_Icon.jpg";
      case "HR":
        return "/assets/Role-Based System Avatars/Person_avatar_icon.jpg";
      case "Employee":
      default:
        return "/assets/Role-Based System Avatars/User_avatar_icon.jpg";
    }
  };

  const getRoleBadgeClass = (role?: string) => {
    switch (role) {
      case "Admin":
        return "badge-role-admin";
      case "HR":
        return "badge-role-hr";
      case "Employee":
      default:
        return "badge-role-employee";
    }
  };

  // Scoped navigation links based on user role
  const getNavLinks = () => {
    if (!user) return [];

    switch (user.role) {
      case "Admin":
        return [
          { name: "Company Dashboard", path: "/dashboard", icon: LayoutDashboard },
          { name: "Organization Setup", path: "/org-setup", icon: Building2 },
          { name: "Employees (All)", path: "/employees", icon: Users },
          { name: "Attendance Board", path: "/attendance", icon: CalendarCheck },
          { name: "Leave Requests", path: "/leave", icon: CalendarOff },
          { name: "Payroll Control", path: "/payroll", icon: Receipt },
          { name: "Security & Audit Log", path: "/audit-logs", icon: ShieldCheck },
          { name: "AI Executive Assistant", path: "/ai-assistant", icon: Bot },
        ];
      case "HR":
        return [
          { name: "HR Operations Board", path: "/dashboard", icon: LayoutDashboard },
          { name: "Employee Directory & 360", path: "/employees", icon: Users },
          { name: "Daily Attendance", path: "/attendance", icon: CalendarCheck },
          { name: "Leave Approvals", path: "/leave", icon: CalendarOff },
          { name: "Monthly Payroll Draft", path: "/payroll", icon: Receipt },
          { name: "AI HR Assistant", path: "/ai-assistant", icon: Bot },
        ];
      case "Employee":
      default:
        return [
          { name: "My Workspace", path: "/dashboard", icon: LayoutDashboard },
          { name: "Check In / Out", path: "/attendance", icon: Clock },
          { name: "Apply Leave & Balance", path: "/leave", icon: CalendarOff },
          { name: "My Payslips", path: "/payroll", icon: Receipt },
          { name: "Ask Assistant", path: "/ai-assistant", icon: Bot },
        ];
    }
  };

  const navLinks = getNavLinks();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-canvas)" }}>
      {/* Change Password Modal (Mandatory on first login) */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onSuccess={() => setShowPasswordModal(false)}
      />

      {/* Sidebar - Desktop */}
      <aside
        style={{
          width: "260px",
          backgroundColor: "var(--bg-surface-0)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          zIndex: 40,
        }}
        className="hidden-mobile"
      >
        {/* Brand Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <img
            src="/assets/Logo/App_logo_icon.jpg"
            alt="Swift-HCM Lite"
            style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "cover", border: "1px solid var(--border-accent)" }}
          />
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--swift-neon)", letterSpacing: "0.03em" }}>
              SWIFT-HCM
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: 500 }}>
              {user?.company_name || "Enterprise Edition"}
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ flex: 1, padding: "1rem 0.75rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", padding: "0.5rem 0.75rem 0.25rem" }}>
            {user?.role} Scope
          </div>
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#111315" : "var(--text-secondary)",
                  backgroundColor: isActive ? "var(--swift-neon)" : "transparent",
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                  boxShadow: isActive ? "0 0 15px rgba(179, 255, 33, 0.25)" : "none",
                }}
              >
                <Icon size={18} color={isActive ? "#111315" : undefined} />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout in Sidebar Footer */}
        <div style={{ padding: "1rem", borderTop: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <img
              src={getRoleAvatar(user?.role)}
              alt="Avatar"
              style={{ width: "40px", height: "40px", borderRadius: "10px", objectFit: "cover", border: "1px solid var(--border-subtle)" }}
            />
            <div style={{ overflow: "hidden", flex: 1 }}>
              <div style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                {user?.email}
              </div>
              <span className={`badge ${getRoleBadgeClass(user?.role)}`} style={{ marginTop: "0.15rem" }}>
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn-secondary"
            style={{ width: "100%", padding: "0.45rem", fontSize: "0.8rem", color: "#FF3344", borderColor: "rgba(255, 51, 68, 0.3)" }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <>
          <button
            className="mobile-nav-backdrop"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          />
          <aside id="mobile-navigation-drawer" className="mobile-nav-drawer" aria-label="Mobile navigation">
            <div className="mobile-nav-brand">
              <img src="/assets/Logo/App_logo_icon.jpg" alt="" />
              <div><strong>SWIFT-HCM</strong><span>{user?.company_name || "Enterprise Edition"}</span></div>
              <button className="btn-secondary" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close navigation menu"><X size={18} /></button>
            </div>
            <nav className="mobile-nav-links">
              <span className="mobile-nav-scope">{user?.role} Scope</span>
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`mobile-nav-link${isActive ? " active" : ""}`}
                  >
                    <Icon size={18} />
                    <span>{link.name}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="mobile-nav-footer">
              <div className="mobile-nav-user">{user?.email}<span className={`badge ${getRoleBadgeClass(user?.role)}`}>{user?.role}</span></div>
              <button onClick={handleLogout} className="btn-secondary mobile-signout"><LogOut size={15} /> Sign Out</button>
            </div>
          </aside>
        </>
      )}

      {/* Main Container */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Header Navbar */}
        <header
          style={{
            height: "64px",
            backgroundColor: "var(--bg-surface-0)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 1.5rem",
            position: "sticky",
            top: 0,
            zIndex: 30,
          }}
        >
          {/* Mobile Menu Button */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="btn-secondary mobile-only"
              style={{ padding: "0.4rem", display: "none" }}
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
                {user?.company_name || "Swift-HCM Lite"}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>•</span>
              <span style={{ fontSize: "0.75rem", color: "var(--swift-neon)", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <Sparkles size={12} /> AI Powered
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="btn-secondary"
                style={{ padding: "0.5rem", borderRadius: "8px", position: "relative" }}
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-4px",
                      right: "-4px",
                      backgroundColor: "var(--swift-neon)",
                      color: "#000",
                      fontSize: "0.65rem",
                      fontWeight: 800,
                      borderRadius: "10px",
                      padding: "1px 5px",
                      minWidth: "16px",
                      textAlign: "center",
                      boxShadow: "0 0 8px rgba(179, 255, 33, 0.6)",
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown Menu */}
              {showNotifDropdown && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    width: 340,
                    maxHeight: 420,
                    overflowY: "auto",
                    backgroundColor: "var(--bg-surface-1)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 10,
                    boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
                    zIndex: 100,
                    padding: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "0.5rem", borderBottom: "1px solid var(--border-subtle)", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      NOTIFICATIONS ({unreadCount} new)
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--swift-neon)",
                          fontSize: "0.7rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        <CheckCheck size={12} />
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      No notifications yet
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          style={{
                            padding: "0.6rem 0.75rem",
                            borderRadius: 6,
                            backgroundColor: n.is_read ? "transparent" : "rgba(179, 255, 33, 0.05)",
                            border: n.is_read ? "1px solid transparent" : "1px solid rgba(179, 255, 33, 0.2)",
                            cursor: "pointer",
                            transition: "background 0.15s",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: n.is_read ? 500 : 700, color: n.is_read ? "var(--text-secondary)" : "var(--text-primary)" }}>
                              {n.title}
                            </div>
                            {!n.is_read && (
                              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--swift-neon)", marginTop: 4 }} />
                            )}
                          </div>
                          <div style={{ fontSize: "0.725rem", color: "var(--text-muted)", marginTop: "0.2rem", lineHeight: 1.3 }}>
                            {n.message}
                          </div>
                          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>
                            {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <span className={`badge ${getRoleBadgeClass(user?.role)}`}>
              {user?.role}
            </span>
          </div>
        </header>

        {/* Content Body */}
        <main className="app-main-content" style={{ flex: 1, padding: "1.75rem", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
};
