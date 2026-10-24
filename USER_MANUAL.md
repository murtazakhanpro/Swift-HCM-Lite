# Swift-HCM Lite — Complete User Manual

**Version 1.0.0** | Saylani Hackathon 2026 • Zaitoon Ashraf IT Park  
**Built by [Lyntica](https://www.lyntica.com/)**  
**Engineering Team:** Murtaza Ali Khan (AI/ML Lead) • Fiza Baneen Khan (Web Engineering Lead)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Prerequisites & Installation](#3-prerequisites--installation)
4. [Startup Commands Reference](#4-startup-commands-reference)
5. [Environment Configuration (.env)](#5-environment-configuration-env)
6. [First-Run Setup Wizard](#6-first-run-setup-wizard)
7. [Default Credentials & Account Flow](#7-default-credentials--account-flow)
8. [Module 1: Authentication & Access Control](#8-module-1-authentication--access-control)
9. [Module 2: Organization Setup](#9-module-2-organization-setup)
10. [Module 3: Employee Management](#10-module-3-employee-management)
11. [Module 4: Attendance Tracking](#11-module-4-attendance-tracking)
12. [Module 5: Leave Engine](#12-module-5-leave-engine)
13. [Module 6: Payroll Lite](#13-module-6-payroll-lite)
14. [Module 7: AI Assistant](#14-module-7-ai-assistant)
15. [Module 8: Communications & Audit Trail](#15-module-8-communications--audit-trail)
16. [Module 9: Executive Dashboard](#16-module-9-executive-dashboard)
17. [API Reference](#17-api-reference)
18. [Running Tests](#18-running-tests)
19. [Docker Deployment](#19-docker-deployment)
20. [Troubleshooting](#20-troubleshooting)
21. [Glossary](#21-glossary)

---

## 1. System Overview

Swift-HCM Lite is an **AI-Assisted Human Capital Management System** designed for hackathon evaluation and rapid enterprise deployment. It covers the complete employee lifecycle:

- **Onboarding** → Organization setup, employee registration, portal activation
- **Daily Operations** → Attendance check-in/out with GPS geofencing and face detection
- **Leave Management** → Quota-based leave applications with overlap detection and HR approval
- **Payroll Processing** → Salary computation with overtime (1.5×), tax slabs, and deductions
- **AI Intelligence** → Google Gemini-powered assistant with 7 scoped HCM tools
- **Audit & Compliance** → Immutable audit trail logging every system action

### Clean-Slate Architecture

Per Saylani Hackathon rules, the system starts **completely empty** with zero seeded data. The first user creates the organization and Admin account through the First-Run Setup Wizard.

### Role-Based Access Control (RBAC)

| Role | Access Level |
|:-----|:-------------|
| **Admin** | Full system access. Creates HR accounts, manages org settings, locks payroll, views audit logs |
| **HR** | Manages employees, approves leaves, drafts payroll, posts announcements |
| **Employee** | Self-service: attendance, leave applications, payslip viewing, AI assistant |

---

## 2. Technology Stack

| Layer | Technology |
|:------|:-----------|
| **Backend API** | Python 3.11+ • FastAPI • Async SQLAlchemy • Pydantic V2 |
| **Frontend** | React 19 • TypeScript 6.0 • Vite 8.3 • React Router 7 |
| **Database** | SQLite (local zero-install) / PostgreSQL 16 (Docker production) |
| **AI Engine** | Google Gemini 3.5 Flash / Flash Lite via `google-genai` SDK |
| **ML/DS** | NumPy • Pandas • Scikit-Learn (attrition prediction, absence anomaly detection) |
| **Auth** | JWT (PyJWT) • Bcrypt password hashing • 24-hour token expiry |
| **Containerization** | Docker • Docker Compose |
| **Icons** | Lucide React |

---

## 3. Prerequisites & Installation

### 3.1 System Requirements

- **Python** 3.11 or later
- **Node.js** 18 or later (with npm)
- **Git** (for cloning)
- **Docker & Docker Compose** (optional, for containerized deployment)
- **Google Gemini API Key** (for AI Assistant features)

### 3.2 Clone the Repository

```powershell
git clone https://github.com/murtazakhanpro/Swift-HCM-Lite.git
cd Swift-HCM-Lite
```

### 3.3 Backend Installation

```powershell
# Install all Python dependencies
python -m pip install -r backend/requirements.txt
```

**Dependencies installed:**
| Package | Purpose |
|:--------|:--------|
| `fastapi` ≥0.115 | Web framework |
| `uvicorn[standard]` ≥0.32 | ASGI server |
| `pydantic` ≥2.9 | Data validation |
| `pydantic-settings` ≥2.6 | Config from `.env` |
| `sqlalchemy` ≥2.0.36 | Async ORM |
| `aiosqlite` ≥0.20 | SQLite async driver |
| `asyncpg` ≥0.30 | PostgreSQL async driver |
| `pyjwt` ≥2.9 | JWT token handling |
| `bcrypt` ≥4.2 | Password hashing |
| `google-genai` ≥2.0 | Gemini AI SDK |
| `numpy` ≥2.0 | Numerical computing |
| `pandas` ≥2.2 | Data manipulation |
| `scikit-learn` ≥1.5 | ML models |
| `reportlab` ≥4.2 | PDF generation |
| `pytest` ≥8.3 | Testing framework |
| `pytest-asyncio` ≥0.24 | Async test support |

### 3.4 Frontend Installation

```powershell
cd frontend
npm install
cd ..
```

**Dependencies installed:**
| Package | Purpose |
|:--------|:--------|
| `react` ^19.3 | UI framework |
| `react-dom` ^19.3 | DOM rendering |
| `react-router-dom` ^7.18 | Client-side routing |
| `lucide-react` ^1.61 | Icon library |
| `typescript` ~6.0 | Type safety |
| `vite` ^8.3 | Build tool & dev server |

---

## 4. Startup Commands Reference

### 4.1 Option A: Local Development (Recommended)

Open **two terminal windows**:

**Terminal 1 — Backend (FastAPI):**
```powershell
# From the repository root directory:
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

**Terminal 2 — Frontend (Vite):**
```powershell
# From the frontend directory:
cd frontend
npm run dev
```

**Access Points:**
| Service | URL |
|:--------|:----|
| **Frontend Application** | http://localhost:5173 |
| **Backend API** | http://localhost:8000 |
| **Swagger API Docs** | http://localhost:8000/docs |
| **ReDoc API Docs** | http://localhost:8000/redoc |
| **Health Check** | http://localhost:8000/api/v1/health |

### 4.2 Option B: Docker Compose (Full Stack with PostgreSQL)

```powershell
# 1. Copy and configure environment variables
copy .env.example .env
# Edit .env with your GEMINI_API_KEY

# 2. Build and start all services
docker compose up --build

# 3. Stop all services
docker compose down

# 4. Stop and remove volumes (clean reset)
docker compose down -v
```

**Docker Access Points:**
| Service | URL |
|:--------|:----|
| **Frontend Application** | http://localhost:3000 |
| **Backend API** | http://localhost:8000 |
| **PostgreSQL Database** | localhost:5432 |

### 4.3 Quick Command Cheat Sheet

```powershell
# Start backend only (from repo root)
python -m uvicorn app.main:app --app-dir backend --reload --port 8000

# Start frontend only (from frontend/)
npm run dev

# Run all tests
python -m pytest backend/tests/ -v

# TypeScript type check
cd frontend && npx tsc --noEmit

# Production build frontend
cd frontend && npm run build

# Docker full stack
docker compose up --build

# Docker stop
docker compose down
```

---

## 5. Environment Configuration (.env)

Create a `.env` file in the **repository root** by copying the example:

```powershell
copy .env.example .env
```

### Complete .env Reference

```ini
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SERVER CONFIGURATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PORT=8000
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECURITY / JWT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JWT_SECRET=your_jwt_secret_key_here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DATABASE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SQLite (default — zero-install local evaluation):
DATABASE_URL=sqlite+aiosqlite:///./swift_hcm.db

# PostgreSQL (Docker/Production):
# DATABASE_URL=postgresql+asyncpg://postgres:postgrespassword@localhost:5432/swift_hcm

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# AI ENGINE (Google Gemini)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GEMINI_API_KEY=your_gemini_api_key_here
AI_MODEL=gemini-2.5-flash
```

### How to Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key and paste it as the `GEMINI_API_KEY` value in your `.env` file

> **⚠️ IMPORTANT:** The AI Assistant (Module 7) requires a valid `GEMINI_API_KEY`. Without it, the assistant will fall back to deterministic grounded responses based on local database queries.

> **🔒 WARNING:** Never commit your `.env` file to Git. The `.gitignore` already excludes it.

### Configuration Reference

| Variable | Default | Description |
|:---------|:--------|:------------|
| `PORT` | `8000` | Backend server port |
| `ENVIRONMENT` | `development` | `development` or `production` |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed origins |
| `JWT_SECRET` | (auto-generated) | Secret key for JWT signing. Use 32+ chars in production |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token validity (default: 24 hours) |
| `DATABASE_URL` | `sqlite+aiosqlite:///./swift_hcm.db` | Database connection string |
| `GEMINI_API_KEY` | *(empty)* | Google Gemini API key |
| `AI_MODEL` | `gemini-2.5-flash` | AI model identifier |

---

## 6. First-Run Setup Wizard

When the system starts for the first time with an empty database, users are automatically redirected to the **Setup Wizard** at `/setup`.

### Step-by-Step First-Run Process

1. **Navigate to the application** → `http://localhost:5173`
2. The system detects no Admin account exists → **redirects to `/setup`**
3. **Fill in the Setup Form:**

   | Field | Description | Example |
   |:------|:------------|:--------|
   | **Company Name** | Your organization name | `Saylani Welfare Trust` |
   | **Admin Email** | Master admin email | `admin@company.com` |
   | **Admin Password** | Strong password (8+ chars) | `Admin@2026!` |
   | **Office Start Time** | Daily office start | `09:00` |
   | **Grace Minutes** | Late arrival tolerance | `15` |
   | **Office Latitude** | GPS geofence center lat | `24.8607` |
   | **Office Longitude** | GPS geofence center lng | `67.0011` |
   | **Geofence Radius (m)** | Check-in radius in meters | `150` |

4. Click **"Initialize System"**
5. The system creates the Admin account, seeds standard leave quotas, and logs you in automatically

> **📌 NOTE:** The Setup Wizard is a **one-time** operation. Once completed, the `/setup` route is permanently locked and all users are redirected to `/login`.

### Standard Leave Quotas (Auto-Seeded)

| Leave Type | Code | Annual Quota | Paid? |
|:-----------|:-----|:-------------|:------|
| Annual Leave | `annual` | 14 days | ✅ Yes |
| Sick Leave | `sick` | 8 days | ✅ Yes |
| Casual Leave | `casual` | 10 days | ✅ Yes |
| Unpaid Leave | `unpaid` | Unlimited | ❌ No |

---

## 7. Default Credentials & Account Flow

### There Are No Default Credentials

Swift-HCM Lite has **no hardcoded default accounts**. All credentials are created during the First-Run Setup and subsequent user management.

### Account Creation Hierarchy

```
┌───────────────────────────────────────────────┐
│  STEP 1: First-Run Setup Wizard               │
│  → Creates the Master ADMIN account           │
│  → Admin sets their own email & password      │
└──────────────┬────────────────────────────────┘
               │
┌──────────────▼────────────────────────────────┐
│  STEP 2: Admin Creates HR Accounts            │
│  → Admin Panel → Users → Create User          │
│  → Role: "HR" | Email & Temporary Password    │
│  → HR must change password on first login     │
└──────────────┬────────────────────────────────┘
               │
┌──────────────▼────────────────────────────────┐
│  STEP 3: HR Registers Employees               │
│  → Employees Page → Add Employee form         │
│  → System auto-generates portal login         │
│  → Employee email + temporary password         │
│  → Employee must change password on first login│
└───────────────────────────────────────────────┘
```

### Password Policy

- All temporary passwords are set by the account creator (Admin for HR, HR for Employee)
- Users flagged with `must_change_password = true` are prompted on login
- Passwords are hashed with **Bcrypt** (never stored in plaintext)
- JWT tokens expire after **24 hours** (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`)

### Example Walkthrough: Creating Your First HR Account

1. Log in as **Admin** (credentials from Setup Wizard)
2. The sidebar shows the **full Admin menu**
3. Navigate to **Org Setup** → **Users tab** (or via API)
4. Click **"Create User"**
5. Enter:
   - **Email:** `hr@company.com`
   - **Password:** `TempPassword123!`
   - **Role:** `HR`
6. HR user logs in at `/login` with `hr@company.com` / `TempPassword123!`
7. System prompts HR to **change password** on first login

---

## 8. Module 1: Authentication & Access Control

### Features
- JWT-based stateless authentication
- Role-based route protection (Admin, HR, Employee)
- First-Run Setup lockout after initialization
- Password change enforcement for temporary accounts
- User activation/deactivation by Admin

### UI Pages
| Page | URL | Access |
|:-----|:----|:-------|
| Setup Wizard | `/setup` | Public (one-time only) |
| Login | `/login` | Public |

### Key API Endpoints

| Method | Endpoint | Description | Auth |
|:-------|:---------|:------------|:-----|
| `GET` | `/api/v1/auth/setup-status` | Check if first-run is complete | Public |
| `POST` | `/api/v1/auth/setup` | Run first-time setup | Public (once) |
| `POST` | `/api/v1/auth/login` | Login and receive JWT token | Public |
| `GET` | `/api/v1/auth/me` | Get current user profile | JWT Required |
| `POST` | `/api/v1/auth/change-password` | Update password | JWT Required |
| `GET` | `/api/v1/auth/users` | List all users | Admin only |
| `POST` | `/api/v1/auth/users` | Create HR or user account | Admin only |
| `PATCH` | `/api/v1/auth/users/{id}/status` | Activate/deactivate user | Admin only |

### Login API Example (cURL)

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@company.com", "password": "Admin@2026!"}'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "admin@company.com",
    "role": "Admin",
    "is_active": true,
    "must_change_password": false,
    "company_name": "Saylani Welfare Trust"
  }
}
```

### Using the JWT Token

All authenticated requests must include the token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  http://localhost:8000/api/v1/auth/me
```

---

## 9. Module 2: Organization Setup

### Features
- Company settings management (name, office hours, geofence coordinates)
- Department CRUD (Create, Read, Update, Delete)
- Designation CRUD
- Holiday calendar management
- Leave type quota configuration

### UI Page
| Page | URL | Access |
|:-----|:----|:-------|
| Org Setup | `/org-setup` | Admin (full), HR (read-only) |

### Org Setup Tabs

1. **Company Info** — Edit company name, office start time, grace period, geofence settings
2. **Departments** — Add/edit/delete departments (e.g., Engineering, Finance, HR)
3. **Designations** — Add/edit/delete designations (e.g., Software Engineer, Manager)
4. **Holidays** — Add company-wide holidays with date and name
5. **Leave Quotas** — View and modify leave type quotas (Annual, Sick, Casual, Unpaid)

### Key API Endpoints

| Method | Endpoint | Description | Auth |
|:-------|:---------|:------------|:-----|
| `GET` | `/api/v1/org/company` | Get company settings | JWT |
| `PUT` | `/api/v1/org/company` | Update company settings | Admin |
| `GET` | `/api/v1/org/departments` | List departments | JWT |
| `POST` | `/api/v1/org/departments` | Create department | Admin |
| `PUT` | `/api/v1/org/departments/{id}` | Update department | Admin |
| `DELETE` | `/api/v1/org/departments/{id}` | Delete department | Admin |
| `GET` | `/api/v1/org/designations` | List designations | JWT |
| `POST` | `/api/v1/org/designations` | Create designation | Admin |
| `PUT` | `/api/v1/org/designations/{id}` | Update designation | Admin |
| `DELETE` | `/api/v1/org/designations/{id}` | Delete designation | Admin |
| `GET` | `/api/v1/org/holidays` | List holidays | JWT |
| `POST` | `/api/v1/org/holidays` | Create holiday | Admin |
| `DELETE` | `/api/v1/org/holidays/{id}` | Delete holiday | Admin |
| `GET` | `/api/v1/org/leave-quotas` | List leave quotas | JWT |

---

## 10. Module 3: Employee Management

### Features
- Employee directory with search and filter (by department, designation, status)
- Employee registration form (HR creates employees)
- Auto-generated portal login for each employee
- Employee 360° profile view with all related data
- CSV dry-run import pipeline for bulk employee data
- Self-service profile editing for employees

### UI Pages
| Page | URL | Access |
|:-----|:----|:-------|
| Employee Directory | `/employees` | HR (manage), Employee (view self) |
| Employee 360° | `/employees/:id` | HR, Admin, Self |

### Employee Registration Flow

1. HR navigates to **Employees** page
2. Clicks **"Add Employee"**
3. Fills in:
   - First Name, Last Name
   - Personal Email
   - Phone Number
   - Department (dropdown)
   - Designation (dropdown)
   - Date of Joining
   - Base Salary
   - Portal Email (for system login)
   - Temporary Portal Password
4. On submit, the system:
   - Creates the employee record
   - Creates a portal User account linked to the employee
   - Sets `must_change_password = true`
5. Employee logs in → forced password change → full portal access

### Employee 360° View

The Employee 360° page shows a comprehensive profile:

- **Personal Information** — Name, email, phone, department, designation
- **Employment Details** — Date of joining, status, salary
- **Attendance History** — Recent check-ins/outs with timestamps
- **Leave Balance** — Current quota balances and leave history
- **Payroll History** — Past payslips

### Key API Endpoints

| Method | Endpoint | Description | Auth |
|:-------|:---------|:------------|:-----|
| `GET` | `/api/v1/employees` | List all employees (with search/filter) | JWT |
| `POST` | `/api/v1/employees` | Register new employee | HR, Admin |
| `GET` | `/api/v1/employees/{id}` | Get employee details | JWT |
| `PUT` | `/api/v1/employees/{id}` | Update employee | HR, Admin, Self |
| `GET` | `/api/v1/employees/{id}/full-profile` | Employee 360° data | JWT |
| `POST` | `/api/v1/employees/csv-dry-run` | CSV import preview | HR, Admin |
| `POST` | `/api/v1/employees/csv-import` | Execute CSV import | HR, Admin |

---

## 11. Module 4: Attendance Tracking

### Features
- **Web Check-In / Check-Out** with real-time clock display
- **GPS Geofence Validation** using Haversine formula (configurable radius)
- **Face Detection** via browser camera for check-in verification
- **Late Arrival Detection** based on office start time + grace minutes
- **Daily Attendance Log** with timestamps, GPS coordinates, and status
- **Monthly Attendance Report** with total present, absent, late days

### UI Page
| Page | URL | Access |
|:-----|:----|:-------|
| Attendance | `/attendance` | All roles (scoped) |

### How Check-In Works

1. Employee navigates to **Attendance** page
2. Page shows current date/time and check-in status
3. Employee clicks **"Check In"**
4. Browser requests:
   - **Geolocation** — compares with configured office coordinates
   - **Camera** — captures face for detection verification
5. System validates:
   - ✅ GPS within geofence radius (Haversine distance ≤ configured meters)
   - ✅ Face detected in camera frame
   - ⏰ Marks as "Late" if after `office_start + grace_minutes`
6. Check-in recorded with timestamp, lat/lng, and status

### How Check-Out Works

1. Employee clicks **"Check Out"** on same page
2. System records checkout timestamp
3. Working hours calculated: `checkout_time - checkin_time`

### Geofence Configuration

The office geofence is configured during First-Run Setup or via Org Setup:

| Setting | Default | Description |
|:--------|:--------|:------------|
| `office_lat` | `24.8607` | Office latitude (Karachi default) |
| `office_lng` | `67.0011` | Office longitude (Karachi default) |
| `office_radius_meters` | `150` | Radius in meters for valid check-in |
| `office_start` | `09:00` | Office start time (HH:MM) |
| `grace_minutes` | `15` | Late tolerance in minutes |

### Key API Endpoints

| Method | Endpoint | Description | Auth |
|:-------|:---------|:------------|:-----|
| `POST` | `/api/v1/attendance/check-in` | Record check-in with GPS & face | JWT |
| `POST` | `/api/v1/attendance/check-out` | Record check-out | JWT |
| `GET` | `/api/v1/attendance/today` | Get today's attendance record | JWT |
| `GET` | `/api/v1/attendance/history` | Get attendance history (filtered) | JWT |
| `GET` | `/api/v1/attendance/report` | Monthly attendance summary | HR, Admin |

---

## 12. Module 5: Leave Engine

### Features
- **Leave Application** with date range picker and type selection
- **Automatic Overlap Detection** — prevents double-booking leave dates
- **Quota Balance Tracking** — real-time balance dials showing remaining days
- **HR Approval Inbox** — pending requests with approve/reject actions
- **Holiday-Aware Calculation** — excludes company holidays from leave count
- **Leave History** — full history with status tracking

### UI Page
| Page | URL | Access |
|:-----|:----|:-------|
| Leave | `/leave` | HR (approve), Employee (apply) |

### Leave Application Flow

1. Employee goes to **Leave** page
2. Sees their **Balance Dials** — visual gauges for each leave type
3. Clicks **"Apply for Leave"**
4. Selects:
   - **Leave Type** (Annual, Sick, Casual, Unpaid)
   - **Start Date** and **End Date**
   - **Reason** (text)
5. System validates:
   - ✅ Sufficient balance for the leave type
   - ✅ No overlapping approved/pending leaves
   - ✅ Dates are valid (start ≤ end, not in past)
6. Leave request created with status: **Pending**

### HR Approval Flow

1. HR navigates to **Leave** page → sees **Approval Inbox**
2. Pending requests show employee name, dates, type, reason
3. HR clicks **Approve** or **Reject** (with optional note)
4. Employee is notified of the decision
5. If approved → leave balance is deducted

### Leave Types & Quotas

| Type | Annual Days | Paid | Notes |
|:-----|:------------|:-----|:------|
| Annual Leave | 14 | ✅ | Standard vacation |
| Sick Leave | 8 | ✅ | Medical leave |
| Casual Leave | 10 | ✅ | Short notice leave |
| Unpaid Leave | ∞ | ❌ | No pay, unlimited |

### Key API Endpoints

| Method | Endpoint | Description | Auth |
|:-------|:---------|:------------|:-----|
| `POST` | `/api/v1/leave/apply` | Submit leave application | Employee |
| `GET` | `/api/v1/leave/my-leaves` | Employee's leave history | JWT |
| `GET` | `/api/v1/leave/my-balance` | Current leave balances | JWT |
| `GET` | `/api/v1/leave/pending` | HR approval inbox | HR, Admin |
| `POST` | `/api/v1/leave/{id}/approve` | Approve leave request | HR, Admin |
| `POST` | `/api/v1/leave/{id}/reject` | Reject leave request | HR, Admin |

---

## 13. Module 6: Payroll Lite

### Features
- **Salary Computation Engine:**
  - Base salary from employee record
  - Overtime at **1.5× rate** based on attendance hours
  - Pakistani tax slab calculation
  - Custom deductions (loans, advances, penalties)
  - Custom allowances
- **Draft → Finalize Workflow:**
  - HR drafts payroll for a pay period
  - Admin reviews and locks/finalizes
  - Once finalized, payroll is immutable
- **Payslip Generation** for employees

### UI Page
| Page | URL | Access |
|:-----|:----|:-------|
| Payroll | `/payroll` | Admin (lock), HR (draft), Employee (view) |

### Payroll Calculation Formula

```
Gross Salary = Base Salary + Overtime Pay + Allowances
Overtime Pay = (Base Salary / 22 / 8) × 1.5 × Overtime Hours
Tax = Applied per Pakistani tax slabs
Net Salary = Gross Salary - Tax - Deductions
```

### Pakistani Tax Slabs (Implemented)

| Annual Income Range (PKR) | Tax Rate |
|:--------------------------|:---------|
| Up to 600,000 | 0% |
| 600,001 – 1,200,000 | 2.5% of excess |
| 1,200,001 – 2,400,000 | 15,000 + 12.5% of excess |
| 2,400,001 – 3,600,000 | 165,000 + 22.5% of excess |
| 3,600,001 – 6,000,000 | 435,000 + 27.5% of excess |
| Above 6,000,000 | 1,095,000 + 35% of excess |

### Payroll Workflow

1. **HR Drafts Payroll:**
   - Selects pay period (month/year)
   - System auto-calculates based on attendance and salary
   - HR can add deductions and allowances
   - Status: **Draft**

2. **Admin Finalizes:**
   - Reviews draft payroll entries
   - Clicks **"Finalize"** to lock
   - Status: **Finalized** (immutable)

3. **Employee Views Payslip:**
   - Employees see their payslip for each finalized period
   - Shows gross, deductions, tax, net salary breakdown

### Key API Endpoints

| Method | Endpoint | Description | Auth |
|:-------|:---------|:------------|:-----|
| `POST` | `/api/v1/payroll/draft` | Draft payroll for a period | HR |
| `GET` | `/api/v1/payroll/period` | Get payroll for a period | HR, Admin |
| `POST` | `/api/v1/payroll/finalize` | Lock and finalize payroll | Admin |
| `GET` | `/api/v1/payroll/my-payslips` | Employee's payslips | Employee |
| `GET` | `/api/v1/payroll/{id}` | Specific payslip detail | JWT |
| `POST` | `/api/v1/payroll/{id}/deductions` | Add deduction | HR, Admin |
| `POST` | `/api/v1/payroll/{id}/allowances` | Add allowance | HR, Admin |

---

## 14. Module 7: AI Assistant

### Features
- **Conversational AI** powered by Google Gemini with 7 scoped HCM tools
- **Tool-Calling Architecture** — the AI can execute real database queries
- **Zero-Hallucination Policy** — responses grounded in actual system data
- **Deterministic Fallback** — works without API key using direct DB queries
- **Role-Scoped** — AI respects the user's RBAC permissions

### UI Page
| Page | URL | Access |
|:-----|:----|:-------|
| AI Assistant | `/ai-assistant` | All roles |

### 7 Scoped AI Tools

| Tool | Description | Example Query |
|:-----|:------------|:--------------|
| `get_employee_info` | Look up employee details | "Tell me about Ahmed Khan's profile" |
| `get_attendance_summary` | Attendance statistics | "What's the attendance rate this month?" |
| `get_leave_balance` | Check leave balances | "How many sick days do I have left?" |
| `get_payroll_summary` | Payroll totals | "What was total payroll for October?" |
| `get_department_stats` | Department-level metrics | "How many people are in Engineering?" |
| `get_policy_info` | Company policy lookup | "What is the overtime policy?" |
| `get_anomaly_detection` | ML-powered absence anomalies | "Are there any attendance anomalies?" |

### How to Use the AI Assistant

1. Navigate to **AI Assistant** from the sidebar
2. Type your question in natural language
3. The AI processes your query, optionally calling tools to fetch real data
4. Receive a grounded response with actual system data

### Example Conversations

**Employee:**
> "How many casual leave days do I have remaining?"

**AI Response:**
> "You have 7 out of 10 casual leave days remaining for this year. You've used 3 days so far."

**HR:**
> "Show me today's attendance summary"

**AI Response:**
> "Today's attendance: 45 of 52 employees checked in (86.5% attendance rate). 3 employees were late. 4 employees are on approved leave."

**Admin:**
> "What was the total payroll expense last month?"

**AI Response:**
> "September 2026 payroll summary: Total gross: PKR 4,250,000. Total deductions: PKR 425,000. Total tax: PKR 380,000. Total net payout: PKR 3,445,000."

> **💡 TIP:** The AI Assistant requires a valid `GEMINI_API_KEY` in your `.env` file for full conversational capabilities. Without it, the system falls back to deterministic database-grounded responses that still answer queries accurately using the 7 tools.

---

## 15. Module 8: Communications & Audit Trail

### Features

#### Announcements
- **Admin/HR broadcast** announcements to all employees
- **Priority levels:** Normal, Important, Urgent
- **Notification bell** in the top navigation with unread badge
- Real-time notification dropdown

#### Audit Trail
- **Immutable audit log** recording every system action
- Captures: Actor, Action, Entity, Before/After state, IP address, Timestamp
- Searchable and filterable by action type, entity, and date range
- Admin-only access for full audit log viewing

### UI Pages
| Page | URL | Access |
|:-----|:----|:-------|
| Audit Logs | `/audit-logs` | Admin |

### Audit Log Format

Each audit entry captures:

| Field | Description |
|:------|:------------|
| `actor_id` | User who performed the action |
| `action` | Action type (e.g., `CREATE_EMPLOYEE`, `APPROVE_LEAVE`) |
| `entity` | Entity type (e.g., `Employee`, `LeaveRequest`) |
| `entity_id` | ID of the affected entity |
| `before_state` | JSON snapshot before the change |
| `after_state` | JSON snapshot after the change |
| `ip_address` | Client IP address |
| `timestamp` | UTC timestamp |

### Tracked Actions

| Action | Trigger |
|:-------|:--------|
| `FIRST_RUN_SETUP` | System initialization |
| `CREATE_USER` | New user account created |
| `UPDATE_USER_STATUS` | User activated/deactivated |
| `CREATE_EMPLOYEE` | New employee registered |
| `UPDATE_EMPLOYEE` | Employee profile updated |
| `CHECK_IN` | Attendance check-in |
| `CHECK_OUT` | Attendance check-out |
| `APPLY_LEAVE` | Leave application submitted |
| `APPROVE_LEAVE` | Leave request approved |
| `REJECT_LEAVE` | Leave request rejected |
| `DRAFT_PAYROLL` | Payroll drafted |
| `FINALIZE_PAYROLL` | Payroll finalized |
| `CREATE_ANNOUNCEMENT` | Announcement posted |

### Key API Endpoints

| Method | Endpoint | Description | Auth |
|:-------|:---------|:------------|:-----|
| `POST` | `/api/v1/comms/announcements` | Post announcement | Admin, HR |
| `GET` | `/api/v1/comms/announcements` | List announcements | JWT |
| `GET` | `/api/v1/comms/notifications` | Get user notifications | JWT |
| `POST` | `/api/v1/comms/notifications/{id}/read` | Mark notification as read | JWT |
| `GET` | `/api/v1/comms/audit-logs` | List audit trail entries | Admin |

---

## 16. Module 9: Executive Dashboard

### Features
- **Active Headcount** — real-time count of active employees
- **Today's Attendance Rate** — percentage with visual indicator
- **Monthly Payroll Payout** — total net salary for current period
- **ML Metrics** — attrition risk score and anomaly alerts
- **Announcements Feed** — latest company-wide announcements
- **Role-Scoped Views** — Admin sees everything, HR sees operational metrics, Employees see personal stats

### UI Page
| Page | URL | Access |
|:-----|:----|:-------|
| Dashboard | `/dashboard` | All roles (scoped) |

### Dashboard Cards

| Card | Metric | Source |
|:-----|:-------|:-------|
| **Active Headcount** | Number of active employees | Employee table count |
| **Attendance Rate** | Today's check-in percentage | Attendance records |
| **Payroll Payout** | Current month total net | Payroll records |
| **ML Risk Score** | Predictive attrition % | Scikit-Learn model |
| **Pending Leaves** | Awaiting HR approval | Leave requests |
| **Announcements** | Latest broadcasts | Comms module |

### Key API Endpoint

| Method | Endpoint | Description | Auth |
|:-------|:---------|:------------|:-----|
| `GET` | `/api/v1/org/dashboard-summary` | Unified dashboard data | JWT |

---

## 17. API Reference

### Base URL
```
http://localhost:8000/api/v1
```

### Interactive Documentation

Swift-HCM Lite auto-generates interactive API documentation:

| Format | URL |
|:-------|:----|
| **Swagger UI** | http://localhost:8000/docs |
| **ReDoc** | http://localhost:8000/redoc |
| **OpenAPI JSON** | http://localhost:8000/openapi.json |

### Authentication

All protected endpoints require a Bearer token:

```
Authorization: Bearer <your_jwt_token>
```

### Health Check

```bash
curl http://localhost:8000/api/v1/health
```

**Response:**
```json
{
  "status": "online",
  "product": "Swift-HCM Lite",
  "company": "Lyntica",
  "environment": "development",
  "ai_model": "gemini-2.5-flash",
  "database": "connected"
}
```

### Complete Endpoint Map

| Module | Prefix | Endpoints |
|:-------|:-------|:----------|
| Auth & Access | `/api/v1/auth/` | 7 endpoints |
| Organization | `/api/v1/org/` | 12 endpoints |
| Employees | `/api/v1/employees/` | 7 endpoints |
| Attendance | `/api/v1/attendance/` | 5 endpoints |
| Leave | `/api/v1/leave/` | 6 endpoints |
| Payroll | `/api/v1/payroll/` | 7 endpoints |
| AI Assistant | `/api/v1/ai/` | 1 endpoint |
| Communications | `/api/v1/comms/` | 5 endpoints |
| Health | `/api/v1/health` | 1 endpoint |

---

## 18. Running Tests

### Full Test Suite

```powershell
python -m pytest backend/tests/ -v
```

### Test Files

| File | Coverage |
|:-----|:---------|
| `test_phase1_auth_org.py` | Auth flow, setup, login, RBAC |
| `test_phase2_employees.py` | Employee CRUD, search, CSV pipeline |
| `test_phase3_attendance.py` | Check-in/out, geofence, late detection |
| `test_phase4_payroll.py` | Salary calc, tax slabs, draft/finalize |
| `test_phase5_ai_comms.py` | AI tools, announcements, audit logs |

### Run Specific Test File

```powershell
# Run only auth tests
python -m pytest backend/tests/test_phase1_auth_org.py -v

# Run only payroll tests
python -m pytest backend/tests/test_phase4_payroll.py -v
```

### Expected Output

```
backend/tests/test_phase1_auth_org.py::test_setup_status PASSED
backend/tests/test_phase1_auth_org.py::test_first_run_setup PASSED
backend/tests/test_phase2_employees.py::test_create_employee PASSED
...
========== 8 passed in 4.52s ==========
```

---

## 19. Docker Deployment

### Prerequisites
- Docker Desktop installed and running
- Docker Compose available

### Quick Start

```powershell
# 1. Copy environment file
copy .env.example .env

# 2. Edit .env — set your Gemini API key and JWT secret
notepad .env

# 3. Build and start
docker compose up --build

# 4. Access the application
# Frontend → http://localhost:3000
# Backend  → http://localhost:8000
# Swagger  → http://localhost:8000/docs
```

### Docker Services

| Service | Image | Port | Description |
|:--------|:------|:-----|:------------|
| `db` | `postgres:16-alpine` | `5432` | PostgreSQL database |
| `backend` | Custom (Python 3.11) | `8000` | FastAPI application |
| `frontend` | Custom (Nginx) | `3000` | React production build |

### Docker Environment Variables

| Variable | Docker Default | Description |
|:---------|:---------------|:------------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgrespassword@db:5432/swift_hcm` | Auto-configured for Postgres |
| `GEMINI_API_KEY` | From `.env` | Must be set in root `.env` |
| `JWT_SECRET` | From `.env` or default | JWT signing key |
| `ENVIRONMENT` | `production` | Set to production in Docker |
| `AI_MODEL` | `gemini-3.5-flash-lite` | Model for AI Assistant |

### Docker Commands

```powershell
# Build and start (foreground)
docker compose up --build

# Build and start (background)
docker compose up --build -d

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend

# Stop all services
docker compose down

# Stop and remove data volumes (full reset)
docker compose down -v

# Rebuild specific service
docker compose build backend
```

---

## 20. Troubleshooting

### Common Issues

#### "Module not found" when starting backend
```
ModuleNotFoundError: No module named 'fastapi'
```
**Solution:** Install dependencies:
```powershell
python -m pip install -r backend/requirements.txt
```

#### Backend starts but frontend can't connect (CORS error)
**Solution:** Ensure the backend is running on port `8000` and the `CORS_ORIGINS` in `.env` includes your frontend URL:
```ini
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

#### "Database is locked" error (SQLite)
**Solution:** Only one process should access the SQLite database. Stop any duplicate backend instances:
```powershell
# Kill existing uvicorn processes
taskkill /f /im uvicorn.exe
# Restart
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

#### AI Assistant returns "API key not configured"
**Solution:** Set your Gemini API key in the `.env` file:
```ini
GEMINI_API_KEY=AIzaSy...your_key_here
```

#### First-Run Setup says "System has already been initialized"
**Solution:** The setup can only run once. To reset, delete the database:
```powershell
# Delete SQLite database (local mode)
del backend\swift_hcm.db
del swift_hcm.db

# Restart the backend — fresh database auto-created
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

#### Port already in use
```powershell
# Find process using port 8000
netstat -ano | findstr :8000

# Kill by PID
taskkill /f /pid <PID>
```

#### Camera/Geolocation not working for Attendance
**Solution:** 
- Ensure you're accessing via `localhost` (not IP) — browsers require HTTPS for camera/geo on non-localhost
- Grant camera and location permissions in browser settings
- Check that browser supports `navigator.mediaDevices.getUserMedia`

#### Docker: PostgreSQL won't start
```powershell
# Check if port 5432 is already in use
netstat -ano | findstr :5432

# If another PostgreSQL is running, stop it first
net stop postgresql-x64-16
```

### Reset to Clean State

To completely reset the system for a fresh demo:

```powershell
# Local mode:
del backend\swift_hcm.db
del swift_hcm.db
# Restart backend — app boots into Setup Wizard

# Docker mode:
docker compose down -v
docker compose up --build
```

---

## 21. Glossary

| Term | Definition |
|:-----|:-----------|
| **Admin** | Master system administrator with full access |
| **HR** | Human Resources manager who manages employees, approves leaves, drafts payroll |
| **Employee** | Staff member with self-service portal access |
| **JWT** | JSON Web Token — stateless authentication token |
| **RBAC** | Role-Based Access Control — permissions based on user role |
| **Geofence** | GPS-based boundary for validating check-in location |
| **Haversine** | Mathematical formula for calculating distance between GPS coordinates |
| **Payroll Period** | Monthly pay cycle (month/year combination) |
| **Draft** | Payroll state before admin approval |
| **Finalized** | Locked, immutable payroll state after admin approval |
| **Leave Quota** | Annual allocation of leave days per type |
| **Overlap Detection** | System check preventing double-booking of leave dates |
| **Audit Trail** | Immutable log of all system actions for compliance |
| **First-Run Setup** | One-time initialization wizard that creates the organization and admin account |
| **Grounding** | AI technique ensuring responses are based on actual data, not hallucinations |
| **Tool-Calling** | AI capability to execute database queries through predefined functions |

---

**© 2026 Lyntica — Swift-HCM Lite | Saylani Hackathon 2026**
