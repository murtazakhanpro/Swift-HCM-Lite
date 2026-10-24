import React, { useEffect, useState } from "react";
import {
  Building2,
  Plus,
  Trash2,
  Calendar,
  UserPlus,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { api, type CompanySettings, type Department, type Designation, type Holiday, type LeaveTypeQuota, type User } from "../services/api";

export const OrgSetupPage: React.FC = () => {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeQuota[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [activeTab, setActiveTab] = useState<"settings" | "departments" | "designations" | "holidays" | "quotas" | "users">("settings");
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form states
  const [newDept, setNewDept] = useState({ name: "", code: "", description: "" });
  const [newDesig, setNewDesig] = useState({ title: "", department_id: 0 });
  const [newHoliday, setNewHoliday] = useState({ name: "", date: "", description: "" });
  const [newHrUser, setNewHrUser] = useState({ email: "", password: "", role: "HR" });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [s, depts, desigs, hols, lts, usrs] = await Promise.all([
        api.getCompanySettings(),
        api.listDepartments(),
        api.listDesignations(),
        api.listHolidays(),
        api.listLeaveTypes(),
        api.listUsers()
      ]);
      setSettings(s);
      setDepartments(depts);
      setDesignations(desigs);
      setHolidays(hols);
      setLeaveTypes(lts);
      setUsers(usrs);
      if (depts.length > 0 && newDesig.department_id === 0) {
        setNewDesig(prev => ({ ...prev, department_id: depts[0].id }));
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to load organization settings" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const updated = await api.updateCompanySettings({
        company_name: settings.company_name,
        office_start: settings.office_start,
        grace_minutes: settings.grace_minutes,
        half_day_hours: settings.half_day_hours,
        weekend_days: settings.weekend_days,
        office_lat: settings.office_lat,
        office_lng: settings.office_lng,
        office_radius_meters: settings.office_radius_meters,
        late_penalty_rule: settings.late_penalty_rule,
      });
      setSettings(updated);
      setNotification({ type: "success", message: "Company settings updated successfully." });
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to update settings" });
    }
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createDepartment(newDept);
      setDepartments([...departments, created]);
      setNewDept({ name: "", code: "", description: "" });
      setNotification({ type: "success", message: `Department '${created.name}' created.` });
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to create department" });
    }
  };

  const handleDeleteDept = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this department?")) return;
    try {
      await api.deleteDepartment(id);
      setDepartments(departments.filter(d => d.id !== id));
      setDesignations(designations.filter(d => d.department_id !== id));
      setNotification({ type: "success", message: "Department deleted." });
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to delete department" });
    }
  };

  const handleAddDesig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createDesignation(newDesig);
      setDesignations([...designations, created]);
      setNewDesig(prev => ({ ...prev, title: "" }));
      setNotification({ type: "success", message: `Designation '${created.title}' created.` });
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to create designation" });
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createHoliday(newHoliday);
      setHolidays([...holidays, created]);
      setNewHoliday({ name: "", date: "", description: "" });
      setNotification({ type: "success", message: `Holiday '${created.name}' registered.` });
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to add holiday" });
    }
  };

  const handleAddHrUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createUser(newHrUser);
      setUsers([...users, created]);
      setNewHrUser({ email: "", password: "", role: "HR" });
      setNotification({ type: "success", message: `HR Login created for '${created.email}'. User will be prompted to change password on first sign-in.` });
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to create HR login" });
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      await api.toggleUserStatus(user.id, !user.is_active);
      setUsers(users.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
      setNotification({ type: "success", message: `User status changed.` });
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to update user status" });
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--swift-neon)" }}>
        <p style={{ fontSize: "1rem", fontWeight: 600 }}>Loading Organization Configuration...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Page Title */}
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)" }}>
          Organization Setup (Module 2)
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
          Configure company parameters, departments, designations, public holidays, leave quotas, and HR logins.
        </p>
      </div>

      {/* Notifications */}
      {notification && (
        <div style={{
          padding: "0.75rem 1rem",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.85rem",
          background: notification.type === "success" ? "rgba(68, 248, 25, 0.12)" : "rgba(251, 36, 54, 0.12)",
          border: `1px solid ${notification.type === "success" ? "rgba(68, 248, 25, 0.3)" : "rgba(251, 36, 54, 0.3)"}`,
          color: notification.type === "success" ? "var(--status-present)" : "var(--status-absent)"
        }}>
          {notification.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.5rem", overflowX: "auto" }}>
        {[
          { id: "settings", label: "Company Settings" },
          { id: "departments", label: `Departments (${departments.length})` },
          { id: "designations", label: `Designations (${designations.length})` },
          { id: "holidays", label: `Public Holidays (${holidays.length})` },
          { id: "quotas", label: `Leave Rules (${leaveTypes.length})` },
          { id: "users", label: `HR & User Accounts (${users.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={activeTab === tab.id ? "btn-primary" : "btn-secondary"}
            style={{ fontSize: "0.8rem", padding: "0.5rem 0.85rem", whiteSpace: "nowrap" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: COMPANY SETTINGS */}
      {activeTab === "settings" && settings && (
        <form onSubmit={handleUpdateSettings} className="swift-card" style={{ maxWidth: "800px" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Building2 size={20} color="var(--swift-neon)" /> Organization & Schedule Parameters
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                Company Name
              </label>
              <input
                type="text"
                required
                className="swift-input"
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Official Start Time
                </label>
                <input
                  type="time"
                  required
                  className="swift-input"
                  value={settings.office_start}
                  onChange={(e) => setSettings({ ...settings, office_start: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Grace Period (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  required
                  className="swift-input"
                  value={settings.grace_minutes}
                  onChange={(e) => setSettings({ ...settings, grace_minutes: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Half-Day Working Threshold (Hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="12"
                  required
                  className="swift-input"
                  value={settings.half_day_hours}
                  onChange={(e) => setSettings({ ...settings, half_day_hours: parseFloat(e.target.value) || 5.0 })}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Weekend Days
                </label>
                <input
                  type="text"
                  required
                  className="swift-input"
                  value={settings.weekend_days}
                  onChange={(e) => setSettings({ ...settings, weekend_days: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Office Latitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  className="swift-input"
                  value={settings.office_lat}
                  onChange={(e) => setSettings({ ...settings, office_lat: parseFloat(e.target.value) })}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Office Longitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  className="swift-input"
                  value={settings.office_lng}
                  onChange={(e) => setSettings({ ...settings, office_lng: parseFloat(e.target.value) })}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Geofence Radius (m)
                </label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  required
                  className="swift-input"
                  value={settings.office_radius_meters}
                  onChange={(e) => setSettings({ ...settings, office_radius_meters: parseFloat(e.target.value) || 150 })}
                />
              </div>
            </div>

            <div style={{ marginTop: "0.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--text-primary)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={settings.late_penalty_rule}
                  onChange={(e) => setSettings({ ...settings, late_penalty_rule: e.target.checked })}
                  style={{ accentColor: "var(--swift-neon)", width: "16px", height: "16px" }}
                />
                <span>Enable Late Penalty Rule (3 lates = 0.5 day gross deduction) [Hackathon Bonus]</span>
              </label>
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: "1rem", alignSelf: "flex-start" }}>
              Save Settings
            </button>
          </div>
        </form>
      )}

      {/* TAB: DEPARTMENTS */}
      {activeTab === "departments" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem" }}>
          <div className="swift-card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>
              Registered Departments
            </h2>
            {departments.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No departments registered yet. Add your first department on the right.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {departments.map((dept) => (
                  <div key={dept.id} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    background: "var(--bg-surface-0)",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)"
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{dept.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--swift-neon)", fontFamily: "JetBrains Mono" }}>{dept.code}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteDept(dept.id)}
                      className="btn-secondary"
                      style={{ padding: "0.4rem", color: "#FB2436", borderColor: "rgba(251, 36, 54, 0.3)" }}
                      title="Delete Department"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleAddDept} className="swift-card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Plus size={18} color="var(--swift-neon)" /> Add Department
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineering, Sales, HR"
                  className="swift-input"
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ENG, SLS, HRD"
                  className="swift-input"
                  value={newDept.code}
                  onChange={(e) => setNewDept({ ...newDept, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Core functions..."
                  className="swift-input"
                  value={newDept.description}
                  onChange={(e) => setNewDept({ ...newDept, description: e.target.value })}
                />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: "0.5rem" }}>
                Add Department
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB: DESIGNATIONS */}
      {activeTab === "designations" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem" }}>
          <div className="swift-card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>
              Registered Designations
            </h2>
            {designations.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No designations registered yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {designations.map((desig) => {
                  const dept = departments.find(d => d.id === desig.department_id);
                  return (
                    <div key={desig.id} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem 1rem",
                      background: "var(--bg-surface-0)",
                      borderRadius: "8px",
                      border: "1px solid var(--border-subtle)"
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{desig.title}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{dept?.name || "Unassigned"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <form onSubmit={handleAddDesig} className="swift-card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Plus size={18} color="var(--swift-neon)" /> Add Designation
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Job Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lead AI Architect, Frontend Engineer"
                  className="swift-input"
                  value={newDesig.title}
                  onChange={(e) => setNewDesig({ ...newDesig, title: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Assigned Department *
                </label>
                <select
                  className="swift-input"
                  value={newDesig.department_id}
                  onChange={(e) => setNewDesig({ ...newDesig, department_id: parseInt(e.target.value) })}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={departments.length === 0} className="btn-primary" style={{ marginTop: "0.5rem" }}>
                Add Designation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB: HOLIDAYS */}
      {activeTab === "holidays" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem" }}>
          <div className="swift-card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>
              Official Calendar Holidays
            </h2>
            {holidays.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No public holidays configured yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {holidays.map((hol) => (
                  <div key={hol.id} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    background: "var(--bg-surface-0)",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)"
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{hol.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{hol.description || "Public Holiday"}</div>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--swift-neon)", fontFamily: "JetBrains Mono" }}>
                      {hol.date}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleAddHoliday} className="swift-card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Calendar size={18} color="var(--swift-neon)" /> Add Holiday
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Holiday Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Independence Day, Eid-ul-Fitr"
                  className="swift-input"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Date *
                </label>
                <input
                  type="date"
                  required
                  className="swift-input"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Description (Optional)
                </label>
                <input
                  type="text"
                  className="swift-input"
                  value={newHoliday.description}
                  onChange={(e) => setNewHoliday({ ...newHoliday, description: e.target.value })}
                />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: "0.5rem" }}>
                Add Holiday
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB: LEAVE RULES */}
      {activeTab === "quotas" && (
        <div className="swift-card" style={{ maxWidth: "800px" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Standard Leave Quotas (Module 5 Rules)
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
            Mandatory annual leave quotas automatically initialized per Saylani Hackathon brief.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
            {leaveTypes.map((lt) => (
              <div key={lt.id} style={{
                background: "var(--bg-surface-0)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "10px",
                padding: "1rem",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: lt.is_unpaid ? "var(--text-muted)" : "var(--swift-neon)" }}>
                  {lt.is_unpaid ? "∞" : lt.annual_quota}
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginTop: "0.25rem" }}>
                  {lt.name}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                  Code: <code style={{ color: "var(--swift-neon)" }}>{lt.code}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: HR & USER ACCOUNTS */}
      {activeTab === "users" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem" }}>
          <div className="swift-card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>
              Active User Accounts
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {users.map((u) => (
                <div key={u.id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.75rem 1rem",
                  background: "var(--bg-surface-0)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)"
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{u.email}</div>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                      <span className={`badge badge-role-${u.role.toLowerCase()}`}>{u.role}</span>
                      {u.must_change_password && (
                        <span style={{ fontSize: "0.7rem", color: "var(--status-late)" }}>Temporary Password</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => handleToggleUserStatus(u)}
                      className="btn-secondary"
                      style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleAddHrUser} className="swift-card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <UserPlus size={18} color="var(--swift-blue)" /> Create HR Account
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
              Admin creates HR operator logins. HR will be prompted to set a new password on first sign-in.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  HR Work Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="hr@yourcompany.com"
                  className="swift-input"
                  value={newHrUser.email}
                  onChange={(e) => setNewHrUser({ ...newHrUser, email: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Temporary Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  className="swift-input"
                  value={newHrUser.password}
                  onChange={(e) => setNewHrUser({ ...newHrUser, password: e.target.value })}
                />
              </div>
              <button type="submit" className="btn-blue" style={{ marginTop: "0.5rem" }}>
                Create HR Login
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
