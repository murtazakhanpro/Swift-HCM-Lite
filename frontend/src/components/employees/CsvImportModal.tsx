import React, { useState } from "react";
import { X, UploadCloud, FileSpreadsheet, AlertTriangle, CheckCircle2, Download, AlertCircle } from "lucide-react";
import { api, type CsvDryRunResponse } from "../../services/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CsvImportModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [dryRunResult, setDryRunResult] = useState<CsvDryRunResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setIsAnalyzing(true);
    setDryRunResult(null);

    try {
      const res = await api.dryRunCsv(selectedFile);
      setDryRunResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to analyze CSV file");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCommit = async () => {
    if (!file || !dryRunResult?.can_import) return;

    setIsCommitting(true);
    setError(null);
    try {
      await api.commitCsvImport(file);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to commit employee import");
    } finally {
      setIsCommitting(false);
    }
  };

  const downloadSampleCsv = () => {
    const sample = `first_name,last_name,email,joining_date,basic_salary,department,phone,address
Murtaza,Khan,murtaza.ai@company.com,2026-01-15,250000,ENG,+923001234567,Karachi
Fiza,Khan,fiza.web@company.com,2026-02-01,230000,ENG,+923007654321,Karachi
Ali,Raza,ali.raza@company.com,2026-03-01,180000,HR,+923005555555,Lahore
`;
    const blob = new Blob([sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "swift_hcm_sample_import.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "1rem"
    }}>
      <div className="glass-panel" style={{
        maxWidth: "680px",
        width: "100%",
        borderRadius: "16px",
        border: "1px solid var(--border-subtle)",
        overflow: "hidden",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column"
      }}>
        {/* Header */}
        <div style={{
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--bg-surface-0)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <FileSpreadsheet size={20} color="var(--swift-neon)" />
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
              CSV Employee Import (Dry-Run Engine)
            </h2>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: "0.35rem" }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "1.5rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Download Sample */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.75rem 1rem",
            background: "var(--bg-surface-1)",
            borderRadius: "8px",
            border: "1px solid var(--border-subtle)"
          }}>
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Need the standard CSV template?</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                Headers: first_name, last_name, email, joining_date, basic_salary, department
              </div>
            </div>
            <button onClick={downloadSampleCsv} className="btn-secondary" style={{ fontSize: "0.8rem", padding: "0.45rem 0.75rem" }}>
              <Download size={14} /> Download Template
            </button>
          </div>

          {error && (
            <div style={{
              background: "rgba(255, 51, 68, 0.15)",
              border: "1px solid rgba(255, 51, 68, 0.3)",
              padding: "0.75rem",
              borderRadius: "8px",
              color: "#FF3344",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem"
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* File Upload Area */}
          <div style={{
            border: "2px dashed var(--border-subtle)",
            borderRadius: "12px",
            padding: "2rem 1.5rem",
            textAlign: "center",
            backgroundColor: "var(--bg-surface-0)",
            cursor: "pointer",
            position: "relative"
          }}>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0,
                cursor: "pointer",
                width: "100%",
                height: "100%"
              }}
            />
            <UploadCloud size={36} color="var(--swift-neon)" style={{ margin: "0 auto 0.75rem" }} />
            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>
              {file ? file.name : "Choose or drag a .CSV file here"}
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              The system will automatically perform an instant dry-run validation.
            </p>
          </div>

          {isAnalyzing && (
            <div style={{ textAlign: "center", color: "var(--swift-neon)", fontSize: "0.85rem", padding: "1rem" }}>
              Executing Dry-Run Validation on server...
            </div>
          )}

          {/* Dry Run Result Feedback */}
          {dryRunResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "0.75rem",
                textAlign: "center"
              }}>
                <div style={{ background: "var(--bg-surface-1)", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)" }}>{dryRunResult.total_rows}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>TOTAL ROWS</div>
                </div>
                <div style={{ background: "var(--bg-surface-1)", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--status-present)" }}>{dryRunResult.valid_rows}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>VALID ROWS</div>
                </div>
                <div style={{ background: "var(--bg-surface-1)", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: dryRunResult.errors.length > 0 ? "var(--status-absent)" : "var(--status-present)" }}>
                    {dryRunResult.errors.length}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>ERRORS</div>
                </div>
              </div>

              {dryRunResult.can_import ? (
                <div style={{
                  padding: "0.85rem 1rem",
                  background: "rgba(179, 255, 33, 0.12)",
                  border: "1px solid rgba(179, 255, 33, 0.3)",
                  borderRadius: "8px",
                  color: "var(--status-present)",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem"
                }}>
                  <CheckCircle2 size={18} />
                  <span>Dry run passed! All {dryRunResult.valid_rows} rows are verified and ready for commit.</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{
                    padding: "0.85rem 1rem",
                    background: "rgba(255, 51, 68, 0.12)",
                    border: "1px solid rgba(255, 51, 68, 0.3)",
                    borderRadius: "8px",
                    color: "#FF3344",
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}>
                    <AlertTriangle size={18} />
                    <span>Dry run found {dryRunResult.errors.length} issues. Fix these errors in your CSV before importing:</span>
                  </div>

                  <div style={{
                    maxHeight: "220px",
                    overflowY: "auto",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    background: "var(--bg-surface-0)"
                  }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)", background: "var(--bg-surface-1)" }}>
                          <th style={{ padding: "0.5rem 0.75rem" }}>Row</th>
                          <th style={{ padding: "0.5rem 0.75rem" }}>Field</th>
                          <th style={{ padding: "0.5rem 0.75rem" }}>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dryRunResult.errors.map((err, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}>
                            <td style={{ padding: "0.5rem 0.75rem", fontFamily: "JetBrains Mono" }}>Row {err.row}</td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "var(--swift-neon)", fontFamily: "JetBrains Mono" }}>{err.field}</td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "#FF3344" }}>{err.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Action */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={!dryRunResult?.can_import || isCommitting}
              className="btn-primary"
            >
              <CheckCircle2 size={16} />
              {isCommitting ? "Importing Employees..." : `Commit Import (${dryRunResult?.valid_rows || 0} Records)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
