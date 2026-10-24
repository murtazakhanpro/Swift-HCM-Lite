import React, { useEffect, useState, useCallback } from "react";
import {
  Receipt,
  Plus,
  RefreshCw,
  Lock,
  Unlock,
  CheckCircle,
  AlertCircle,
  FileText,
  DollarSign,
  Calendar,
  User,
  Building,
  TrendingDown,
  Printer,
  Trash2,
  ChevronRight,
  Eye,
  X,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface PayrollRun {
  id: number;
  month_year: string;
  working_days: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  status: "draft" | "finalized";
  prepared_by?: number;
  finalized_by?: number;
  created_at: string;
  finalized_at?: string;
  payslip_count: number;
}

interface Payslip {
  id: number;
  payroll_run_id: number;
  month_year: string;
  employee_id: number;
  employee_name: string;
  employee_code: string;
  basic_salary: number;
  hra: number;
  medical_allowance: number;
  gross_salary: number;
  working_days: number;
  absent_days: number;
  half_days: number;
  late_count: number;
  unpaid_leave_days: number;
  absence_deduction: number;
  late_penalty_deduction: number;
  income_tax: number;
  net_salary: number;
  created_at: string;
}

interface PayrollRunDetail extends PayrollRun {
  payslips: Payslip[];
}

interface PayrollSummary {
  total_runs: number;
  draft_runs: number;
  finalized_runs: number;
  latest_month: string | null;
  latest_net_payout: number;
  latest_employee_count: number;
}

export const PayrollPage: React.FC = () => {
  const { user, token } = useAuth();
  const isHRorAdmin = user?.role === "Admin" || user?.role === "HR";
  const isAdmin = user?.role === "Admin";

  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [myPayslips, setMyPayslips] = useState<Payslip[]>([]);

  // Modals & inspect states
  const [selectedRun, setSelectedRun] = useState<PayrollRunDetail | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [showRunModal, setShowRunModal] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState<PayrollRun | null>(null);

  // Form states
  const [formMonth, setFormMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [formWorkingDays, setFormWorkingDays] = useState(22);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const formatPKR = (amount: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const fetchPayrollData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      if (isHRorAdmin) {
        const [runsRes, sumRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/api/v1/payroll/runs", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("http://127.0.0.1:8000/api/v1/payroll/summary", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (runsRes.ok) {
          const rData = await runsRes.json();
          setRuns(rData);
        }
        if (sumRes.ok) {
          const sData = await sumRes.json();
          setSummary(sData);
        }
      } else {
        // Employee view
        const res = await fetch("http://127.0.0.1:8000/api/v1/payroll/payslips/my", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const pData = await res.json();
          setMyPayslips(pData);
        }
      }
    } catch {
      setErrorMsg("Failed to connect to payroll services.");
    } finally {
      setLoading(false);
    }
  }, [token, isHRorAdmin]);

  useEffect(() => {
    fetchPayrollData();
  }, [fetchPayrollData]);

  // Load single run details
  const handleInspectRun = async (runId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/payroll/runs/${runId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedRun(data);
      } else {
        setErrorMsg("Could not load details for this payroll run.");
      }
    } catch {
      setErrorMsg("Failed to fetch payroll run details.");
    }
  };

  // Create or recalculate draft run
  const handleRunPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/payroll/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          month_year: formMonth,
          working_days: Number(formWorkingDays),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to generate payroll run.");
      }

      setSuccessMsg(`Payroll run for ${formMonth} computed successfully!`);
      setShowRunModal(false);
      setSelectedRun(data); // Open the run immediately
      fetchPayrollData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to generate payroll run.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Finalize payroll run (Admin only)
  const handleFinalizeRun = async () => {
    if (!token || !showFinalizeConfirm) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/v1/payroll/runs/${showFinalizeConfirm.id}/finalize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ confirm: true }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to finalize payroll run.");
      }

      setSuccessMsg(
        `Payroll run for ${showFinalizeConfirm.month_year} has been locked & published! Employees notified.`
      );
      setShowFinalizeConfirm(null);
      if (selectedRun?.id === data.id) {
        setSelectedRun(data);
      }
      fetchPayrollData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to finalize payroll run.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Delete draft run (Admin only)
  const handleDeleteRun = async (runId: number, month: string) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete the draft run for ${month}?`)) return;

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/payroll/runs/${runId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to delete run.");
      }

      setSuccessMsg(`Draft run for ${month} removed.`);
      if (selectedRun?.id === runId) setSelectedRun(null);
      fetchPayrollData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to delete draft run.");
      }
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.75rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <Receipt size={28} color="var(--swift-neon)" />
            {isHRorAdmin ? "Payroll Management & Compensation" : "My Compensation & Payslips"}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            {isHRorAdmin
              ? "Salary formula: 1.5x Basic (40% HRA + 10% Medical), automatic late penalties (3:0.5d), tax slabs & locking."
              : "View verified payslips, earnings composition, deductions, and tax withholdings."}
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            onClick={fetchPayrollData}
            className="btn-swift-secondary"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            title="Refresh records"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          {isHRorAdmin && (
            <button
              onClick={() => {
                setShowRunModal(true);
                setErrorMsg(null);
              }}
              className="btn-swift-primary"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <Plus size={18} />
              Calculate & Draft Run
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div
          style={{
            padding: "0.85rem 1.25rem",
            marginBottom: "1.25rem",
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: 8,
            color: "#f87171",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            fontSize: "0.875rem",
          }}
        >
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "#f87171", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: "0.85rem 1.25rem",
            marginBottom: "1.25rem",
            backgroundColor: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            borderRadius: 8,
            color: "#34d399",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            fontSize: "0.875rem",
          }}
        >
          <CheckCircle size={18} />
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "#34d399", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── HR / ADMIN VIEW ─────────────────────────────────────────────────── */}
      {isHRorAdmin && (
        <>
          {/* KPI Strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1.25rem",
              marginBottom: "1.75rem",
            }}
          >
            <div className="swift-card">
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
                <span>LATEST NET PAYOUT</span>
                <DollarSign size={18} color="var(--swift-neon)" />
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.4rem" }}>
                {summary ? formatPKR(summary.latest_net_payout) : "PKR 0"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Month: {summary?.latest_month || "None"} ({summary?.latest_employee_count || 0} staff)
              </div>
            </div>

            <div className="swift-card">
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
                <span>FINALIZED RUNS</span>
                <Lock size={18} color="#10b981" />
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#10b981", marginTop: "0.4rem" }}>
                {summary?.finalized_runs ?? 0}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Locked with immutable audit stamps
              </div>
            </div>

            <div className="swift-card">
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
                <span>DRAFT RUNS</span>
                <Unlock size={18} color="#f59e0b" />
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f59e0b", marginTop: "0.4rem" }}>
                {summary?.draft_runs ?? 0}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Pending audit verification & locking
              </div>
            </div>

            <div className="swift-card">
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>
                <span>FORMULA ENGINE</span>
                <Receipt size={18} color="var(--swift-neon)" />
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.4rem" }}>
                Gross = 1.5x Basic
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                40% HRA + 10% Medical + Slabs
              </div>
            </div>
          </div>

          {/* Payroll Runs History */}
          <div className="swift-card" style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "1rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Calendar size={20} color="var(--swift-neon)" />
              Monthly Payroll Cycles
            </h2>

            {loading && runs.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                Loading payroll runs...
              </div>
            ) : runs.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                <Receipt size={40} style={{ opacity: 0.3, marginBottom: "0.5rem" }} />
                <p>No payroll runs generated yet.</p>
                <button
                  onClick={() => setShowRunModal(true)}
                  className="btn-swift-primary"
                  style={{ marginTop: "1rem" }}
                >
                  Generate First Payroll Run
                </button>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                      <th style={{ padding: "0.75rem 1rem" }}>Month</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Working Days</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Total Gross</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Deductions</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Net Payout</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Status</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => {
                      const isFinal = r.status === "finalized";
                      const isCurrentSelected = selectedRun?.id === r.id;
                      return (
                        <tr
                          key={r.id}
                          style={{
                            borderBottom: "1px solid var(--border-subtle)",
                            backgroundColor: isCurrentSelected ? "rgba(179, 255, 33, 0.05)" : "transparent",
                          }}
                        >
                          <td style={{ padding: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                            {r.month_year}
                          </td>
                          <td style={{ padding: "1rem", color: "var(--text-secondary)" }}>
                            {r.working_days} days
                          </td>
                          <td style={{ padding: "1rem", color: "var(--text-primary)", fontWeight: 600 }}>
                            {formatPKR(r.total_gross)}
                          </td>
                          <td style={{ padding: "1rem", color: "#f87171" }}>
                            -{formatPKR(r.total_deductions)}
                          </td>
                          <td style={{ padding: "1rem", color: "var(--swift-neon)", fontWeight: 800 }}>
                            {formatPKR(r.total_net)}
                          </td>
                          <td style={{ padding: "1rem" }}>
                            {isFinal ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                  padding: "0.25rem 0.65rem",
                                  borderRadius: 12,
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                                  color: "#34d399",
                                  border: "1px solid rgba(16, 185, 129, 0.3)",
                                }}
                              >
                                <Lock size={12} />
                                Finalized & Locked
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                  padding: "0.25rem 0.65rem",
                                  borderRadius: 12,
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  backgroundColor: "rgba(245, 158, 11, 0.15)",
                                  color: "#fbbf24",
                                  border: "1px solid rgba(245, 158, 11, 0.3)",
                                }}
                              >
                                <Unlock size={12} />
                                Draft Mode
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "1rem", textAlign: "right" }}>
                            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                              <button
                                onClick={() => handleInspectRun(r.id)}
                                className="btn-swift-secondary"
                                style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                              >
                                <Eye size={14} />
                                Inspect ({r.payslip_count})
                              </button>

                              {!isFinal && isAdmin && (
                                <>
                                  <button
                                    onClick={() => setShowFinalizeConfirm(r)}
                                    className="btn-swift-primary"
                                    style={{
                                      padding: "0.35rem 0.75rem",
                                      fontSize: "0.8rem",
                                      backgroundColor: "rgba(16, 185, 129, 0.2)",
                                      borderColor: "#10b981",
                                      color: "#34d399",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "0.35rem",
                                    }}
                                    title="Lock and finalize run"
                                  >
                                    <Lock size={14} />
                                    Finalize
                                  </button>

                                  <button
                                    onClick={() => handleDeleteRun(r.id, r.month_year)}
                                    style={{
                                      background: "none",
                                      border: "1px solid rgba(239, 68, 68, 0.3)",
                                      color: "#f87171",
                                      borderRadius: 6,
                                      padding: "0.35rem",
                                      cursor: "pointer",
                                    }}
                                    title="Delete draft run"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active Inspect View for Selected Run */}
          {selectedRun && (
            <div className="swift-card" style={{ marginBottom: "2rem", border: "1px solid rgba(179, 255, 33, 0.35)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "1rem",
                  marginBottom: "1.25rem",
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 800,
                      color: "var(--text-primary)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span>Run Details: {selectedRun.month_year}</span>
                    {selectedRun.status === "finalized" ? (
                      <span style={{ fontSize: "0.75rem", color: "#34d399", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        <Lock size={14} /> Locked
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "#fbbf24", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        <Unlock size={14} /> Draft
                      </span>
                    )}
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {selectedRun.payslips.length} employees calculated • Net Total: {formatPKR(selectedRun.total_net)}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="Search employee code or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="swift-input"
                    style={{ minWidth: 240, padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
                  />
                  <button
                    onClick={() => setSelectedRun(null)}
                    style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Payslip Items Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Employee</th>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Basic</th>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Allowances (50%)</th>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Gross (1.5x)</th>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Absences / Lates</th>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Total Deductions</th>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Net Salary</th>
                      <th style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>Payslip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRun.payslips
                      .filter(
                        (p) =>
                          p.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.employee_code.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((p) => {
                        const totalDed = p.absence_deduction + p.late_penalty_deduction + p.income_tax;
                        return (
                          <tr key={p.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                            <td style={{ padding: "0.75rem" }}>
                              <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{p.employee_name}</div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{p.employee_code}</div>
                            </td>
                            <td style={{ padding: "0.75rem", color: "var(--text-secondary)" }}>
                              {formatPKR(p.basic_salary)}
                            </td>
                            <td style={{ padding: "0.75rem", color: "var(--text-secondary)" }}>
                              {formatPKR(p.hra + p.medical_allowance)}
                              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                HRA: {formatPKR(p.hra)} | Med: {formatPKR(p.medical_allowance)}
                              </div>
                            </td>
                            <td style={{ padding: "0.75rem", fontWeight: 700, color: "var(--text-primary)" }}>
                              {formatPKR(p.gross_salary)}
                            </td>
                            <td style={{ padding: "0.75rem", color: "var(--text-secondary)" }}>
                              <div>
                                {p.absent_days} abs • {p.half_days} half • {p.unpaid_leave_days} unpaid lv
                              </div>
                              <div style={{ fontSize: "0.75rem", color: p.late_count >= 3 ? "#f59e0b" : "var(--text-muted)" }}>
                                {p.late_count} lates {p.late_count >= 3 ? "(Penalty applied)" : ""}
                              </div>
                            </td>
                            <td style={{ padding: "0.75rem", color: "#f87171", fontWeight: 600 }}>
                              -{formatPKR(totalDed)}
                              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                Tax: {formatPKR(p.income_tax)} | Att: {formatPKR(p.absence_deduction + p.late_penalty_deduction)}
                              </div>
                            </td>
                            <td style={{ padding: "0.75rem", color: "var(--swift-neon)", fontWeight: 800, fontSize: "0.95rem" }}>
                              {formatPKR(p.net_salary)}
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "right" }}>
                              <button
                                onClick={() => setSelectedPayslip(p)}
                                className="btn-swift-secondary"
                                style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                              >
                                <FileText size={13} />
                                View Slip
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── EMPLOYEE SELF-SERVICE VIEW ───────────────────────────────────────── */}
      {!isHRorAdmin && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {/* Latest Payslip Highlight */}
          {myPayslips.length > 0 && (
            <div
              className="swift-card"
              style={{
                border: "1px solid rgba(179, 255, 33, 0.4)",
                background: "linear-gradient(135deg, rgba(20,24,20,0.9), rgba(15,15,15,0.95))",
                padding: "1.75rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.25rem 0.65rem",
                      borderRadius: 12,
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      color: "#34d399",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <CheckCircle size={12} />
                    Verified & Disbursed
                  </span>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    Latest Statement: {myPayslips[0].month_year}
                  </h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                    Standard pay cycle based on {myPayslips[0].working_days} working days.
                  </p>
                </div>

                <button
                  onClick={() => setSelectedPayslip(myPayslips[0])}
                  className="btn-swift-primary"
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                  <FileText size={18} />
                  View & Download Full Payslip
                </button>
              </div>

              {/* Key numbers grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: "1rem",
                  marginTop: "1.5rem",
                  paddingTop: "1.25rem",
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>BASIC SALARY</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.25rem" }}>
                    {formatPKR(myPayslips[0].basic_salary)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>ALLOWANCES (50%)</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.25rem" }}>
                    {formatPKR(myPayslips[0].hra + myPayslips[0].medical_allowance)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>GROSS EARNINGS</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.25rem" }}>
                    {formatPKR(myPayslips[0].gross_salary)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>TOTAL DEDUCTIONS</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f87171", marginTop: "0.25rem" }}>
                    -{formatPKR(myPayslips[0].absence_deduction + myPayslips[0].late_penalty_deduction + myPayslips[0].income_tax)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--swift-neon)", fontWeight: 700 }}>NET TAKE-HOME</div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 900, color: "var(--swift-neon)", marginTop: "0.25rem" }}>
                    {formatPKR(myPayslips[0].net_salary)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payslip History List */}
          <div className="swift-card">
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "1rem", color: "var(--text-primary)" }}>
              Payslip Archive
            </h3>

            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                Loading payslip history...
              </div>
            ) : myPayslips.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                <Receipt size={40} style={{ opacity: 0.3, marginBottom: "0.5rem" }} />
                <p>No finalized payslips available yet.</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  Payslips appear here once approved & finalized by Company Admin.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {myPayslips.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPayslip(p)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "1rem",
                      borderRadius: 8,
                      backgroundColor: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--border-subtle)",
                      cursor: "pointer",
                      transition: "border-color 0.2s, background 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--swift-neon)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 8,
                          backgroundColor: "rgba(179, 255, 33, 0.1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--swift-neon)",
                        }}
                      >
                        <FileText size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{p.month_year} Statement</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          Gross: {formatPKR(p.gross_salary)} • Tax: {formatPKR(p.income_tax)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--swift-neon)" }}>
                          {formatPKR(p.net_salary)}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "#34d399" }}>Finalized</div>
                      </div>
                      <ChevronRight size={18} color="var(--text-muted)" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: Run / Draft Monthly Payroll ─────────────────────────────────── */}
      {showRunModal && (
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
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Receipt size={22} color="var(--swift-neon)" />
                Draft Monthly Payroll
              </h3>
              <button
                onClick={() => setShowRunModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRunPayroll}>
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.4rem" }}>
                  Target Payroll Month (YYYY-MM)
                </label>
                <input
                  type="month"
                  value={formMonth}
                  onChange={(e) => setFormMonth(e.target.value)}
                  className="swift-input"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.4rem" }}>
                  Official Working Days in Month
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formWorkingDays}
                  onChange={(e) => setFormWorkingDays(Number(e.target.value))}
                  className="swift-input"
                  style={{ width: "100%" }}
                  required
                />
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                  Standard months are 22 working days (excluding weekends & national holidays).
                </p>
              </div>

              <div
                style={{
                  padding: "0.85rem",
                  borderRadius: 8,
                  backgroundColor: "rgba(255, 255, 255, 0.04)",
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  marginBottom: "1.5rem",
                  borderLeft: "3px solid var(--swift-neon)",
                }}
              >
                <strong>Automated Rules Applied:</strong>
                <ul style={{ margin: "0.35rem 0 0 1.25rem", padding: 0 }}>
                  <li>Gross Salary = 1.5x Basic (40% HRA + 10% Medical)</li>
                  <li>Absence & unpaid leave prorated by working days</li>
                  <li>3 Lates = 0.5-day salary deduction</li>
                  <li>Progressive income tax slabs calculated automatically</li>
                </ul>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowRunModal(false)}
                  className="btn-swift-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-swift-primary"
                  disabled={submitting}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                  {submitting ? "Calculating..." : "Compute & Save Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Admin Finalize Confirmation ───────────────────────────────── */}
      {showFinalizeConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
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
              border: "1px solid rgba(16, 185, 129, 0.5)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", color: "#34d399" }}>
              <ShieldAlert size={28} />
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>
                Lock & Finalize Payroll
              </h3>
            </div>

            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.5, marginBottom: "1rem" }}>
              You are about to lock the payroll run for <strong>{showFinalizeConfirm.month_year}</strong> with total payout of{" "}
              <strong style={{ color: "var(--swift-neon)" }}>{formatPKR(showFinalizeConfirm.total_net)}</strong>.
            </p>

            <div
              style={{
                padding: "0.85rem",
                borderRadius: 8,
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#fca5a5",
                fontSize: "0.8rem",
                marginBottom: "1.5rem",
              }}
            >
              <strong>Important Financial Notice:</strong> Once finalized, this run cannot be deleted or re-calculated.
              Payslips will be published to employee portals with push notifications immediately.
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowFinalizeConfirm(null)}
                className="btn-swift-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalizeRun}
                className="btn-swift-primary"
                disabled={submitting}
                style={{
                  backgroundColor: "#10b981",
                  borderColor: "#10b981",
                  color: "#000",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <Lock size={16} />
                {submitting ? "Locking..." : "Confirm & Finalize"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Printable / Downloadable Payslip ──────────────────────────── */}
      {selectedPayslip && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: "1rem",
            overflowY: "auto",
          }}
        >
          <div
            className="swift-card"
            style={{
              maxWidth: 720,
              width: "100%",
              backgroundColor: "#141715",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              padding: "2rem",
              position: "relative",
            }}
          >
            {/* Header controls (hidden in print) */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
                borderBottom: "1px solid var(--border-subtle)",
                paddingBottom: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                <Receipt size={18} color="var(--swift-neon)" />
                <span>OFFICIAL SALARY STATEMENT</span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => window.print()}
                  className="btn-swift-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                >
                  <Printer size={15} />
                  Print / Save PDF
                </button>
                <button
                  onClick={() => setSelectedPayslip(null)}
                  style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable Payslip Body */}
            <div id="printable-payslip">
              {/* Company Branding */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "0.05em" }}>
                    LYNTICA TECHNOLOGIES
                  </h2>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Swift-HCM Lite Payroll Engine • Saylani Hackathon 2026
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--swift-neon)" }}>
                    STATEMENT PERIOD
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    {selectedPayslip.month_year}
                  </div>
                </div>
              </div>

              {/* Employee Meta Box */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                  padding: "1rem",
                  borderRadius: 8,
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.85rem",
                  marginBottom: "1.5rem",
                }}
              >
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Employee Name: </span>
                  <strong style={{ color: "var(--text-primary)" }}>{selectedPayslip.employee_name}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Employee ID: </span>
                  <strong style={{ color: "var(--text-primary)" }}>{selectedPayslip.employee_code}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Working Days: </span>
                  <strong style={{ color: "var(--text-primary)" }}>{selectedPayslip.working_days}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Absences / Penalties: </span>
                  <strong style={{ color: "var(--text-primary)" }}>
                    {selectedPayslip.absent_days} Abs, {selectedPayslip.late_count} Lates
                  </strong>
                </div>
              </div>

              {/* Earnings & Deductions Dual Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                {/* Earnings */}
                <div>
                  <div
                    style={{
                      padding: "0.5rem 0.75rem",
                      backgroundColor: "rgba(179, 255, 33, 0.08)",
                      color: "var(--swift-neon)",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      borderRadius: "6px 6px 0 0",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    EARNINGS (1.5x Formula)
                  </div>
                  <div style={{ border: "1px solid var(--border-subtle)", borderTop: "none", borderRadius: "0 0 6px 6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0.75rem", fontSize: "0.85rem", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Basic Salary</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{formatPKR(selectedPayslip.basic_salary)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0.75rem", fontSize: "0.85rem", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ color: "var(--text-secondary)" }}>House Rent Allowance (40%)</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{formatPKR(selectedPayslip.hra)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0.75rem", fontSize: "0.85rem", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Medical Allowance (10%)</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{formatPKR(selectedPayslip.medical_allowance)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem", fontSize: "0.9rem", fontWeight: 800, backgroundColor: "rgba(255, 255, 255, 0.02)" }}>
                      <span style={{ color: "var(--text-primary)" }}>GROSS EARNINGS</span>
                      <span style={{ color: "var(--text-primary)" }}>{formatPKR(selectedPayslip.gross_salary)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <div
                    style={{
                      padding: "0.5rem 0.75rem",
                      backgroundColor: "rgba(239, 68, 68, 0.08)",
                      color: "#f87171",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      borderRadius: "6px 6px 0 0",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    DEDUCTIONS & TAX
                  </div>
                  <div style={{ border: "1px solid var(--border-subtle)", borderTop: "none", borderRadius: "0 0 6px 6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0.75rem", fontSize: "0.85rem", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Absence Deductions</span>
                      <span style={{ color: "#f87171" }}>-{formatPKR(selectedPayslip.absence_deduction)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0.75rem", fontSize: "0.85rem", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Late Penalty (3:0.5d)</span>
                      <span style={{ color: "#f87171" }}>-{formatPKR(selectedPayslip.late_penalty_deduction)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0.75rem", fontSize: "0.85rem", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Income Tax Withheld</span>
                      <span style={{ color: "#f87171" }}>-{formatPKR(selectedPayslip.income_tax)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem", fontSize: "0.9rem", fontWeight: 800, backgroundColor: "rgba(255, 255, 255, 0.02)" }}>
                      <span style={{ color: "#f87171" }}>TOTAL DEDUCTIONS</span>
                      <span style={{ color: "#f87171" }}>
                        -{formatPKR(selectedPayslip.absence_deduction + selectedPayslip.late_penalty_deduction + selectedPayslip.income_tax)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Payable Banner */}
              <div
                style={{
                  padding: "1.25rem",
                  borderRadius: 8,
                  backgroundColor: "rgba(179, 255, 33, 0.12)",
                  border: "1px solid rgba(179, 255, 33, 0.4)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1.5rem",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--swift-neon)" }}>
                    NET TAKE-HOME SALARY
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                    Credited via direct electronic payroll transfer
                  </div>
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--swift-neon)" }}>
                  {formatPKR(selectedPayslip.net_salary)}
                </div>
              </div>

              {/* Authorized Stamp */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)", paddingTop: "1rem" }}>
                <div>System generated document • Swift-HCM Lite Cryptographic Audit Trail</div>
                <div style={{ fontStyle: "italic" }}>Authorized by Finance & HR Management</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
