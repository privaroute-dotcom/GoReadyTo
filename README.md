# WorkProof — simple local version

This package is prepared so you can run the **web app without Docker**. The browser demo handles registration, login, personal rooms and employer job drafts locally, so Docker/PostgreSQL is not needed to see and use the core flow.

## Run it

1. Install Node.js 22+.
2. Open this folder in PowerShell.
3. Run:

```powershell
npm install
npm run dev
```

Or double-click `START_WORKPROOF.bat`.

## Google Maps

Create `apps/web/.env` and put your own key in it:

```env
VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_KEY
VITE_GOOGLE_MAPS_MAP_ID=
VITE_API_URL=http://localhost:4000
```

Do not paste the key into chat. Keep it in your local `.env` file.

## Personal rooms

Register as **Worker**, **Employer**, or **Agency**. After registration/login, WorkProof opens that user's own room. The signed-in user, accounts and employer job drafts are kept in browser storage for this local/demo mode.

The original NestJS API, PostgreSQL migrations and Docker configuration are still included in the project for a later production backend setup. You do **not** need to run `npm run db:init` for the simple local web version.
