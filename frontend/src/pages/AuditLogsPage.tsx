import React, { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  Eye,
  X,
  Clock,
  Terminal,
  Activity,
  User,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface AuditLog {
  id: number;
  actor_id: number;
  actor_name: string;
  actor_role: string;
  action: string;
  entity: string;
  entity_id: string | null;
  before_state: string | null;
  after_state: string | null;
  ip_address: string | null;
  timestamp: string;
}

export const AuditLogsPage: React.FC = () => {
  const { user, token } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    try {
      let url = "http://127.0.0.1:8000/api/v1/comms/audit-logs?limit=100";
      if (actionFilter) url += `&action=${encodeURIComponent(actionFilter)}`;
      if (entityFilter) url += `&entity=${encodeURIComponent(entityFilter)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, actionFilter, entityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const parseJsonSafe = (str: string | null) => {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("FINALIZED") || action.includes("APPROVED")) return "#10b981";
    if (action.includes("DELETE") || action.includes("REJECT")) return "#ef4444";
    if (action.includes("CREATE") || action.includes("DRAFT")) return "var(--swift-neon)";
    return "#3b82f6";
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
            <ShieldCheck size={28} color="var(--swift-neon)" />
            Security Audit Trail & Governance
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Immutable administrative log trail tracking organization changes, payroll locking, and employee access.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            onClick={fetchLogs}
            className="btn-swift-secondary"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <RefreshCw size={16} />
            Refresh Trail
          </button>
        </div>
      </div>

      {/* Filter strip */}
      <div
        className="swift-card"
        style={{
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 200 }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Filter by action (e.g. PAYROLL, ANNOUNCEMENT)..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="swift-input"
            style={{ width: "100%", padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 200 }}>
          <Filter size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Filter by entity (e.g. PayrollRun, CompanySettings)..."
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="swift-input"
            style={{ width: "100%", padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
          />
        </div>

        {(actionFilter || entityFilter) && (
          <button
            onClick={() => {
              setActionFilter("");
              setEntityFilter("");
            }}
            className="btn-swift-secondary"
            style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="swift-card">
        {loading && logs.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
            Loading audit records...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
            <Activity size={40} style={{ opacity: 0.3, marginBottom: "0.5rem" }} />
            <p>No audit trail records match current filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                  <th style={{ padding: "0.75rem 1rem" }}>Timestamp (UTC)</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Actor</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Action</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Entity</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Entity ID</th>
                  <th style={{ padding: "0.75rem 1rem" }}>IP Address</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Inspect State</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const badgeColor = getActionBadgeColor(log.action);
                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "0.85rem 1rem", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{log.actor_name}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{log.actor_role}</div>
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.2rem 0.55rem",
                            borderRadius: 6,
                            fontSize: "0.725rem",
                            fontWeight: 700,
                            color: badgeColor,
                            backgroundColor: `${badgeColor}18`,
                            border: `1px solid ${badgeColor}40`,
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: "0.85rem 1rem", color: "var(--text-primary)", fontWeight: 600 }}>
                        {log.entity}
                      </td>
                      <td style={{ padding: "0.85rem 1rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                        {log.entity_id || "—"}
                      </td>
                      <td style={{ padding: "0.85rem 1rem", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                        {log.ip_address || "Internal/Local"}
                      </td>
                      <td style={{ padding: "0.85rem 1rem", textAlign: "right" }}>
                        {(log.before_state || log.after_state) ? (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="btn-swift-secondary"
                            style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                          >
                            <Eye size={13} />
                            State Diff
                          </button>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>No state</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* State Inspection Modal */}
      {selectedLog && (
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
              maxWidth: 720,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              border: "1px solid rgba(179, 255, 33, 0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Terminal size={20} color="var(--swift-neon)" />
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Audit State Inspection #{selectedLog.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>ACTION</span>
                <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{selectedLog.action}</div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>ENTITY</span>
                <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{selectedLog.entity} ({selectedLog.entity_id})</div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>ACTOR</span>
                <div style={{ color: "var(--text-primary)" }}>{selectedLog.actor_name} ({selectedLog.actor_role})</div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>TIMESTAMP</span>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{new Date(selectedLog.timestamp).toLocaleString()}</div>
              </div>
            </div>

            {/* Before & After JSON Boxes */}
            <div style={{ display: "grid", gridTemplateColumns: selectedLog.before_state && selectedLog.after_state ? "1fr 1fr" : "1fr", gap: "1rem" }}>
              {selectedLog.before_state && (
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f87171", marginBottom: "0.35rem" }}>
                    BEFORE STATE
                  </div>
                  <pre
                    style={{
                      padding: "0.75rem",
                      borderRadius: 6,
                      backgroundColor: "#0d0f11",
                      border: "1px solid var(--border-subtle)",
                      color: "#a0a5ad",
                      fontSize: "0.75rem",
                      fontFamily: "JetBrains Mono, monospace",
                      maxHeight: 300,
                      overflowY: "auto",
                      margin: 0,
                    }}
                  >
                    {JSON.stringify(parseJsonSafe(selectedLog.before_state), null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.after_state && (
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--swift-neon)", marginBottom: "0.35rem" }}>
                    AFTER STATE
                  </div>
                  <pre
                    style={{
                      padding: "0.75rem",
                      borderRadius: 6,
                      backgroundColor: "#0d0f11",
                      border: "1px solid var(--border-subtle)",
                      color: "#a0a5ad",
                      fontSize: "0.75rem",
                      fontFamily: "JetBrains Mono, monospace",
                      maxHeight: 300,
                      overflowY: "auto",
                      margin: 0,
                    }}
                  >
                    {JSON.stringify(parseJsonSafe(selectedLog.after_state), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
