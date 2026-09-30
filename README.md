# CAMPUZ VOIZ

Your Voice. Our Campus. Better Tomorrow.

Campuz Voiz is a student feedback prototype with student, faculty, and administrator portals; confidential feedback; monthly pulses; and explainable, aggregate-based issue priority analytics.

## Run locally

Requirements: Node.js 20.19+ and npm. MongoDB is optional for local demos.

1. Install packages with `npm install`.
2. Copy `.env.example` to `.env` and set a unique `JWT_SECRET` and a strong `ADMIN_PASSWORD`. Leave `MONGODB_URI` empty to use the persistent local `.data/store.json` store, or set it to your MongoDB connection string.
3. Run `npm run dev` and open `http://localhost:5173`.

The API runs on port 3001. `npm run build` creates the production client bundle. To run the API alone, use `npm start`.

## Demo sign-ins

| Portal | ID | Password |
| --- | --- | --- |
| Student | `20247369` | `Sabari@1876` |
| Student | `20246379` | `Siva@1876` |
| Faculty | `20237369` | `Sri@1876` |
| Faculty | `20236379` | `Saravana@1876` |
| Administrator | `ADMIN_ID` from `.env` | `ADMIN_PASSWORD` from `.env` |

Demo credentials are for local presentation only. Seed account passwords are hashed with bcrypt before storage. The seeded student email values are `<student-id>@campuz.edu`.

## Prototype behavior

- Student reports validate department, year, and email against the authenticated profile. Submissions are kept internal to administrators; faculty report routes remove student names, IDs, and email addresses.
- Sentiment and priority are calculated from repeated question ratings and recognized comment topics, never from an individual rating alone. Thresholds and priority weights are configurable in `.env`.
- With MongoDB configured, Mongoose stores user and feedback documents. Without it, the demo uses a local JSON store under `.data/`.
- Monthly Pulses are stored as a distinct, combined 12-question survey and included in monthly analytics.
