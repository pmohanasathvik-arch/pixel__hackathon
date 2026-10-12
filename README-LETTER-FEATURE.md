# PSYNS Platform — Official Letter Feature

This package keeps the supplied React/Vite interface and adds a letter submission/inbox page plus a FastAPI backend for authenticated faculty lookup, private file upload, delivery records, status updates, and authorised document downloads.

## Important scope
- The supplied frontend had a real `/api/auth/login` call but its event requests/attendance/reports still use localStorage demo data. This feature does not migrate those existing modules to the database.
- Demo faculty accounts use the `proctor` role in the existing role model. The `Letters` menu appears to students, proctors (faculty inbox), and in-charge accounts.
- Demo accounts/passwords are for local testing only. This is not production-ready identity management. Before deployment, replace the demo login, use a strong secret, add institutional account provisioning, HTTPS, malware scanning, backups, retention/deletion rules, and review privacy requirements.
- Documents are stored in `Backend/private_uploads/`, not exposed as static web files. Only the submitting student, addressed faculty account, and event in-charge can download a letter. File upload accepts PDF/DOCX up to 10 MB and checks extension, content type, and basic file signature; add antivirus/content scanning before real-world use.

## 1. Run backend (Windows PowerShell)
Open a terminal in the `Backend` folder:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:PSYNS_TOKEN_SECRET = "replace-this-with-a-long-random-secret"
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell blocks activation, skip activation and use:

```powershell
py -m pip install -r requirements.txt
py -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Check `http://127.0.0.1:8000/api/health` returns `{"status":"ok"}`.

## 2. Run frontend
Open a second terminal in `Frontend/PSYNS-Platform`:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the URL Vite prints, usually `http://localhost:5173`.

## 3. Local demo accounts
- Student: `student@psyns.demo` / `demo123`
- Faculty inbox: `proctor@psyns.demo` / `demo123`
- Second faculty option: `faculty2@psyns.demo` / `demo123`
- Event in-charge: `incharge@psyns.demo` / `demo123`

Use the matching role/account on the login screen. Login role is assigned by the backend account, not trusted from the role button.

## 4. Test the workflow
1. Sign in as `student@psyns.demo`.
2. Open **Letters**, choose registered faculty, enter subject/purpose, attach a non-sensitive test PDF or DOCX, then send.
3. Sign out and sign in as the faculty account selected.
4. Open **Letters**, download the document, add optional remarks, and approve/reject/request more information.
5. Sign back in as the student and refresh **Letters** to see the updated status.

The backend database (`psyns.sqlite3`) and private uploaded files are created locally at runtime. Back them up and do not commit real student documents to GitHub.

## Academic profile import (added)

The event in-charge can open **Academic profiles** in the sidebar and upload a CSV or Excel workbook (`.csv`, `.xlsx`, `.xls`). Download the template from that page. Required columns are `Roll Number` and `Student Name`; optional columns include `Department`, `Year`, `Section`, `Classes Conducted`, `Classes Attended`, `CGPA`, `Backlogs`, and `Data As Of`. Import is validated and stored in the backend database by normalized roll number. Only an authenticated in-charge account can import these records.

When a faculty member opens a letter in their inbox, the backend attaches the academic profile matching that student's registered roll number. Attendance is calculated from imported classes attended/conducted. Missing values are shown as “Not imported”; PSYNS does not invent academic figures. Students can only access their own profile endpoint; faculty only receive profiles for letters addressed to them, and the in-charge can see profiles in the authorised letter overview. Academic data is not placed in public/static files.

Use real academic records only with institutional permission. This is a local development implementation; before production, replace demo authentication/secrets with the institution's identity system, enforce HTTPS, and establish access auditing, retention, and privacy policies. No letter is sent by importing academic profiles.

## Faculty AI academic review assistant (optional GPT connection)

The faculty inbox now includes **Ask AI about this student** on each letter. It is restricted to the faculty account that the letter was addressed to. The assistant receives only that letter and the matching imported academic profile. It must identify missing data, must not invent academic values, and does not decide whether to approve/reject.

- Without an API key, the backend responds in transparent **basic mode** using only the imported facts and missing-data guidance.
- To enable GPT-style conversational answers, configure `OPENAI_API_KEY` in the backend process environment and optionally set `OPENAI_MODEL` (default `gpt-4o-mini`). Never put the key in frontend code or commit it to source control. Install requirements again after adding `httpx`.
- Restart the backend after setting environment variables. If the key is not configured, the assistant is not a GPT model and says so.
- The faculty member remains responsible for verifying the college record and applying official policy. The assistant is decision support only.

Demo student roll number is `25AI001`. For a demo import that matches the seeded student account, use that exact roll number; the older `DEMO001` sample will not match this account.
