# GoReadyTo — V8 Compliance Workflow

This version turns the Country Requirements navigator into an active part of the job lifecycle.

## What changed

- **Job compliance profile** — Employer/Agency job posting now captures destination country, occupation, employment model and whether international applicants are accepted.
- **Rule attachment** — the job stores the verified rule IDs that were visible for that country/workflow at publication time.
- **Worker nationality** — Worker profiles can store nationality; applications also capture the nationality used for that specific route.
- **Application compliance route** — before submitting, a Worker sees a route such as `Nationality → Destination` plus document/evidence readiness and official source links.
- **Employer/Agency review** — received applications show the same job route with the responsibility-specific compliance checklist.
- **Agency placement compliance** — placements now retain the application relationship and display the agency-side checklist.
- **Live evidence readiness** — the compliance status is recalculated from the worker's current private documents/proof instead of trusting a stale badge.
- **Public job compliance view** — each job page exposes its country, occupation, employment model, international-applicant setting and official sources.
- **Job details routing fix** — `/jobs/:id`, `/workers/:id` and `/companies/:id` now resolve before their directory pages.
- **Responsive compliance UI** — new panels, route cards, status badges and mobile layouts were added to the light GoReadyTo design.

## Current compliance states

- **Ready** — available evidence satisfies the automated evidence check.
- **In progress** — required evidence is missing.
- **Needs review** — the platform cannot safely determine legal eligibility automatically and requires official-source/manual confirmation.
- **Not started** — no verified rule set is available for the route.

The system deliberately does **not** treat absence of a rule as proof that no legal requirement exists.

## Run

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`.

Google Maps remains configured through `apps/web/.env` using your own API key. Do not paste the key into chat or commit it to source control.

## Demo/storage note

This remains a browser-local demo using `localStorage`. Production GoReadyTo should move authentication, permissions, applications, compliance records, official-source registry, documents and audit history to a server/database with secure sessions, hashed passwords, server-enforced access control and real file storage.

The legal data in this build is a **small verified seed**, not a complete global legal database. Production coverage should be expanded country-by-country from official sources and versioned with effective dates and refresh/verification history.

## Build verification note

The generation environment did not have the project dependencies installed, so a full Vite build could not be completed here. TypeScript/JSX transpilation was checked for syntax successfully.
