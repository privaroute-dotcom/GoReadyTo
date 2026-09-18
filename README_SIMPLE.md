# WorkProof — Connected Rooms

This local version is designed to test the full browser workflow without Docker/PostgreSQL.

## Run
1. Open a terminal in this folder.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the localhost address Vite prints (normally `http://localhost:5173`).

If you use Google Maps, create `apps/web/.env` with:

```env
VITE_GOOGLE_MAPS_API_KEY=YOUR_KEY
VITE_GOOGLE_MAPS_MAP_ID=
VITE_API_URL=http://localhost:4000
```

Do not put your real API key into chat. Add it locally to `.env`.

## Connected workflow

### Employer / Agency
- Register an Employer or Agency account.
- Open **Post a job** and publish an opening.
- Open **Job management** to see only jobs owned by that account.
- Close/reopen or remove a job.
- Open **Review applications** for an opening.
- Move candidate status through `SUBMITTED → REVIEWING → INTERVIEW → OFFER → HIRED / REJECTED`.
- Message a candidate from the application review screen.

### Worker
- Register a separate Worker account.
- Open **Jobs** and view the employer's published job.
- Press **Apply** and submit the application.
- Open **My applications** to track the status.

The application record contains the worker ID and employer ID, so both rooms see the same application from their own side.

## Important
This is a local demo. Data is stored in browser `localStorage`; passwords are not production-secure, and messaging is not server-enforced privacy. A production release should move authentication, authorization, applications, conversations and files to the backend/database.

Docker/PostgreSQL is not required for this simple workflow. Do not run `npm run db:init` for this version.
