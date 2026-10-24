import React, { useState } from "react";
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
  Sparkles
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ChangePasswordModal } from "../common/ChangePasswordModal";

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(user?.must_change_password || false);

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
            src="/assets/Logo/SWIFT-HCM_LITE_logo.jpg"
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
                  color: isActive ? "#121316" : "var(--text-secondary)",
                  backgroundColor: isActive ? "var(--swift-neon)" : "transparent",
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                  boxShadow: isActive ? "0 0 15px rgba(179, 255, 33, 0.25)" : "none",
                }}
              >
                <Icon size={18} color={isActive ? "#121316" : undefined} />
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
            style={{ width: "100%", padding: "0.45rem", fontSize: "0.8rem", color: "#FB2436", borderColor: "rgba(251, 36, 54, 0.3)" }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

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
                className="btn-secondary"
                style={{ padding: "0.5rem", borderRadius: "8px" }}
                title="Notifications"
              >
                <Bell size={18} />
              </button>
            </div>
            <span className={`badge ${getRoleBadgeClass(user?.role)}`}>
              {user?.role}
            </span>
          </div>
        </header>

        {/* Content Body */}
        <main style={{ flex: 1, padding: "1.75rem", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
};
