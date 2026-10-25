const API_BASE = "/api/v1";

// ── ATTENDANCE TYPES ─────────────────────────────────────────────────────────
export interface AttendanceRecord {
  id: number;
  employee_id: number;
  employee_code: string;
  employee_name: string;
  department_name?: string | null;
  date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  total_hours: number;
  status: string; // present | late | half_day | absent | missing_checkout
  check_in_source: string;
  check_in_lat?: number | null;
  check_in_lng?: number | null;
  face_verified: boolean;
}

export interface FaceEnrollmentStatus { enrolled: boolean; enabled: boolean }

export interface TodayStatusResponse {
  has_checked_in: boolean;
  has_checked_out: boolean;
  record?: AttendanceRecord | null;
  office_lat: number;
  office_lng: number;
  office_radius_meters: number;
}

export interface DailyBoardSummary {
  date: string;
  total_active_employees: number;
  present_today: number;
  late_today: number;
  half_day_today: number;
  missing_checkout_today: number;
  records: AttendanceRecord[];
}

export interface AttendanceCorrectionRequest {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_code: string;
  requested_date: string;
  requested_check_in: string;
  requested_check_out?: string | null;
  reason: string;
  status: string; // pending | approved | rejected
  reviewed_by?: number | null;
  review_comment?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

// ── LEAVE TYPES ───────────────────────────────────────────────────────────────
export interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_code: string;
  leave_type_id: number;
  leave_type: { id: number; name: string; code: string; annual_quota: number; is_unpaid: boolean };
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: string; // pending | approved | rejected | cancelled
  reviewed_by?: number | null;
  reviewer_comment?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

export interface LeaveBalanceItem {
  leave_type_id: number;
  leave_type_name: string;
  leave_type_code: string;
  annual_quota: number;
  days_taken: number;
  days_remaining: number;
  is_unpaid: boolean;
}

export interface LeaveBalanceResponse {
  employee_id: number;
  employee_name: string;
  year: number;
  balances: LeaveBalanceItem[];
}

export interface User {
  id: number;
  email: string;
  role: 'Admin' | 'HR' | 'Employee';
  is_active: boolean;
  must_change_password: boolean;
  employee_id?: number | null;
  company_name?: string | null;
}

export interface SetupStatus {
  is_setup_completed: boolean;
  company_name?: string | null;
  admin_exists: boolean;
}

export interface CompanySettings {
  id: number;
  company_name: string;
  office_start: string;
  grace_minutes: number;
  half_day_hours: number;
  weekend_days: string;
  office_lat: number;
  office_lng: number;
  office_radius_meters: number;
  late_penalty_rule: boolean;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  description?: string;
}

export interface Designation {
  id: number;
  title: string;
  department_id: number;
}

export interface Holiday {
  id: number;
  name: string;
  date: string;
  description?: string;
}

export interface LeaveTypeQuota {
  id: number;
  name: string;
  code: string;
  annual_quota: number;
  is_unpaid: boolean;
}

export interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  department_id?: number | null;
  designation_id?: number | null;
  joining_date: string;
  exit_date?: string | null;
  status: string;
  basic_salary: number;
  gross_salary: number;
  created_at: string;
  department?: Department | null;
  designation?: Designation | null;
}

export interface EmployeeListResponse {
  items: Employee[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Employee360 extends Employee {
  attendance_count: number;
  approved_leaves_count: number;
  total_payslips_count: number;
}

export interface CsvDryRunError {
  row: number;
  field: string;
  reason: string;
}

export interface CsvDryRunResponse {
  total_rows: number;
  valid_rows: number;
  can_import: boolean;
  errors: CsvDryRunError[];
}

export interface CsvImportCommitResponse {
  imported_count: number;
  message: string;
}

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem("swift_hcm_token");
  }

  public setToken(token: string) {
    localStorage.setItem("swift_hcm_token", token);
  }

  public clearToken() {
    localStorage.removeItem("swift_hcm_token");
    localStorage.removeItem("swift_hcm_user");
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    // Only set Content-Type to application/json if not sending FormData
    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.detail || (data.error ? data.error : `Request failed with status ${response.status}`);
      throw new Error(errorMsg);
    }

