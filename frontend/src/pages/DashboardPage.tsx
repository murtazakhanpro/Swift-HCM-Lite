import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  CalendarOff,
  Receipt,
  Clock,
  Bot,
  Users,
  Megaphone,
  Activity,
  Plus,
  CheckCircle,
  Sparkles,
  ChevronRight,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface DashboardSummary {
  role: string;
  active_employees: number;
  total_departments: number;
  attendance: {
    date: string;
    checked_in: number;
    late_today: number;
    on_time_pct: number;
    overall_rate_pct: number;
  };
  payroll: {
    latest_month: string | null;
    status: string;
    latest_net_payout: number;
  };
  announcements: Array<{
    id: number;
    title: string;
    content: string;
    author: string;
    date: string;
  }>;
  ml_insights: {
    punctuality_health: string;
    chronic_late_anomalies: number;
  };
  personal: {
    today_status?: string;
    check_in_time?: string | null;
  };
}

export const DashboardPage: React.FC = () => {
  const { user, token } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Quick announcement modal for Admin / HR
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annSubmitting, setAnnSubmitting] = useState(false);
  const [annSuccess, setAnnSuccess] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/v1/org/dashboard-summary", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.warn("Dashboard load note:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !annTitle.trim() || !annContent.trim()) return;
    setAnnSubmitting(true);
    try {
      const res = await fetch("/api/v1/comms/announcements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: annTitle, content: annContent }),
      });
      if (res.ok) {
        setAnnSuccess("Announcement published to all active workforce!");
        setAnnTitle("");
        setAnnContent("");
        setTimeout(() => {
          setShowAnnModal(false);
          setAnnSuccess(null);
        }, 1500);
        fetchDashboardData();
      }
    } catch {
      // ignore
    } finally {
      setAnnSubmitting(false);
    }
  };

  const formatPKR = (val: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: 1400, margin: "0 auto" }}>
      {/* Welcome Banner */}
      <div
        className="glass-panel"
        style={{
          padding: "1.75rem 2rem",
          borderRadius: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          border: "1px solid rgba(179, 255, 33, 0.25)",
          background: "linear-gradient(135deg, var(--bg-surface-1) 0%, var(--bg-surface-0) 100%)",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--swift-neon)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Active Workspace • Lyntica
            </span>
            <span style={{ color: "var(--text-muted)" }}>•</span>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>
          <h1 style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Welcome back, <span style={{ color: "var(--swift-neon)" }}>{user?.email.split("@")[0]}</span>
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Role: <strong style={{ color: "var(--text-primary)" }}>{user?.role}</strong> • Real-time enterprise HCM metrics & AI insights.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              background: "var(--bg-surface-2)",
              border: "1px solid var(--border-subtle)",
              padding: "0.6rem 1rem",
              borderRadius: "10px",
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Live System Clock
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--swift-neon)", fontFamily: "JetBrains Mono" }}>
              {currentTime}
            </div>
          </div>
        </div>
      </div>

      {/* METRIC STRIP (Module 9 Dashboards) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
        {/* Active Headcount */}
        {user?.role !== "Employee" && <div className="swift-card">
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
            <span>ACTIVE WORKFORCE</span>
            <Users size={18} color="var(--swift-neon)" />
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.4rem" }}>
            {data ? data.active_employees : "—"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
            Spread across {data?.total_departments || 0} departments
          </div>
        </div>}

        {/* Today's Attendance Rate */}
        <div className="swift-card">
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
            <span>{user?.role === "Employee" ? "MY ATTENDANCE TODAY" : "ATTENDANCE TODAY"}</span>
            <CalendarCheck size={18} color="#B3FF21" />
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#B3FF21", marginTop: "0.4rem" }}>
            {data ? `${data.attendance.overall_rate_pct}%` : "—"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
            {data?.attendance.checked_in || 0} checked in ({data?.attendance.late_today || 0} late)
          </div>
        </div>

        {/* Latest Payroll Status */}
        {user?.role !== "Employee" && <div className="swift-card">
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
            <span>MONTHLY PAYROLL</span>
            <Receipt size={18} color="var(--swift-blue)" />
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--swift-neon)", marginTop: "0.4rem" }}>
            {data?.payroll.latest_net_payout ? formatPKR(data.payroll.latest_net_payout) : "PKR 0"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
            Cycle: {data?.payroll.latest_month || "None"} • Status: {data?.payroll.status.toUpperCase() || "IDLE"}
          </div>
        </div>}

        {/* Attendance follow-up counts come from saved attendance records. */}
        {user?.role !== "Employee" && <div className="swift-card" style={{ border: "1px solid rgba(179, 255, 33, 0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
            <span>LATE ARRIVAL FOLLOW-UP</span>
            <Sparkles size={18} color="var(--swift-neon)" />
          </div>
          <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.4rem" }}>
            {data?.ml_insights.chronic_late_anomalies ? "Repeated late arrivals" : "No repeated late arrivals"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
            {data?.ml_insights.chronic_late_anomalies || 0} employees with at least three late arrivals this month
          </div>
        </div>}
      </div>

      {/* DUAL COLUMN: Quick Navigation & Announcements Feed */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1.5rem" }}>
        {/* Left Column: Quick Workflow Hub */}
        <div className="swift-card">
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "1rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Activity size={20} color="var(--swift-neon)" />
            Enterprise Operations Hub
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Link
              to="/attendance"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.85rem 1rem",
                borderRadius: 8,
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border-subtle)",
                textDecoration: "none",
                color: "var(--text-primary)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--swift-neon)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <Clock size={18} color="var(--swift-neon)" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Daily Attendance Board</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>GPS geofence check-ins, webcam face detection, daily logs</div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-muted)" />
            </Link>

            <Link
              to="/leave"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.85rem 1rem",
                borderRadius: 8,
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border-subtle)",
                textDecoration: "none",
                color: "var(--text-primary)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--swift-neon)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <CalendarOff size={18} color="var(--swift-blue)" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Leave Management & Balance</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>SVG quota balance dials, review inbox, conflict guards</div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-muted)" />
            </Link>

            <Link
              to="/payroll"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.85rem 1rem",
                borderRadius: 8,
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border-subtle)",
                textDecoration: "none",
                color: "var(--text-primary)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--swift-neon)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <Receipt size={18} color="#B3FF21" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Compensation & Payroll Lite</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>1.5x Basic formula, progressive tax slabs, PDF payslips</div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-muted)" />
            </Link>

            <Link
              to="/ai-assistant"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.85rem 1rem",
                borderRadius: 8,
                backgroundColor: "rgba(179, 255, 33, 0.05)",
                border: "1px solid rgba(179, 255, 33, 0.3)",
                textDecoration: "none",
                color: "var(--text-primary)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--swift-neon)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(179, 255, 33, 0.3)")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <Bot size={18} color="var(--swift-neon)" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--swift-neon)" }}>Grounded AI Executive Assistant</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>7 Scoped HCM tools, Gemini intelligence, policy Q&A</div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--swift-neon)" />
            </Link>
          </div>
        </div>

        {/* Right Column: Company Announcements Feed */}
        <div className="swift-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Megaphone size={20} color="var(--swift-neon)" />
              Company Announcements
            </h2>
            {(user?.role === "Admin" || user?.role === "HR") && (
              <button
                onClick={() => setShowAnnModal(true)}
                className="btn-swift-secondary"
                style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
              >
                <Plus size={14} />
                Post Announcement
              </button>
            )}
          </div>

          {!data?.announcements || data.announcements.length === 0 ? (
            <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--text-muted)" }}>
              <Megaphone size={36} style={{ opacity: 0.3, marginBottom: "0.5rem" }} />
              <p style={{ fontSize: "0.85rem" }}>No company announcements published yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {data.announcements.map((ann) => (
                <div
                  key={ann.id}
                  style={{
                    padding: "0.85rem",
                    borderRadius: 8,
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>
                      {ann.title}
                    </div>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{ann.date}</span>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.4, margin: 0 }}>
                    {ann.content}
                  </p>
                  <div style={{ fontSize: "0.7rem", color: "var(--swift-neon)", marginTop: "0.4rem" }}>
                    Published by {ann.author}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* QUICK ANNOUNCEMENT MODAL */}
      {showAnnModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            className="swift-card"
            style={{
              maxWidth: 480,
              width: "100%",
              border: "1px solid rgba(179, 255, 33, 0.3)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Megaphone size={20} color="var(--swift-neon)" />
                Post Company Announcement
              </h3>
              <button
                onClick={() => setShowAnnModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {annSuccess && (
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: 6,
                  backgroundColor: "rgba(179, 255, 33, 0.15)",
                  color: "#B3FF21",
                  fontSize: "0.85rem",
                  marginBottom: "1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <CheckCircle size={16} />
                <span>{annSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePostAnnouncement}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Announcement Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Townhall Meeting & Holiday Schedule"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="swift-input"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Announcement Content
                </label>
                <textarea
                  placeholder="Write message for all active team members..."
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  className="swift-input"
                  style={{ width: "100%", height: 100, resize: "vertical" }}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowAnnModal(false)}
                  className="btn-swift-secondary"
                  disabled={annSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-swift-primary"
                  disabled={annSubmitting || !annTitle.trim() || !annContent.trim()}
                >
                  {annSubmitting ? "Publishing..." : "Broadcast Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
