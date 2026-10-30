# Student Feedback Management System

A complete role-based college feedback application built with Node.js, Express, SQLite, Bootstrap, and Chart.js.

## Setup

Requires Node.js 18 or newer.

```bash
npm.cmd install
npm.cmd start
```

Open http://localhost:3000.

## Demo accounts

All demo passwords are `password123`.

| Role | Email |
|---|---|
| Admin | admin@college.edu |
| Faculty | ananya@college.edu |
| Student | aarav@college.edu |

Data is stored in `feedback.db`, which is created and seeded automatically on first start. For production, replace the JWT fallback secret with the `JWT_SECRET` environment variable, serve over HTTPS, and configure database backups.

Copy `.env.example` to `.env` and set a unique `JWT_SECRET` before deploying.
