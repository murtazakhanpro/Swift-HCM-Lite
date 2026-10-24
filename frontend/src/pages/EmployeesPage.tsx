import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  UserPlus,
  FileSpreadsheet,
  Download,
  Search,
  ArrowRight
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, type Employee, type Department, type Designation } from "../services/api";
import { RegisterEmployeeModal } from "../components/employees/RegisterEmployeeModal";
import { CsvImportModal } from "../components/employees/CsvImportModal";

export const EmployeesPage: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const data = await api.listEmployees({
        search: search.trim() || undefined,
        department_id: departmentId,
        status: statusFilter,
        page,
        page_size: 10
      });
      setEmployees(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err) {
      console.error("Failed to load employees", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMetadata = async () => {
    try {
      const [depts, desigs] = await Promise.all([
        api.listDepartments(),
        api.listDesignations()
      ]);
      setDepartments(depts);
      setDesignations(desigs);
    } catch (err) {
      console.warn("Failed to load departments/designations", err);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [search, departmentId, statusFilter, page]);

  const handleExportCsv = async () => {
    try {
      const blob = await api.exportEmployeesCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `employees_export_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export CSV");
    }
  };

  const isHr = user?.role === "HR";
  const isAdminOrHr = user?.role === "Admin" || user?.role === "HR";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Modals */}
      <RegisterEmployeeModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={() => {
          fetchEmployees();
        }}
        departments={departments}
        designations={designations}
      />

      <CsvImportModal
        isOpen={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
        onSuccess={() => {
          fetchEmployees();
        }}
      />

      {/* Top Header & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Employee Directory (Module 3)
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            {user?.role === "Employee"
              ? "Your official employee record and Employee 360 overview."
              : `Total Headcount: ${total} employees • Scoped directory management.`}
          </p>
        </div>

        {isAdminOrHr && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <button onClick={handleExportCsv} className="btn-secondary">
              <Download size={16} /> Export CSV
            </button>
            {isHr && (
              <>
                <button onClick={() => setIsCsvImportOpen(true)} className="btn-secondary">
                  <FileSpreadsheet size={16} color="var(--swift-neon)" /> Import CSV
                </button>
                <button onClick={() => setIsRegisterOpen(true)} className="btn-primary">
                  <UserPlus size={16} /> Register Employee
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Filter Bar (Only for Admin/HR) */}
      {isAdminOrHr && (
        <div className="swift-card" style={{ padding: "0.85rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          {/* Search Input */}
          <div style={{ flex: 1, minWidth: "220px", display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--bg-surface-0)", padding: "0.4rem 0.75rem", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by name, email, or code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ background: "transparent", border: "none", color: "var(--text-primary)", outline: "none", width: "100%", fontSize: "0.85rem" }}
            />
          </div>

          {/* Department Filter */}
          <div style={{ minWidth: "180px" }}>
            <select
              className="swift-input"
              value={departmentId || ""}
              onChange={(e) => {
                setDepartmentId(e.target.value ? parseInt(e.target.value) : undefined);
                setPage(1);
              }}
              style={{ padding: "0.45rem 0.75rem", fontSize: "0.85rem" }}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ minWidth: "150px" }}>
            <select
              className="swift-input"
              value={statusFilter || ""}
              onChange={(e) => {
                setStatusFilter(e.target.value || undefined);
                setPage(1);
              }}
              style={{ padding: "0.45rem 0.75rem", fontSize: "0.85rem" }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="probation">Probation</option>
              <option value="resigned">Resigned</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
        </div>
      )}

      {/* Directory Table / Empty State */}
      {isLoading ? (
        <div className="swift-card" style={{ padding: "3rem", textAlign: "center", color: "var(--swift-neon)" }}>
          <p style={{ fontWeight: 600 }}>Loading employee records...</p>
        </div>
      ) : employees.length === 0 ? (
        /* Empty-State Illustration per Brief & Public Assets */
        <div className="swift-card" style={{ padding: "3rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <img
            src="/assets/Empty-State & Feature Icons (9 Modules)/Module 3 - Empty Employee Directory Illustration.jpg"
            alt="Empty Directory"
            style={{ width: "320px", maxWidth: "100%", borderRadius: "16px", marginBottom: "1.5rem", border: "1px solid var(--border-subtle)" }}
          />
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text-primary)" }}>
            No Employees Found
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", maxWidth: "440px", marginTop: "0.5rem" }}>
            {user?.role === "Employee"
              ? "No employee profile linked to your account. Please consult your HR administrator."
              : "Your organization starts clean with no seeded records. Register your first employee or import employees via CSV."}
          </p>
          {isHr && (
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              <button onClick={() => setIsRegisterOpen(true)} className="btn-primary">
                <UserPlus size={16} /> Register First Employee
              </button>
              <button onClick={() => setIsCsvImportOpen(true)} className="btn-secondary">
                <FileSpreadsheet size={16} /> Import via CSV
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Table of Employees */
        <div className="swift-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface-0)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Code</th>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Employee Name</th>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Department & Job</th>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Joining Date</th>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Status</th>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Monthly Gross</th>
                  <th style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 0.15s ease" }}>
                    <td style={{ padding: "0.85rem 1.25rem", fontFamily: "JetBrains Mono", color: "var(--swift-neon)", fontWeight: 600 }}>
                      {emp.employee_code}
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem" }}>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {emp.first_name} {emp.last_name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {emp.email}
                      </div>
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem" }}>
                      <div style={{ color: "var(--text-primary)" }}>
                        {emp.designation?.title || "Employee"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--swift-blue)" }}>
                        {emp.department?.name || "General"}
                      </div>
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem", color: "var(--text-secondary)", fontFamily: "JetBrains Mono" }}>
                      {emp.joining_date}
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem" }}>
                      <span className={`badge ${emp.status === "active" ? "badge-present" : "badge-late"}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem", fontFamily: "JetBrains Mono", fontWeight: 600, color: "var(--text-primary)" }}>
                      PKR {emp.gross_salary.toLocaleString()}
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                      <Link
                        to={`/employees/${emp.id}`}
                        className="btn-secondary"
                        style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem", textDecoration: "none" }}
                      >
                        <span>360 Profile</span>
                        <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Showing page {page} of {totalPages} ({total} employees)
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="btn-secondary"
                  style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="btn-secondary"
                  style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
