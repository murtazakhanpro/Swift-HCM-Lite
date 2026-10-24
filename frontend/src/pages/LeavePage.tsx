import React, { useEffect, useState, useCallback } from "react";
import {
  CalendarOff,
  CalendarCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  ChevronDown,
  RefreshCw,
  Trash2,
  ClipboardList,
  TrendingDown,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  api,
  type LeaveRequest,
  type LeaveBalanceItem,
  type LeaveBalanceResponse,
  type LeaveTypeQuota,
} from "../services/api";

// ── Helpers ───────────────────────────────────────────────────────────────────
const statusColor: Record<string, string> = {
  pending: "var(--status-late)",
  approved: "var(--status-present)",
  rejected: "var(--status-absent)",
  cancelled: "var(--text-muted)",
};

const statusBg: Record<string, string> = {
  pending: "var(--status-late-bg)",
  approved: "var(--status-present-bg)",
  rejected: "var(--status-absent-bg)",
  cancelled: "rgba(194,166,122,0.1)",
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "0.2rem 0.6rem",
      borderRadius: "9999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      color: statusColor[status] || "var(--text-muted)",
      background: statusBg[status] || "transparent",
      border: `1px solid ${statusColor[status] || "var(--border-subtle)"}30`,
    }}
  >
    {status}
  </span>
);

// ── Balance Dial ──────────────────────────────────────────────────────────────
const BalanceDial: React.FC<{ item: LeaveBalanceItem }> = ({ item }) => {
  const pct = item.annual_quota > 0 ? (item.days_remaining / item.annual_quota) * 100 : 0;
  const color =
    pct > 50 ? "var(--status-present)" : pct > 20 ? "var(--status-late)" : "var(--status-absent)";
  const circumference = 2 * Math.PI * 28;
  const dash = (pct / 100) * circumference;

  return (
    <div
      style={{
        background: "var(--bg-surface-1)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "12px",
        padding: "1.1rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem",
        transition: "all 0.2s",
      }}
    >
      {/* SVG Ring */}
      <div style={{ position: "relative", width: "70px", height: "70px" }}>
        <svg width="70" height="70" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="35" cy="35" r="28" fill="none" stroke="var(--bg-surface-2)" strokeWidth="6" />
          <circle
            cx="35"
            cy="35"
            r="28"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <span style={{ fontSize: "1.1rem", fontWeight: 800, color, lineHeight: 1 }}>
            {item.days_remaining}
          </span>
          <span style={{ fontSize: "0.55rem", color: "var(--text-muted)", fontWeight: 600 }}>LEFT</span>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>
          {item.leave_type_name}
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
          {item.days_taken} used · {item.annual_quota} total
          {item.is_unpaid && " · Unpaid"}
        </div>
      </div>
    </div>
  );
};

// ── Apply Leave Modal ─────────────────────────────────────────────────────────
interface ApplyLeaveModalProps {
  leaveTypes: LeaveTypeQuota[];
  balance?: LeaveBalanceResponse | null;
  onSubmit: (data: {
    leave_type_id: number;
    start_date: string;
    end_date: string;
    reason: string;
  }) => Promise<void>;
  onClose: () => void;
}

