const API_BASE = "http://localhost:8000/api/v1";

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
}

export const api = new ApiService();
