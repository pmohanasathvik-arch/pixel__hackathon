# PSYNS Platform

React + Vite starter for the Technical Event Participation Approval and Attendance Monitoring Portal.

## Run locally
1. Install Node.js (LTS).
2. Open this folder in VS Code.
3. In the terminal run:
   ```bash
   npm install
   npm run dev
   ```
4. Open the local URL printed by Vite.

## Demo access
Choose a role on the sign-in screen. This is a **demo front end** with localStorage persistence, not production authentication.

- Student: `student@psyns.demo`
- Proctor: `proctor@psyns.demo`
- In-charge: `incharge@psyns.demo`

Any password of 4 or more characters works in demo mode. Do not use real student data or real passwords.

## Attendance import
The in-charge can import `.csv` or `.xlsx` attendance files. Required columns:
`Roll Number`, `Student Name`, `Department`, `Year`, `Section`, `Classes Conducted`, `Classes Attended`, `Data As Of`.

The importer previews and validates rows before saving. Attendance is calculated as `attended / conducted * 100`; invalid rows are skipped. A sample CSV is in `public/sample-attendance.csv`.

## Current scope and production work
Included: role-specific navigation, sample dashboards, event-request creation, proctor recommendation, in-charge final decision, attendance CSV/XLSX preview/import, threshold setting, filters, CSV report export, request history, localStorage persistence.

Before production: connect a real authentication provider and database, enforce role permissions on the server, add secure document storage, and test against your institution's official rules. Front-end route protection alone is not a security boundary.
