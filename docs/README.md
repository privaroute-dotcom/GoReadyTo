# WorkProof Complete

A map-first verified employment and international mobility platform built on the GoReadyTo technical foundation supplied by the user.

## Structure
- apps/web — React/Vite website and dashboards
- services/api — NestJS API foundation
- services/api/sql — PostgreSQL/PostGIS + employment schema
- packages/* — shared geo/types/validation

## Run
1. `npm install`
2. `npm run infra:up`
3. Initialize database if needed: `npm run db:init` then apply `services/api/sql/002_employment.sql` and `003_seed.sql` through psql.
4. `npm run api:dev`
5. In a second terminal: `npm run web:dev`
6. Open `http://localhost:5173`

## Google Maps
Copy `apps/web/.env.example` to `apps/web/.env` and set `VITE_GOOGLE_MAPS_API_KEY` and optionally `VITE_GOOGLE_MAPS_MAP_ID`.

The web map is intentionally uncontrolled so drag/zoom does not snap back.
