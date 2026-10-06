# Run the project on this PC

The project is configured in `E:\capstone\capstone`.

1. Double-click **Start Project.cmd**.
2. Open http://localhost:3000 in your browser.
3. Sign in with your local administrator account.
4. Double-click **Stop Project.cmd** when finished.

Starting again after a reboot uses the same saved database. Keep this folder in place: the Python environment and backend settings contain absolute paths.

## Installed setup

- Node.js 22.23.3 and PostgreSQL 18.6 are under `.local`.
- Python dependencies use `.venv` and the existing Python 3.14 installation.
- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- PostgreSQL: `127.0.0.1:5433`, database `ims_db`; credentials are in `ims-backend/.env`.
- Backend and frontend configuration: `ims-backend/.env` and `ims-frontend/.env.local`.
- Database storage: `.local/pgdata`. Keep this directory to preserve your work.
- Logs: `.local/backend.log`, `.local/backend-error.log`, `.local/frontend.log`, `.local/frontend-error.log`, and `.local/postgres.log`.

The database was restored from `ims_db_backup.sql` using `pg_restore`: this file is a custom PostgreSQL archive despite the `.sql` extension. The original backup was preserved. All 17 repository migrations are applied. The final migration reclassifies historical voided orders as refunds and keeps the original classification in metadata. The external-file seed script was not used.

The launchers run in the background and detect previously started processes. They do not register a Windows service, so run Start Project after restarting Windows.

## Editing the application

The launcher uses built application files. After code changes, stop the project and rebuild in PowerShell from this directory:

```powershell
$env:Path = "$PWD\.local\node-v22.23.3-win-x64;$env:Path"
Push-Location ims-backend
npm.cmd run prisma:generate
npm.cmd run build
Pop-Location
Push-Location ims-frontend
npm.cmd run build
Pop-Location
.\start-project.ps1
```

For live frontend editing, run `npm.cmd run dev` from `ims-frontend` with the same PATH, after stopping the launched frontend. The backend development command is `npm.cmd run start:dev` from `ims-backend`.

If the frontend opens but sign-in reports **Failed to fetch**, start the database and backend from the project root:

```powershell
.\start-project.ps1 -BackendOnly
```

This leaves your running frontend development server in place. Run it again after restarting Windows; `npm.cmd run dev` in `ims-frontend` starts only the frontend.

## Optional integrations

Store availability searches need your own `SERPER_API_KEY` and `GROQ_API_KEY` in `ims-backend/.env`; restart after adding them. Python packages are installed, but these external searches are not configured without the keys.

SMTP email is not configured. In the current local development backend, password reset links are written to `.local/backend.log`. See `ims-backend/EMAIL_SETUP.md` to configure actual email delivery.

Runtime sources: [Node.js official downloads](https://nodejs.org/download/release/latest-v22.x/) and [EDB PostgreSQL binaries](https://www.enterprisedb.com/download-postgresql-binaries).
