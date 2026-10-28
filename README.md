# PADD 4755

A Star Trek LCARS-themed personal organizer: tasks, calendar, Captain's Log, a reference Library, and a Personnel roster, styled after the 24th-century Starfleet interface.

## Features

- **Tasks**: nested tasks and subtasks with drag-and-drop (hold Shift or toggle lock to nest), due dates, and a Task Dossier per task for protocol notes, assigned personnel, and images
- **Calendar**: monthly view of due tasks with quick links into each Dossier
- **Captain's Log**: searchable journal entries with image attachments
- **Library**: custom categories of reference entries (ships, planets, …) with images
- **Personnel**: crew roster that can be assigned to tasks
- **Stardates**: optional global toggle to show TNG-style Stardates instead of Earth dates
- **LCARS interface sounds** (toggle in Admin → Settings)

## Stack

React 19 + Vite, [Supabase](https://supabase.com) (auth, Postgres with row-level security, storage, realtime), deployed on Netlify.

## Getting started

```sh
npm install
cp .env.example .env   # then fill in your Supabase URL and anon key
npm run dev
```

### Supabase setup

1. Create a Supabase project and copy its URL and anon key into `.env`.
2. Create a public storage bucket named `task-images`.
3. In the SQL editor, run `supabase/migrations/0001_baseline.sql` (creates the tables, row-level security and storage policies; safe to re-run). Optionally run `supabase/verify_live.sql` afterwards to check the result.
   These are **not** applied automatically; re-run the relevant section whenever the files change.

To test the database rules locally, see `supabase/tests/run.sh` (`npm run test:db`, needs `psql` and a scratch Postgres database).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run unit tests (Vitest) |
| `npm run lint` | Lint with ESLint |
| `npm run build` | Production build |

## Project docs

- [PLAN.md](PLAN.md): what's done, in progress, and planned
- [CLAUDE.md](CLAUDE.md): architecture and conventions
