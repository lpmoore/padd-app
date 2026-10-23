# CLAUDE.md

PADD is a Star Trek LCARS-themed personal organizer: tasks (nested, drag-and-drop), calendar, Captain's Log, a Library of reference entries, and a Personnel roster. React 19 + Vite, backed by Supabase (auth, Postgres, Storage), deployed on Netlify.

## Tracking work

**`PLAN.md` is the tracker.** Read it at the start of a session. After every fix or feature, update it: check the item off with the date, move finished work to **Done**, and add anything new you discover to **Next** or **Later**.

## Commands

- `npm run dev`: Vite dev server
- `npm run lint`: ESLint (keep at 0 errors / 0 warnings)
- `npm run build`: production build
- `npm run chat`: `scripts/chat-local.js` helper

There are no tests yet (see PLAN.md). Verify with lint + build, and run the app for UI changes.

## Environment

Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Without them the app shows a "CONFIGURATION REQUIRED" screen.

## Layout

- `src/App.jsx`: session handling, tab routing (no router), and all task CRUD + realtime subscription. Tasks are fetched flat and built into a tree (`parent_id` → `subtasks`).
- `src/features/`: one component (+ CSS) per tab: `Tasks`/`TaskItem`/`TaskDossier`, `Calendar`, `Log`, `Library`, `Admin` (→ `admin/PersonnelManager`, `Security`, `Settings`), `Auth`.
- `src/components/`: LCARS primitives (`LCARSLayout`, `LCARSButton`, `LCARSDatePicker`).
- `src/contexts/`: providers in `*Context.jsx`; the context object + hook live in `*ContextValue.js` (keeps Fast Refresh happy). `useSettings()` → `isStardateEnabled`; `useSoundSettings()` → sound toggle.
- `src/lib/supabase.js`: client (null when env vars are missing). `src/lib/storage.js`: **all image uploads go through `uploadImage(file, folder)`**.
- `src/utils/dateUtils.js`: date conversions. Store UTC ISO (`formatDateForStorage`), edit as local `YYYY-MM-DDTHH:mm` (`formatDateForInput`), display with `formatDateForDisplay` / `formatLogDate` (Stardate-aware).
- SQL: `supabase_rls_policies.sql`, `supabase_schema_personnel.sql`. These are applied manually in the Supabase SQL editor; code changes don't apply them.

## Conventions

- **Security**: every table has RLS scoped to `auth.uid() = user_id`; always set `user_id` on insert. Storage paths must start with the user's ID (`uploadImage` handles this); storage RLS enforces it.
- Feature components fetch their own data from Supabase, except tasks, which are owned by `App.jsx` and passed down.
- Declare fetch helpers (wrapped in `useCallback` when used in effects) **before** the effects that call them; the React Hooks lint rules flag the reverse.
- Styling is plain CSS per component using LCARS color variables (`--lcars-orange`, `--lcars-teal`, …) from `src/index.css`. UI text is UPPERCASE LCARS style.
- Dates displayed to the user should respect the Stardate setting.
- Match the surrounding file's formatting (older files use 4-space indents, newer ones 2-space/Prettier style).
