import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  CalendarCheck,
  CalendarOff,
  Receipt,
  ArrowUpRight,
  Clock,
  ShieldCheck,
  Bot,
  Users
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, type Department, type LeaveTypeQuota } from "../services/api";

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeQuota[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadOrgSummary = async () => {
      try {
        const [depts, lts] = await Promise.all([
          api.listDepartments(),
          api.listLeaveTypes()
        ]);
        setDepartments(depts);
        setLeaveTypes(lts);
      } catch (err) {
        console.warn("Summary load note:", err);
      }
    };
    loadOrgSummary();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Welcome Banner */}
      <div className="glass-panel" style={{
        padding: "1.75rem 2rem",
        borderRadius: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem",
        border: "1px solid rgba(179, 255, 33, 0.2)",
        background: "linear-gradient(135deg, rgba(28, 36, 39, 0.8) 0%, rgba(24, 25, 29, 0.95) 100%)",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--swift-neon)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Active Workspace
            </span>
            <span style={{ color: "var(--text-muted)" }}>•</span>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <h1 style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Welcome back, <span style={{ color: "var(--swift-neon)" }}>{user?.email.split('@')[0]}</span>
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Role: <strong style={{ color: "var(--text-primary)" }}>{user?.role}</strong> • Scoped data access enforced on all requests.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{
            background: "var(--bg-surface-2)",
            border: "1px solid var(--border-subtle)",
            padding: "0.6rem 1rem",
            borderRadius: "10px",
            textAlign: "right"
          }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Live System Clock
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--swift-neon)", fontFamily: "JetBrains Mono" }}>
              {currentTime}
            </div>
          </div>
        </div>
      </div>

      {/* ADMIN DASHBOARD VIEW */}
      {user?.role === "Admin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Quick Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
            <div className="swift-card">
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
                <span>DEPARTMENTS</span>
                <Building2 size={18} color="var(--swift-neon)" />
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.5rem" }}>
                {departments.length}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Configured in Organization Setup
              </div>
            </div>

            <div className="swift-card">
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
                <span>LEAVE POLICY QUOTAS</span>
                <CalendarOff size={18} color="var(--swift-blue)" />
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.5rem" }}>
                {leaveTypes.length} Types
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Annual (14d), Sick (8d), Casual (10d)
              </div>
            </div>

            <div className="swift-card">
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
                <span>SYSTEM STATUS</span>
                <ShieldCheck size={18} color="var(--status-present)" />
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--status-present)", marginTop: "0.75rem" }}>
                Active & Secured
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Audit Logging & Scope Guard Active
              </div>
            </div>

            <div className="swift-card">
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
                <span>AI ASSISTANT</span>
                <Bot size={18} color="var(--swift-neon)" />
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--swift-neon)", marginTop: "0.75rem" }}>
                Gemini 3.5 Flash
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                7 Scoped Live Tools Ready
              </div>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <div className="swift-card">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Building2 size={18} color="var(--swift-neon)" /> Organization Management
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                Configure departments, designations, public holidays, office geofence and attendance rules.
              </p>
              <Link to="/org-setup" className="btn-primary" style={{ textDecoration: "none" }}>
                <span>Manage Organization Setup</span>
                <ArrowUpRight size={16} />
              </Link>
            </div>

            <div className="swift-card">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Users size={18} color="var(--swift-blue)" /> Access & HR Accounts
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                Create HR operator logins, review user activity, and enforce security policies.
              </p>
              <Link to="/org-setup" className="btn-secondary" style={{ textDecoration: "none" }}>
                <span>Configure Logins</span>
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* HR DASHBOARD VIEW */}
      {user?.role === "HR" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
            <div className="swift-card">
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
                <span>OPERATIONS</span>
                <Users size={18} color="var(--swift-blue)" />
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.5rem" }}>
                People Operations
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Register employees & manage jobs
              </p>
            </div>

            <div className="swift-card">
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
                <span>ATTENDANCE</span>
                <CalendarCheck size={18} color="var(--status-present)" />
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--status-present)", marginTop: "0.5rem" }}>
                Daily Board
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Review present, late & corrections
              </p>
            </div>

            <div className="swift-card">
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
                <span>LEAVE INBOX</span>
                <CalendarOff size={18} color="var(--status-late)" />
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.5rem" }}>
                Approval Inbox
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Pending requests & balance checks
              </p>
            </div>

            <div className="swift-card">
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
                <span>MONTHLY PAYROLL</span>
                <Receipt size={18} color="var(--swift-neon)" />
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.5rem" }}>
                Draft Runs
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Calculate tax, deductions & draft
              </p>
            </div>
          </div>
        </div>
      )}

      {/* EMPLOYEE DASHBOARD VIEW */}
      {user?.role === "Employee" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <div className="swift-card" style={{ border: "1px solid rgba(179, 255, 33, 0.3)" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Clock size={18} color="var(--swift-neon)" /> Web & Camera Attendance
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                Mark your daily check-in and check-out with GPS geofence validation and face detection.
              </p>
              <button className="btn-primary">
                <Clock size={16} /> Check In Now
              </button>
            </div>

            <div className="swift-card">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CalendarOff size={18} color="var(--swift-blue)" /> Leave Quotas (2026)
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginTop: "1rem" }}>
                <div style={{ background: "var(--bg-surface-0)", padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--swift-neon)" }}>14</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>ANNUAL</div>
                </div>
                <div style={{ background: "var(--bg-surface-0)", padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--status-late)" }}>8</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>SICK</div>
                </div>
                <div style={{ background: "var(--bg-surface-0)", padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--swift-blue)" }}>10</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>CASUAL</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
