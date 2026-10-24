import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Briefcase,
  DollarSign,
  Edit3,
  AlertCircle,
  X
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, type Employee360, type Department, type Designation } from "../services/api";

export const Employee360Page: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [employee, setEmployee] = useState<Employee360 | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState({
    phone: "",
    address: "",
    basic_salary: 0,
    status: "active",
    department_id: 0,
    designation_id: 0
  });

  const empId = parseInt(id || "0");

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [empData, depts, desigs] = await Promise.all([
        api.getEmployee360(empId),
        api.listDepartments(),
        api.listDesignations()
      ]);
      setEmployee(empData);
      setDepartments(depts);
      setDesignations(desigs);
      setEditData({
        phone: empData.phone || "",
        address: empData.address || "",
        basic_salary: empData.basic_salary,
        status: empData.status,
        department_id: empData.department_id || 0,
        designation_id: empData.designation_id || 0
      });
    } catch (err: any) {
      setError(err.message || "Failed to load employee profile");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (empId) {
      loadData();
    }
  }, [empId]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    try {
      if (user?.role === "Employee") {
        // Employee can only update phone and address
        await api.updateEmployee(employee.id, {
          phone: editData.phone,
          address: editData.address
        });
      } else {
        // HR can update all fields
        await api.updateEmployee(employee.id, {
          phone: editData.phone,
          address: editData.address,
          basic_salary: editData.basic_salary,
          status: editData.status,
          department_id: editData.department_id || null,
          designation_id: editData.designation_id || null
        });
      }
      setIsEditOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update profile");
    }
  };

  if (isLoading) {
    return (
      <div className="swift-card" style={{ padding: "3rem", textAlign: "center", color: "var(--swift-neon)" }}>
        <p style={{ fontWeight: 600 }}>Loading Employee 360 profile...</p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="swift-card" style={{ padding: "2.5rem", textAlign: "center" }}>
        <AlertCircle size={32} color="#FB2436" style={{ margin: "0 auto 1rem" }} />
        <h2 style={{ fontSize: "1.25rem", color: "var(--text-primary)" }}>{error || "Employee not found"}</h2>
        <button onClick={() => navigate("/employees")} className="btn-secondary" style={{ marginTop: "1rem" }}>
          <ArrowLeft size={16} /> Back to Directory
        </button>
      </div>
    );
  }

  const isSelf = user?.role === "Employee" && user.employee_id === employee.id;
  const isHr = user?.role === "HR";
  const canEdit = isSelf || isHr;

  const basic = employee.basic_salary;
  const hra = basic * 0.4;
  const medical = basic * 0.1;
  const gross = employee.gross_salary;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Back Link & Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link to="/employees" className="btn-secondary" style={{ textDecoration: "none", fontSize: "0.85rem" }}>
          <ArrowLeft size={16} /> Back to Directory
        </Link>
        {canEdit && (
          <button onClick={() => setIsEditOpen(true)} className="btn-primary">
            <Edit3 size={16} /> Edit Profile Details
          </button>
        )}
      </div>

      {/* Hero Header Card */}
      <div className="glass-panel" style={{
        padding: "2rem",
        borderRadius: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1.5rem",
        border: "1px solid rgba(179, 255, 33, 0.2)",
        background: "linear-gradient(135deg, rgba(28, 36, 39, 0.9) 0%, rgba(24, 25, 29, 0.95) 100%)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <img
            src="/assets/Role-Based System Avatars/Person_avatar_icon.jpg"
            alt="Avatar"
            style={{ width: "72px", height: "72px", borderRadius: "18px", border: "2px solid var(--swift-neon)", objectFit: "cover" }}
          />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {employee.first_name} {employee.last_name}
              </span>
              <span className={`badge ${employee.status === "active" ? "badge-present" : "badge-late"}`}>
                {employee.status}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.25rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              <span style={{ color: "var(--swift-neon)", fontFamily: "JetBrains Mono", fontWeight: 600 }}>
                {employee.employee_code}
              </span>
              <span>•</span>
              <span>{employee.designation?.title || "Designation Pending"}</span>
              <span>•</span>
              <span style={{ color: "var(--swift-blue)" }}>{employee.department?.name || "General"}</span>
            </div>
          </div>
        </div>

        {/* 360 Activity Counter Cards */}
        <div style={{ display: "flex", gap: "1rem" }}>
          <div style={{ background: "var(--bg-surface-0)", padding: "0.75rem 1.25rem", borderRadius: "10px", textAlign: "center", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--status-present)" }}>
              {employee.attendance_count}
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>ATTENDANCE LOGS</div>
          </div>
          <div style={{ background: "var(--bg-surface-0)", padding: "0.75rem 1.25rem", borderRadius: "10px", textAlign: "center", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--swift-blue)" }}>
              {employee.approved_leaves_count}
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>APPROVED LEAVES</div>
          </div>
          <div style={{ background: "var(--bg-surface-0)", padding: "0.75rem 1.25rem", borderRadius: "10px", textAlign: "center", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--swift-neon)" }}>
              {employee.total_payslips_count}
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>PAYSLIPS</div>
          </div>
        </div>
      </div>

      {/* Main Details Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem" }}>
        {/* Left Column: Personal & Employment Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="swift-card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Briefcase size={18} color="var(--swift-neon)" /> Employment Profile
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Email Address</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{employee.email}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Phone Number</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{employee.phone || "Not set"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Joining Date</span>
                <span style={{ color: "var(--text-primary)", fontFamily: "JetBrains Mono" }}>{employee.joining_date}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Department</span>
                <span style={{ color: "var(--swift-blue)", fontWeight: 600 }}>{employee.department?.name || "General"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Designation</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{employee.designation?.title || "Staff"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Address</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{employee.address || "Not specified"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Salary Structure (1.5x formula) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="swift-card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <DollarSign size={18} color="var(--swift-neon)" /> Salary Structure (PKR)
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
              Formula per Hackathon Brief: Gross = 1.5 × Basic (HRA 40%, Medical 10%)
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0.85rem", background: "var(--bg-surface-0)", borderRadius: "8px" }}>
                <span style={{ color: "var(--text-secondary)" }}>Basic Salary (Base)</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)", fontFamily: "JetBrains Mono" }}>
                  PKR {basic.toLocaleString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0.85rem", background: "var(--bg-surface-0)", borderRadius: "8px" }}>
                <span style={{ color: "var(--text-secondary)" }}>House Rent Allowance (HRA 40%)</span>
                <span style={{ fontWeight: 600, color: "var(--swift-blue)", fontFamily: "JetBrains Mono" }}>
                  PKR {hra.toLocaleString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0.85rem", background: "var(--bg-surface-0)", borderRadius: "8px" }}>
                <span style={{ color: "var(--text-secondary)" }}>Medical Allowance (10%)</span>
                <span style={{ fontWeight: 600, color: "var(--swift-blue)", fontFamily: "JetBrains Mono" }}>
                  PKR {medical.toLocaleString()}
                </span>
              </div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "0.85rem 1rem",
                background: "rgba(179, 255, 33, 0.12)",
                borderRadius: "10px",
                border: "1px solid rgba(179, 255, 33, 0.3)",
                marginTop: "0.5rem"
              }}>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Monthly Gross Salary</span>
                <span style={{ fontWeight: 800, color: "var(--swift-neon)", fontSize: "1.1rem", fontFamily: "JetBrains Mono" }}>
                  PKR {gross.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "1rem"
        }}>
          <div className="glass-panel" style={{ maxWidth: "500px", width: "100%", borderRadius: "16px", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                {isSelf ? "Edit Contact Information" : "Edit Employee Details"}
              </h3>
              <button onClick={() => setIsEditOpen(false)} className="btn-secondary" style={{ padding: "0.3rem" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Phone Number
                </label>
                <input
                  type="text"
                  className="swift-input"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Residential Address
                </label>
                <input
                  type="text"
                  className="swift-input"
                  value={editData.address}
                  onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                />
              </div>

              {isHr && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      Basic Salary (PKR) [HR Only]
                    </label>
                    <input
                      type="number"
                      min="1000"
                      className="swift-input"
                      value={editData.basic_salary}
                      onChange={(e) => setEditData({ ...editData, basic_salary: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      Status [HR Only]
                    </label>
                    <select
                      className="swift-input"
                      value={editData.status}
                      onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="probation">Probation</option>
                      <option value="resigned">Resigned</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      Department [HR Only]
                    </label>
                    <select
                      className="swift-input"
                      value={editData.department_id}
                      onChange={(e) => setEditData({ ...editData, department_id: parseInt(e.target.value) || 0 })}
                    >
                      <option value="0">Unassigned</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      Designation [HR Only]
                    </label>
                    <select
                      className="swift-input"
                      value={editData.designation_id}
                      onChange={(e) => setEditData({ ...editData, designation_id: parseInt(e.target.value) || 0 })}
                    >
                      <option value="0">Unassigned</option>
                      {designations.map((desig) => (
                        <option key={desig.id} value={desig.id}>{desig.title}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button type="button" onClick={() => setIsEditOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
