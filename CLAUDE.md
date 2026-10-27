# CLAUDE.md

PADD is a Star Trek LCARS-themed personal organizer: tasks (nested, drag-and-drop), calendar, Captain's Log, a Library of reference entries, and a Personnel roster. React 19 + Vite, backed by Supabase (auth, Postgres, Storage), deployed on Netlify.

## Tracking work

**`PLAN.md` is the tracker.** Read it at the start of a session. After every fix or feature, update it: check the item off with the date, move finished work to **Done**, and add anything new you discover to **Next** or **Later**.

**`RISKS.md` is the risk register.** Update it in any PR that adds, changes or closes a security/privacy/legal risk, and call out open High risks in bold in the PR description.

## Commands

- `npm run dev`: Vite dev server
- `npm test`: Vitest unit tests (run with `TZ=America/Los_Angeles` so DST edge cases are exercised); `npm run test:watch` for watch mode
- `npm run lint`: ESLint (keep at 0 errors / 0 warnings)
- `npm run build`: production build
- `npm run chat`: `scripts/chat-local.js` helper

Tests live next to the code. Pure helpers (`src/utils/`, `src/lib/storage.js`) are `*.test.js` and run in Node. Component tests are `*.test.jsx`, start with `// @vitest-environment jsdom`, and use Testing Library; mock `../lib/supabase` with `createFakeSupabase` from `src/test/fakeSupabase.js` and mock `../hooks/useLCARSSound` (the real hook needs a provider). Current coverage: TaskDossier autosave/images and Library edit/cancel/save/delete. Verify with tests + lint + build, and run the app for UI changes.

**Build gotcha:** without Supabase env vars, `supabase` is `null` and Vite tree-shakes nearly the whole app away, so `npm run build` "passes" without compiling most code. To verify a real build, pass placeholders:
`VITE_SUPABASE_URL=https://placeholder.supabase.co VITE_SUPABASE_ANON_KEY=placeholder npx vite build --outDir <tmp dir>` (expect a ~470 KB JS bundle, not ~200 KB).

## Environment

Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Without them the app shows a "CONFIGURATION REQUIRED" screen.

## Layout

- `src/App.jsx`: session handling, tab routing (no router), and all task CRUD + realtime subscription. Tasks are fetched flat and built into a tree (`parent_id` → `subtasks`).
- `src/features/`: one component (+ CSS) per tab: `Tasks`/`TaskItem`/`TaskDossier`, `Calendar`, `Log`, `Library`, `Admin` (→ `admin/PersonnelManager`, `Security`, `Settings`), `Auth`.
- `src/components/`: LCARS primitives (`LCARSLayout`, `LCARSButton`, `LCARSDatePicker`).
- `src/contexts/`: providers in `*Context.jsx`; the context object + hook live in `*ContextValue.js` (keeps Fast Refresh happy). `useSettings()` → `isStardateEnabled`; `useSoundSettings()` → sound toggle.
- `src/lib/supabase.js`: client (null when env vars are missing). `src/lib/storage.js`: **all image uploads go through `uploadImage(file, folder)`**, and removed images are deleted with `removeImagesByUrl(urls)` (only after the record no longer references them; it alerts on failure).
- `src/utils/dateUtils.js`: date conversions. Store UTC ISO (`formatDateForStorage`), edit as local `YYYY-MM-DDTHH:mm` (`formatDateForInput`), display with `formatDateForDisplay` / `formatLogDate` (Stardate-aware).
- SQL lives in `supabase/`: `migrations/NNNN_*.sql` (numbered, idempotent; `0001_baseline.sql` is the full schema, RLS and storage policies), `verify_live.sql` (read-only snapshot of the live DB to compare with the repo), `reports/orphaned_images.sql` (read-only report of unreferenced storage files), and `tests/` (RLS tests that run on a scratch Postgres with `npm run test:db`, see `tests/run.sh`; never against the live project). Migrations are applied **manually** in the Supabase SQL editor; code changes don't apply them. Any new table or policy goes in a new migration and gets a test in `tests/rls_test.sql`.

## Conventions

- **Security**: every table has RLS scoped to `auth.uid() = user_id`; always set `user_id` on insert. Storage paths must start with the user's ID (`uploadImage` handles this); storage RLS enforces it.
- Feature components fetch their own data from Supabase, except tasks, which are owned by `App.jsx` and passed down.
- Declare fetch helpers (wrapped in `useCallback` when used in effects) **before** the effects that call them; the React Hooks lint rules flag the reverse.
- Styling is plain CSS per component using LCARS color variables (`--lcars-orange`, `--lcars-teal`, …) from `src/index.css`. UI text is UPPERCASE LCARS style.
- **Never call `alert()` / `confirm()`.** Use `notify(message, { type: 'error' | 'success' | 'info', title })` and `await confirmAction(message, { title, confirmLabel, danger })` from `src/lib/notify.js`; `NotificationHost` (mounted in `main.jsx`) renders them. With no host mounted (unit tests) they fall back to the native dialogs. Use `danger: true` for destructive confirmations.
- Dates displayed to the user should respect the Stardate setting.
- Match the surrounding file's formatting (older files use 4-space indents, newer ones 2-space/Prettier style).