const ApplyLeaveModal: React.FC<ApplyLeaveModalProps> = ({
  leaveTypes,
  balance,
  onSubmit,
  onClose,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [ltId, setLtId] = useState<number>(leaveTypes[0]?.id || 0);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const daysRequested =
    startDate && endDate && endDate >= startDate
      ? Math.floor(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000
        ) + 1
      : 0;

  const selectedBalance = balance?.balances.find((b) => b.leave_type_id === ltId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!reason.trim() || reason.length < 5) {
      setErr("Please provide a reason (at least 5 characters).");
      return;
    }
    if (endDate < startDate) {
      setErr("End date cannot be before start date.");
      return;
    }
    setLoading(true);
    try {
      await onSubmit({ leave_type_id: ltId, start_date: startDate, end_date: endDate, reason });
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "var(--bg-surface-1)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "16px",
          padding: "1.75rem",
          width: "100%",
          maxWidth: "520px",
          animation: "fadeIn 0.2s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.15rem",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <CalendarOff size={20} color="var(--swift-neon)" /> Apply for Leave
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "0.25rem",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Leave Type */}
          <div>
            <label
              style={{
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: "0.35rem",
              }}
            >
              Leave Type
            </label>
            <select
              className="swift-input"
              value={ltId}
              onChange={(e) => setLtId(Number(e.target.value))}
              required
              style={{ appearance: "none" }}
            >
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name} ({lt.annual_quota}d/yr{lt.is_unpaid ? " · Unpaid" : ""})
                </option>
              ))}
            </select>
            {/* Balance hint */}
            {selectedBalance && (
              <div
                style={{
                  marginTop: "0.4rem",
                  fontSize: "0.75rem",
                  color:
                    selectedBalance.days_remaining > 0
                      ? "var(--status-present)"
                      : "var(--status-absent)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}
              >
                {selectedBalance.days_remaining > 0 ? (
                  <CheckCircle size={12} />
                ) : (
                  <XCircle size={12} />
                )}
                {selectedBalance.days_remaining} day(s) remaining this year
              </div>
            )}
          </div>

          {/* Date Range */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: "0.35rem",
                }}
              >
                From Date
              </label>
              <input
                type="date"
                className="swift-input"
                value={startDate}
                min={today}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: "0.35rem",
                }}
              >
                To Date
              </label>
              <input
                type="date"
                className="swift-input"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Duration indicator */}
          {daysRequested > 0 && (
            <div
              style={{
                background:
                  daysRequested > (selectedBalance?.days_remaining || 999)
                    ? "var(--status-absent-bg)"
                    : "rgba(179,255,33,0.07)",
                border: `1px solid ${
                  daysRequested > (selectedBalance?.days_remaining || 999)
                    ? "rgba(255,51,68,0.3)"
                    : "rgba(179,255,33,0.2)"
                }`,
                borderRadius: "8px",
                padding: "0.65rem 0.85rem",
                fontSize: "0.82rem",
                fontWeight: 600,
                color:
                  daysRequested > (selectedBalance?.days_remaining || 999)
                    ? "var(--status-absent)"
                    : "var(--swift-neon)",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Clock size={14} />
              {daysRequested} day{daysRequested !== 1 ? "s" : ""} requested
              {selectedBalance &&
                !selectedBalance.is_unpaid &&
                daysRequested > selectedBalance.days_remaining &&
                " — exceeds remaining balance"}
            </div>
          )}

          {/* Reason */}
          <div>
            <label
              style={{
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: "0.35rem",
              }}
            >
              Reason <span style={{ color: "var(--status-absent)" }}>*</span>
            </label>
            <textarea
              className="swift-input"
              rows={3}
              placeholder="Briefly describe the reason for your leave request…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ resize: "vertical", minHeight: "80px" }}
              required
              minLength={5}
            />
          </div>

          {err && (
            <div
              style={{
                background: "var(--status-absent-bg)",
                border: "1px solid rgba(255,51,68,0.3)",
                borderRadius: "8px",
                padding: "0.65rem 0.85rem",
                color: "var(--status-absent)",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <AlertCircle size={14} />
              {err}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.25rem" }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? "Submitting…" : "Submit Leave Request"}
            </button>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Leave Request Row ─────────────────────────────────────────────────────────
interface LeaveRowProps {
  req: LeaveRequest;
  role: string;
  onCancel?: (id: number) => void;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  reviewingId?: number | null;
  setReviewingId?: (id: number | null) => void;
  reviewComment?: string;
  setReviewComment?: (v: string) => void;
  onConfirmReview?: (id: number, status: "approved" | "rejected") => void;
  reviewLoading?: boolean;
}

const LeaveRow: React.FC<LeaveRowProps> = ({
  req,
  role,
  onCancel,
  reviewingId,
  setReviewingId,
  reviewComment = "",
  setReviewComment,
  onConfirmReview,
  reviewLoading,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: "var(--bg-surface-1)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "12px",
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}
    >
      {/* Main row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          padding: "0.9rem 1.1rem",
          cursor: "pointer",
          flexWrap: "wrap",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Employee / Leave Type */}
        <div style={{ flex: 1, minWidth: "160px" }}>
          {role !== "Employee" && (
            <div
              style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}
            >
              {req.employee_name}
              <span
                style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  fontFamily: "JetBrains Mono",
                  marginLeft: "0.4rem",
                }}
              >
                ({req.employee_code})
              </span>
            </div>
          )}
          <div
            style={{
              fontSize: role === "Employee" ? "0.9rem" : "0.78rem",
              fontWeight: role === "Employee" ? 700 : 500,
              color: role === "Employee" ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            {req.leave_type.name}
          </div>
        </div>

        {/* Date Range */}
        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", minWidth: "150px" }}>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: "0.8rem" }}>
            {req.start_date}
          </span>
          <span style={{ color: "var(--text-muted)", margin: "0 0.3rem" }}>→</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: "0.8rem" }}>
            {req.end_date}
          </span>
        </div>

        {/* Days */}
        <div
          style={{
            fontSize: "0.85rem",
            fontWeight: 700,
            color: "var(--swift-neon)",
            minWidth: "60px",
          }}
        >
          {req.total_days}d
        </div>

        {/* Status */}
        <StatusBadge status={req.status} />

        {/* Chevron */}
        <ChevronDown
          size={16}
          color="var(--text-muted)"
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        />
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            padding: "1rem 1.1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            background: "var(--bg-surface-0)",
            animation: "fadeIn 0.15s ease",
          }}
        >
          {/* Reason */}
          <div>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginBottom: "0.25rem",
              }}
            >
              Reason
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{req.reason}</div>
          </div>

          {/* Reviewer note */}
          {req.reviewer_comment && (
            <div
              style={{
                background: "var(--bg-surface-1)",
                borderRadius: "8px",
                padding: "0.6rem 0.85rem",
                fontSize: "0.8rem",
                color: "var(--text-muted)",
              }}
            >
              <strong style={{ color: "var(--text-secondary)" }}>HR Note:</strong>{" "}
              {req.reviewer_comment}
            </div>
          )}

          {/* Dates */}
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              display: "flex",
              gap: "1.5rem",
              flexWrap: "wrap",
            }}
          >
            <span>
              Applied:{" "}
              {new Date(req.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            {req.reviewed_at && (
              <span>
                Reviewed:{" "}
                {new Date(req.reviewed_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {/* Employee: cancel pending */}
            {role === "Employee" && req.status === "pending" && onCancel && (
              <button
                className="btn-secondary"
                style={{ fontSize: "0.78rem", color: "var(--status-absent)", borderColor: "rgba(255,51,68,0.3)" }}
                onClick={() => onCancel(req.id)}
              >
                <Trash2 size={13} /> Cancel Request
              </button>
            )}

            {/* HR: review actions */}
            {role === "HR" && req.status === "pending" && setReviewingId && (
              reviewingId === req.id ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                    width: "100%",
                  }}
                >
                  <input
                    className="swift-input"
                    placeholder="Review comment (optional)"
                    value={reviewComment}
                    onChange={(e) => setReviewComment?.(e.target.value)}
                    style={{ fontSize: "0.82rem" }}
                  />
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      className="btn-primary"
                      style={{ flex: 1, fontSize: "0.8rem" }}
                      disabled={reviewLoading}
                      onClick={() => onConfirmReview?.(req.id, "approved")}
                    >
                      <CheckCircle size={14} />
                      {reviewLoading ? "…" : "Approve"}
                    </button>
                    <button
                      className="btn-secondary"
                      style={{
                        flex: 1,
                        fontSize: "0.8rem",
                        color: "var(--status-absent)",
                        borderColor: "rgba(255,51,68,0.3)",
                      }}
                      disabled={reviewLoading}
                      onClick={() => onConfirmReview?.(req.id, "rejected")}
                    >
                      <XCircle size={14} />
                      {reviewLoading ? "…" : "Reject"}
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: "0.8rem" }}
                      onClick={() => setReviewingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn-secondary"
                  style={{ fontSize: "0.78rem" }}
                  onClick={() => {
                    setReviewingId(req.id);
                    setReviewComment?.("");
                  }}
                >
                  <ClipboardList size={13} /> Review
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── EMPLOYEE VIEW ─────────────────────────────────────────────────────────────
const EmployeeLeaveView: React.FC = () => {
  const { user } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeQuota[]>([]);
  const [balance, setBalance] = useState<LeaveBalanceResponse | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"balance" | "history">("balance");
  const [filterStatus, setFilterStatus] = useState("all");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [lts, reqs] = await Promise.all([
        api.listLeaveTypes(),
        api.listLeaveRequests({ year: new Date().getFullYear() }),
      ]);
      setLeaveTypes(lts);
      setRequests(reqs);
      if (user?.employee_id) {
        const bal = await api.getLeaveBalance(user.employee_id);
        setBalance(bal);
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.employee_id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApply = async (data: any) => {
    await api.applyLeave(data);
    setSuccess("✓ Leave request submitted successfully! Awaiting HR review.");
    await load();
  };

  const handleCancel = async (id: number) => {
    if (!window.confirm("Cancel this leave request?")) return;
    try {
      await api.cancelLeaveRequest(id);
      setSuccess("Leave request cancelled.");
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const filtered =
    filterStatus === "all" ? requests : requests.filter((r) => r.status === filterStatus);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  if (loading)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "200px",
          color: "var(--text-secondary)",
          gap: "0.5rem",
        }}
      >
        <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
        Loading leave data…
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Alerts */}
      {err && (
        <div
          style={{
            background: "var(--status-absent-bg)",
            border: "1px solid rgba(255,51,68,0.3)",
            borderRadius: "10px",
            padding: "0.8rem 1rem",
            color: "var(--status-absent)",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <AlertCircle size={15} />
          {err}
        </div>
      )}
      {success && (
        <div
          style={{
            background: "var(--status-present-bg)",
            border: "1px solid rgba(179,255,33,0.3)",
            borderRadius: "10px",
            padding: "0.8rem 1rem",
            color: "var(--status-present)",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <CheckCircle size={15} />
          {success}
        </div>
      )}

      {/* Action bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            {new Date().getFullYear()} Leave Quota &amp; History
          </span>
          {pendingCount > 0 && (
            <span
              style={{
                marginLeft: "0.75rem",
                background: "var(--status-late-bg)",
                color: "var(--status-late)",
                border: "1px solid rgba(255,208,0,0.3)",
                borderRadius: "9999px",
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "0.15rem 0.5rem",
              }}
            >
              {pendingCount} Pending
            </span>
          )}
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Apply for Leave
        </button>
      </div>

      {/* Tab Nav */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border-subtle)" }}>
        {[
          { key: "balance", label: "Leave Balance", icon: <TrendingDown size={15} /> },
          { key: "history", label: "My Requests", icon: <ClipboardList size={15} /> },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.65rem 1rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: activeTab === key ? "var(--swift-neon)" : "var(--text-secondary)",
              borderBottom: activeTab === key ? "2px solid var(--swift-neon)" : "2px solid transparent",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              transition: "all 0.2s",
              marginBottom: "-1px",
            }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* BALANCE TAB */}
      {activeTab === "balance" && (
        <>
          {balance && balance.balances.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))",
                gap: "1rem",
              }}
            >
              {balance.balances.map((b) => (
                <BalanceDial key={b.leave_type_id} item={b} />
              ))}
            </div>
          ) : (
            <div
              className="swift-card"
              style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-muted)" }}
            >
              <CalendarOff size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.4 }} />
              <div>No leave types configured. Ask HR to set up leave policies.</div>
            </div>
          )}

          {/* Summary table */}
          {balance && balance.balances.length > 0 && (
            <div className="swift-card" style={{ padding: "0", overflow: "hidden" }}>
              <div
                style={{
                  padding: "0.85rem 1.1rem",
                  borderBottom: "1px solid var(--border-subtle)",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Balance Summary — {balance.year}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-surface-0)" }}>
                    {["Leave Type", "Annual Quota", "Days Used", "Remaining"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "0.55rem 1rem",
                          textAlign: "left",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {balance.balances.map((b) => {
                    const pct = b.annual_quota > 0 ? (b.days_remaining / b.annual_quota) * 100 : 0;
                    const col =
                      pct > 50
                        ? "var(--status-present)"
                        : pct > 20
                        ? "var(--status-late)"
                        : "var(--status-absent)";
                    return (
                      <tr key={b.leave_type_id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "0.65rem 1rem" }}>
                          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                            {b.leave_type_name}
                          </div>
                          {b.is_unpaid && (
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Unpaid</div>
                          )}
                        </td>
                        <td style={{ padding: "0.65rem 1rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                          {b.annual_quota} days
                        </td>
                        <td style={{ padding: "0.65rem 1rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                          {b.days_taken} days
                        </td>
                        <td style={{ padding: "0.65rem 1rem" }}>
                          <span style={{ fontSize: "0.9rem", fontWeight: 800, color: col }}>
                            {b.days_remaining}
                          </span>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "0.3rem" }}>
                            days
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* HISTORY TAB */}
      {activeTab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Filter pills */}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {["all", "pending", "approved", "rejected", "cancelled"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  background: filterStatus === s ? "var(--swift-neon)" : "var(--bg-surface-2)",
                  color: filterStatus === s ? "#111315" : "var(--text-secondary)",
                  border: "1px solid",
                  borderColor: filterStatus === s ? "var(--swift-neon)" : "var(--border-subtle)",
                  borderRadius: "9999px",
                  padding: "0.3rem 0.85rem",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textTransform: "capitalize",
                  transition: "all 0.15s",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div
              className="swift-card"
              style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-muted)" }}
            >
              <CalendarOff size={28} style={{ margin: "0 auto 0.6rem", opacity: 0.4 }} />
              <div>No {filterStatus !== "all" ? filterStatus : ""} leave requests.</div>
            </div>
          ) : (
            filtered.map((req) => (
              <LeaveRow
                key={req.id}
                req={req}
                role="Employee"
                onCancel={handleCancel}
              />
            ))
          )}
        </div>
      )}

      {/* Apply modal */}
      {showModal && (
        <ApplyLeaveModal
          leaveTypes={leaveTypes}
          balance={balance}
          onSubmit={handleApply}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

// ── HR / ADMIN VIEW ───────────────────────────────────────────────────────────
const HRLeaveView: React.FC = () => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const reqs = await api.listLeaveRequests({ year: new Date().getFullYear() });
      setRequests(reqs);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleReview = async (id: number, status: "approved" | "rejected") => {
    setReviewLoading(true);
    setErr(null);
    try {
      await api.reviewLeaveRequest(id, {
        status,
        reviewer_comment: reviewComment || undefined,
      });
      setSuccess(
        `✓ Leave request ${status}. Employee has been notified.`
      );
      setReviewingId(null);
      setReviewComment("");
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setReviewLoading(false);
    }
  };

  const pending = requests.filter((r) => r.status === "pending");
  const filtered =
    filterStatus === "all" ? requests : requests.filter((r) => r.status === filterStatus);

  // Summary metrics
  const approved = requests.filter((r) => r.status === "approved").length;
  const rejected = requests.filter((r) => r.status === "rejected").length;
  const totalDaysApproved = requests
    .filter((r) => r.status === "approved")
    .reduce((s, r) => s + r.total_days, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Alerts */}
      {err && (
        <div
          style={{
            background: "var(--status-absent-bg)",
            border: "1px solid rgba(255,51,68,0.3)",
            borderRadius: "10px",
            padding: "0.8rem 1rem",
            color: "var(--status-absent)",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <AlertCircle size={15} />
          {err}
        </div>
      )}
      {success && (
        <div
          style={{
            background: "var(--status-present-bg)",
            border: "1px solid rgba(179,255,33,0.3)",
            borderRadius: "10px",
            padding: "0.8rem 1rem",
            color: "var(--status-present)",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <CheckCircle size={15} />
          {success}
        </div>
      )}

      {/* Metric Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
        }}
      >
        {[
          {
            label: "Pending Review",
            value: pending.length,
            color: "var(--status-late)",
            icon: <Clock size={16} color="var(--status-late)" />,
          },
          {
            label: "Approved (YTD)",
            value: approved,
            color: "var(--status-present)",
            icon: <CheckCircle size={16} color="var(--status-present)" />,
          },
          {
            label: "Rejected (YTD)",
            value: rejected,
            color: "var(--status-absent)",
            icon: <XCircle size={16} color="var(--status-absent)" />,
          },
          {
            label: "Days Approved",
            value: `${totalDaysApproved}d`,
            color: "var(--swift-neon)",
            icon: <CalendarCheck size={16} color="var(--swift-neon)" />,
          },
        ].map(({ label, value, color, icon }) => (
          <div
            key={label}
            className="swift-card"
            style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
              }}
            >
              {label}
              {icon}
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Header + Filter */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {["pending", "approved", "rejected", "all"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                background: filterStatus === s ? "var(--swift-neon)" : "var(--bg-surface-2)",
                color: filterStatus === s ? "#111315" : "var(--text-secondary)",
                border: "1px solid",
                borderColor: filterStatus === s ? "var(--swift-neon)" : "var(--border-subtle)",
                borderRadius: "9999px",
                padding: "0.3rem 0.85rem",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 0.15s",
              }}
            >
              {s}
              {s === "pending" && pending.length > 0 && (
                <span
                  style={{
                    marginLeft: "0.35rem",
                    background: "rgba(255,208,0,0.25)",
                    color: "var(--status-late)",
                    borderRadius: "9999px",
                    padding: "0 0.35rem",
                    fontSize: "0.68rem",
                  }}
                >
                  {pending.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          className="btn-secondary"
          style={{ fontSize: "0.8rem" }}
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Requests List */}
      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "var(--text-secondary)",
            fontSize: "0.85rem",
          }}
        >
          <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
          Loading requests…
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="swift-card"
          style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-muted)" }}
        >
          <ClipboardList size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.4 }} />
          <div>No {filterStatus !== "all" ? filterStatus : ""} leave requests for this year.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {filtered.map((req) => (
            <LeaveRow
              key={req.id}
              req={req}
              role="HR"
              reviewingId={reviewingId}
              setReviewingId={setReviewingId}
              reviewComment={reviewComment}
              setReviewComment={setReviewComment}
              onConfirmReview={handleReview}
              reviewLoading={reviewLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Page Root ─────────────────────────────────────────────────────────────────
export const LeavePage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Page Header */}
      <div>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
          }}
        >
          <CalendarOff size={24} color="var(--swift-neon)" />
          {user?.role === "Employee" ? "My Leave & Balance" : "Leave Management"}
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          {user?.role === "Employee"
            ? "View leave balances, apply for leave, track request status"
            : "Manage all leave requests · Approve or reject with one click · Automatic balance enforcement"}
        </p>
      </div>

      {user?.role === "Employee" ? <EmployeeLeaveView /> : <HRLeaveView />}
    </div>
  );
};
