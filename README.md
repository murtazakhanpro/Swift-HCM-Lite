# Swift-HCM Lite

**AI-Assisted Human Capital Management System**  
Saylani Hackathon 2026 • Zaitoon Ashraf IT Park  
Built by **[Lyntica](https://www.lyntica.com/)**

---

## 👥 Engineering & Leadership Team

* **Murtaza Ali Khan** — AI/ML & Data Science Lead  
  [Portfolio](https://www.murtazaalikhan.com/) • [GitHub](https://www.github.com/murtazakhanpro) • [LinkedIn](https://www.linkedin.com/in/murtazakhanpro) • [Hugging Face](https://huggingface.co/murtazakhanpro)
* **Fiza Baneen Khan** — Modern Web & App Engineering Lead  
  [Portfolio](https://www.fizabaneen.com/) • [GitHub](https://www.github.com/fizabaneen) • [LinkedIn](https://www.linkedin.com/in/fizabaneen)

---

## 🚀 Technology Stack

* **Backend:** Python FastAPI (Asynchronous high-throughput, Pydantic V2, PyJWT, Bcrypt)
* **AI & LLM:** Google Gemini 3.5 Flash / Gemini Flash Lite with scoped tool-calling and zero-hallucination policy grounding
* **Data Science & ML:** NumPy, Pandas, Scikit-Learn (Predictive Attrition & Absence Anomaly Detection)
* **Database:** Dual-Engine Architecture
  * **Local Zero-Install:** Asynchronous SQLite (`sqlite+aiosqlite`)
  * **Containerized Production / Judging:** PostgreSQL 16 (`postgresql+asyncpg`)
* **Frontend:** React 19 + TypeScript + Vite + Custom CSS Tokens (`#B3FF21` Neon Lime, `#18191D` Slate Canvas, `#015AFF` Blue)
* **Containerization:** Docker Compose

---

## 📋 Hackathon Compliance Guarantee: Clean-Slate Database

Per the official Saylani HCM Lite challenge rules:
> *"The system starts empty, Admin sets up the company, HR registers employees, and every number comes from what people do in the app."*

* Swift-HCM Lite contains **zero seeded dummy data**.
* On first launch, the application boots into the **First-Run Setup Wizard** where judges configure the organization and register the master Admin account.
* Master Admin then creates HR accounts; HR registers employees.
* Each employee registration automatically generates a portal sign-in with a temporary password that must be updated upon first login.

---

## ⚡ Quick Start: Run in Under 5 Minutes

### Option A: Local Development (Recommended, Zero External Dependencies)

#### 1. Backend Setup (FastAPI)
```powershell
# In the root repository directory:
python -m pip install -r backend/requirements.txt

# Run the FastAPI server:
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```
*API Swagger Documentation will be accessible at: [http://localhost:8000/docs](http://localhost:8000/docs)*

#### 2. Frontend Setup (React 19 + Vite)
```powershell
# In a new terminal:
cd frontend
npm install
npm run dev
```
*Web Application will be accessible at: [http://localhost:5173](http://localhost:5173)*

---

### Option B: Docker Compose (Full Stack with PostgreSQL)

```powershell
# Set your Gemini API Key in .env, then run:
docker compose up --build
```
*Frontend runs on [http://localhost:3000](http://localhost:3000)*  
*Backend runs on [http://localhost:8000](http://localhost:8000)*

---

## 🧪 Automated Test Suite

Run the full end-to-end integration and unit test suite:
```powershell
python -m pytest backend/tests/ -v
```

---

## 📦 Progress & Modules Status

| Module | Feature Set | Scope / Role | Implementation Status |
| :--- | :--- | :--- | :---: |
| **M1: Auth & Access** | First-Run Setup, Login, Change Temp Password, JWT RBAC | Admin, HR, Employee | ✅ Completed & Verified |
| **M2: Org Setup** | Company Settings, Departments, Designations, Holidays, Quotas | Admin (Manage), HR (View) | ✅ Completed & Verified |
| **M3: Employees** | Directory, Search & Filter, Employee 360, Dry-Run CSV Pipeline | HR (Manage), Employee (Self-Edit) | ✅ Completed & Verified |
| **M4: Attendance** | Web Check-In/Out, GPS Geofence Haversine, Face Detection | All Roles (Scoped) | ✅ Completed & Verified |
| **M5: Leave Engine** | Quotas, Overlap Checks, HR Approval Inbox, Balance Dials | HR (Approve), Employee (Apply) | ✅ Completed & Verified |
| **M6: Payroll Lite** | Salary Formula (1.5x), Tax Slabs, Deductions, Draft → Finalize | Admin (Lock), HR (Draft), Emp | ✅ Completed & Verified |
| **M7: AI Assistant** | 7 Scoped Tools, Policy Q&A, Grounded Gemini Responses | All Roles (Scoped) | ✅ Completed & Verified |
| **M8: Comms & Audit**| Announcements, Notifications, Immutable Audit Trail | Role Scoped | ✅ Completed & Verified |
| **M9: Dashboards** | Headcount, Attrition, Attendance Rate, ML Insights | Role Scoped | 🔄 In Progress |