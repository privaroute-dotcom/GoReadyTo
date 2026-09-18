# GoReadyTo branding

The web app is branded as **GoReadyTo** and the public home remains the map-first discovery experience.

- Public home: `/` — map-first Jobs / Workers / Companies discovery
- Brand asset: `apps/web/public/goreadyto-logo.svg`
- Favicon and page title use GoReadyTo
- Role dashboards remain private after sign-in

Google Maps API key remains configured through `apps/web/.env` using `VITE_GOOGLE_MAPS_API_KEY`. Do not commit the secret key to source control.


## V6 — Map-first light design + Country Requirements
- The public home remains the GoReadyTo Global Map.
- Navigation is a compact hidden rail on desktop: hover the left edge or use the menu button to open it.
- The main GoReadyTo logo and tagline are placed in the lower home area so they do not compete with the map/search UI.
- Added a Country Requirements center with role-aware checklists for Worker, Employer and Agency.
- The legal layer is intentionally source-aware: production data must be connected to current official immigration, labour, tax/social-insurance, safety and privacy sources, with effective dates and jurisdiction.
- The UI does not present generic rules as universal legal advice.