    return data as T;
  }

  // --- AUTH & SETUP ---
  async getSetupStatus(): Promise<SetupStatus> {
    return this.request<SetupStatus>("/auth/setup-status");
  }

  async setupFirstRun(payload: any): Promise<{ access_token: string; user: User }> {
    const res = await this.request<{ access_token: string; user: User }>("/auth/setup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    this.setToken(res.access_token);
    localStorage.setItem("swift_hcm_user", JSON.stringify(res.user));
    return res;
  }

  async login(payload: { email: string; password: string }): Promise<{ access_token: string; user: User }> {
    const res = await this.request<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    this.setToken(res.access_token);
    localStorage.setItem("swift_hcm_user", JSON.stringify(res.user));
    return res;
  }

  async getMyProfile(): Promise<User> {
    return this.request<User>("/auth/me");
  }

  async changePassword(payload: { current_password: string; new_password: string }): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async listUsers(): Promise<User[]> {
    return this.request<User[]>("/auth/users");
  }

  async createUser(payload: { email: string; password: string; role: string }): Promise<User> {
    return this.request<User>("/auth/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async toggleUserStatus(userId: number, isActive: boolean): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/auth/users/${userId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    });
  }

  // --- ORGANIZATION SETUP (M2) ---
  async getCompanySettings(): Promise<CompanySettings> {
    return this.request<CompanySettings>("/org/settings");
  }

  async updateCompanySettings(payload: Partial<CompanySettings>): Promise<CompanySettings> {
    return this.request<CompanySettings>("/org/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async listDepartments(): Promise<Department[]> {
    return this.request<Department[]>("/org/departments");
  }

  async createDepartment(payload: { name: string; code: string; description?: string }): Promise<Department> {
    return this.request<Department>("/org/departments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async deleteDepartment(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/org/departments/${id}`, {
      method: "DELETE",
    });
  }

  async listDesignations(): Promise<Designation[]> {
    return this.request<Designation[]>("/org/designations");
  }

  async createDesignation(payload: { title: string; department_id: number }): Promise<Designation> {
    return this.request<Designation>("/org/designations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async listHolidays(): Promise<Holiday[]> {
    return this.request<Holiday[]>("/org/holidays");
  }

  async createHoliday(payload: { name: string; date: string; description?: string }): Promise<Holiday> {
    return this.request<Holiday>("/org/holidays", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async listLeaveTypes(): Promise<LeaveTypeQuota[]> {
    return this.request<LeaveTypeQuota[]>("/org/leave-types");
  }

  // --- EMPLOYEES & CSV (M3) ---
  async listEmployees(params: { search?: string; department_id?: number; status?: string; page?: number; page_size?: number } = {}): Promise<EmployeeListResponse> {
    const q = new URLSearchParams();
    if (params.search) q.append("search", params.search);
    if (params.department_id) q.append("department_id", params.department_id.toString());
    if (params.status) q.append("status", params.status);
    if (params.page) q.append("page", params.page.toString());
    if (params.page_size) q.append("page_size", params.page_size.toString());

    return this.request<EmployeeListResponse>(`/employees?${q.toString()}`);
  }

  async registerEmployee(payload: any): Promise<Employee> {
    return this.request<Employee>("/employees", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getEmployee360(id: number): Promise<Employee360> {
    return this.request<Employee360>(`/employees/${id}`);
  }

  async updateEmployee(id: number, payload: Partial<Employee>): Promise<Employee> {
    return this.request<Employee>(`/employees/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async dryRunCsv(file: File): Promise<CsvDryRunResponse> {
    const formData = new FormData();
    formData.append("file", file);
    return this.request<CsvDryRunResponse>("/employees/csv-dry-run", {
      method: "POST",
      body: formData,
    });
  }

  async commitCsvImport(file: File): Promise<CsvImportCommitResponse> {
    const formData = new FormData();
    formData.append("file", file);
    return this.request<CsvImportCommitResponse>("/employees/csv-import", {
      method: "POST",
      body: formData,
    });
  }

  async exportEmployeesCsv(): Promise<Blob> {
    const token = this.getToken();
    const res = await fetch(`${API_BASE}/employees/export/csv`, {
      headers: token ? { "Authorization": `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Failed to export employees CSV");
    return res.blob();
  }

  // ── ATTENDANCE (Module 4) ──────────────────────────────────────────────────
  async getTodayAttendanceStatus(): Promise<TodayStatusResponse> {
    return this.request<TodayStatusResponse>("/attendance/today-status");
  }

  async checkIn(payload: {
    source: "web" | "camera";
    latitude?: number;
    longitude?: number;
    gps_accuracy?: number;
    face_image?: string;
  }): Promise<AttendanceRecord> {
    return this.request<AttendanceRecord>("/attendance/check-in", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async faceCheck(payload: {
    image: string;
    latitude: number;
    longitude: number;
    gps_accuracy: number;
  }): Promise<AttendanceRecord> {
    return this.request<AttendanceRecord>("/attendance/face-check", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getFaceEnrollment(): Promise<FaceEnrollmentStatus> {
    return this.request<FaceEnrollmentStatus>("/attendance/face-enrollment");
  }
  async enrollFace(image: string, consent: boolean): Promise<FaceEnrollmentStatus> {
    return this.request<FaceEnrollmentStatus>("/attendance/face-enrollment", { method: "POST", body: JSON.stringify({ image, consent }) });
  }
  async deleteFaceEnrollment(): Promise<FaceEnrollmentStatus> {
    return this.request<FaceEnrollmentStatus>("/attendance/face-enrollment", { method: "DELETE" });
  }

  async checkOut(payload: { latitude?: number; longitude?: number }): Promise<AttendanceRecord> {
    return this.request<AttendanceRecord>("/attendance/check-out", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getDailyAttendanceBoard(targetDate?: string): Promise<DailyBoardSummary> {
    const q = targetDate ? `?target_date=${targetDate}` : "";
    return this.request<DailyBoardSummary>(`/attendance/daily-board${q}`);
  }

  async getAttendanceHistory(params: {
    employee_id?: number;
    start_date?: string;
    end_date?: string;
  } = {}): Promise<AttendanceRecord[]> {
    const q = new URLSearchParams();
    if (params.employee_id) q.append("employee_id", params.employee_id.toString());
    if (params.start_date) q.append("start_date", params.start_date);
    if (params.end_date) q.append("end_date", params.end_date);
    return this.request<AttendanceRecord[]>(`/attendance/history?${q.toString()}`);
  }

  async requestAttendanceCorrection(payload: {
    requested_date: string;
    requested_check_in: string;
    requested_check_out?: string;
    reason: string;
  }): Promise<AttendanceCorrectionRequest> {
    return this.request<AttendanceCorrectionRequest>("/attendance/corrections", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async listAttendanceCorrections(): Promise<AttendanceCorrectionRequest[]> {
    return this.request<AttendanceCorrectionRequest[]>("/attendance/corrections");
  }

  async reviewAttendanceCorrection(
    correctionId: number,
    payload: { status: "approved" | "rejected"; review_comment?: string }
  ): Promise<AttendanceCorrectionRequest> {
    return this.request<AttendanceCorrectionRequest>(`/attendance/corrections/${correctionId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  // ── LEAVE MANAGEMENT (Module 5) ───────────────────────────────────────────
  async applyLeave(payload: {
    leave_type_id: number;
    start_date: string;
    end_date: string;
    reason: string;
  }): Promise<LeaveRequest> {
    return this.request<LeaveRequest>("/leave", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async listLeaveRequests(params: {
    employee_id?: number;
    status?: string;
    year?: number;
  } = {}): Promise<LeaveRequest[]> {
    const q = new URLSearchParams();
    if (params.employee_id) q.append("employee_id", params.employee_id.toString());
    if (params.status) q.append("status", params.status);
    if (params.year) q.append("year", params.year.toString());
    return this.request<LeaveRequest[]>(`/leave?${q.toString()}`);
  }

  async getLeaveBalance(employeeId: number, year?: number): Promise<LeaveBalanceResponse> {
    const q = year ? `?year=${year}` : "";
    return this.request<LeaveBalanceResponse>(`/leave/balance/${employeeId}${q}`);
  }

  async reviewLeaveRequest(
    leaveId: number,
    payload: { status: "approved" | "rejected"; reviewer_comment?: string }
  ): Promise<LeaveRequest> {
    return this.request<LeaveRequest>(`/leave/${leaveId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async cancelLeaveRequest(leaveId: number): Promise<void> {
    return this.request<void>(`/leave/${leaveId}`, { method: "DELETE" });
  }
}

export const api = new ApiService();

