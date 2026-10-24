import React, { useState } from "react";
import { X, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { api, type Department, type Designation } from "../../services/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: Department[];
  designations: Designation[];
}

export const RegisterEmployeeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  departments,
  designations
}) => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    department_id: departments[0]?.id || 0,
    designation_id: designations[0]?.id || 0,
    joining_date: new Date().toISOString().split("T")[0],
    basic_salary: 100000,
    temporary_password: "Welcome@2026"
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredDesignations = designations.filter(
    (d) => !formData.department_id || d.department_id === formData.department_id
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.basic_salary <= 0) {
      setError("Basic salary must be greater than 0");
      return;
    }

    setIsLoading(true);
    try {
      await api.registerEmployee({
        ...formData,
        department_id: formData.department_id || null,
        designation_id: formData.designation_id || null,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to register employee");
    } finally {
      setIsLoading(false);
    }
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
        maxWidth: "600px",
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
            <UserPlus size={20} color="var(--swift-neon)" />
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Register Employee & Create Login
            </h2>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: "0.35rem" }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {error && (
            <div style={{
              background: "rgba(251, 36, 54, 0.15)",
              border: "1px solid rgba(251, 36, 54, 0.3)",
              padding: "0.75rem",
              borderRadius: "8px",
              color: "#FB2436",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem"
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                First Name *
              </label>
              <input
                type="text"
                required
                className="swift-input"
                placeholder="e.g. Murtaza"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                Last Name *
              </label>
              <input
                type="text"
                required
                className="swift-input"
                placeholder="e.g. Khan"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
              Work Email Address * (Used for Employee Portal Sign-In)
            </label>
            <input
              type="email"
              required
              className="swift-input"
              placeholder="name@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                Phone Number
              </label>
              <input
                type="text"
                className="swift-input"
                placeholder="+92 300 1234567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                Joining Date *
              </label>
              <input
                type="date"
                required
                className="swift-input"
                value={formData.joining_date}
                onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                Department
              </label>
              <select
                className="swift-input"
                value={formData.department_id || ""}
                onChange={(e) => setFormData({ ...formData, department_id: parseInt(e.target.value) || 0 })}
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                Designation
              </label>
              <select
                className="swift-input"
                value={formData.designation_id || ""}
                onChange={(e) => setFormData({ ...formData, designation_id: parseInt(e.target.value) || 0 })}
              >
                <option value="">Select Designation</option>
                {filteredDesignations.map((desig) => (
                  <option key={desig.id} value={desig.id}>{desig.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                Basic Monthly Salary (PKR) *
              </label>
              <input
                type="number"
                min="1000"
                step="1000"
                required
                className="swift-input"
                value={formData.basic_salary}
                onChange={(e) => setFormData({ ...formData, basic_salary: parseFloat(e.target.value) || 0 })}
              />
              <span style={{ fontSize: "0.7rem", color: "var(--swift-neon)" }}>
                Gross: PKR {(formData.basic_salary * 1.5).toLocaleString()} (1.5x formula)
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                Temporary Login Password
              </label>
              <input
                type="text"
                required
                className="swift-input"
                value={formData.temporary_password}
                onChange={(e) => setFormData({ ...formData, temporary_password: e.target.value })}
              />
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                Must be changed on first login.
              </span>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
              Residential Address
            </label>
            <input
              type="text"
              className="swift-input"
              placeholder="City, Province, Country"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary">
              <CheckCircle2 size={16} />
              {isLoading ? "Registering..." : "Register Employee & Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
