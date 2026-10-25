# PADD App Plan

Single source of truth for what's done, what's next, and what we'd like to build.
**Update this file after every fix or feature** (move items to Done with the date).

## 🔧 Now — Fixes in progress

Branch: `fix/security-and-cleanup`

- [x] **Storage ownership**: uploads go to `<user_id>/<folder>/...` via `src/lib/storage.js`; storage RLS scoped to owner (`supabase_rls_policies.sql`). _2026-10-22_
  - [x] **Ran the storage section of `supabase_rls_policies.sql` in the Supabase SQL editor.** Also dropped two dashboard-created bucket-wide policies (`Allow authenticated uploads`, `Allow authenticated update/delete`) that bypassed per-user RLS; `pg_policies` now lists only the four `Users can … own images` policies. _2026-10-23, PR #7_
  - [x] Smoke-test upload + delete on the live site as a normal user. _2026-10-23_
- [x] **Dossier autosave**: debounced (700 ms) and flushed on close. _2026-10-22_
- [x] **npm audit**: 0 vulnerabilities. _2026-10-22_
- [x] **Lint**: 0 errors / 0 warnings. Also fixed along the way: Library category fetch race, Calendar month navigation, date picker month-overflow on the 31st, realtime subscription filtered to current user. _2026-10-22_

## 📋 Next — Known issues & cleanup

- [x] **Delete image files when they're removed** (previously only Library did). _2026-10-24, branch `fix/storage-image-cleanup`_
  - [x] Tasks: removed images deleted after autosave succeeds; deleting a task deletes its and its subtasks' images; uploads finishing after the dossier closes are discarded
  - [x] Captain's Log: removed images deleted on save, uploads discarded on cancel, entry delete removes its images
  - [x] Personnel: replaced photo deleted on save, unsaved uploads discarded on cancel, record delete removes the photo
  - [x] `removeImagesByUrl` alerts when storage skips files (RLS) or fails
  - [x] `supabase_orphaned_images.sql`: lists unreferenced files (SQL can't delete storage objects; delete via dashboard)
  - [x] Tasks: `parent_id` FK had no `ON DELETE CASCADE`, so deleting a parent task failed (silently). Added `supabase_schema_tasks.sql`; delete failures now alert. _2026-10-25_
  - [ ] Run `supabase_schema_tasks.sql` in the Supabase SQL editor
  - [x] Log + Library: removing an image uploaded during the current edit now deletes it immediately (before, it waited for save/cancel). Saved images still wait for save so cancel can restore them. _2026-10-25_
  - [ ] Run the orphan report once to clear out pre-fix leftovers
  - [ ] Optional: Admin button that deletes the current user's orphans via an RPC + Storage API
- [ ] **Decide: public vs private images.** `task-images` bucket is public; anyone with a URL can view. Option: private bucket + `createSignedUrl` (requires storing paths instead of URLs).
- [ ] **Schema in repo**: no SQL for `tasks`, `notes`, `library_items`. Consolidate into `supabase/migrations/`. `supabase_schema_personnel.sql` and `supabase_rls_policies.sql` overlap on `task_personnel` policies.
- [x] **Stardate integration**: all displayed dates go through `formatDateForDisplay(value, useStardateEnabled())`. _2026-10-22, branch `feat/stardate-integration`_
  - [x] Captain's Log
  - [x] Tasks header (removed the double date parse)
  - [x] Task items / subtasks / new-task picker (via `LCARSDatePicker` label)
  - [x] Task Dossier (new DUE line in header)
  - [x] Calendar month header + day detail header (no longer mislabelled "STARDATE")
  - [ ] Optional: date picker popup month title and Calendar task times still use Earth format
- [ ] **Subtask dates**: marked "needs regression fix" previously; verify.
- [ ] **Replace `alert()` / `confirm()`** (~12 call sites) with an LCARS toast/dialog component.
- [x] **Tests**: Vitest added; 20 tests for `stardate.js`, `dateUtils.js`, `storage.js`. Found and fixed a DST bug: the first hour after midnight showed the previous day's Stardate. _2026-10-22, branch `chore/tests-and-housekeeping`_
- [ ] **Component tests**: none yet (Testing Library + jsdom) — start with Dossier autosave and Library edit/cancel flows.
- [ ] **Stardate accuracy** (optional): current formula isn't TNG-canon (2364 ≈ 41000).
- [ ] **Accessibility**: labels on icon buttons, keyboard support for date picker / dossier.
- [x] **Housekeeping**: real README; `debug_db.cjs` → `scripts/debug-db.cjs` with a warning header; removed dead `RootDroppable`, no-op drag handlers, and hidden "HOLD SHIFT TO NEST" label in `Tasks.jsx`. _2026-10-22_
- [ ] **Demo task seeding**: `INITIAL_TASKS` subtasks are never created (only top-level tasks are seeded).
- [ ] **Task Indicators**: marked "pending refinement" previously.
- [x] **PR #3 review follow-ups** _2026-10-22, branch `fix/review-followups`_
  - [x] Library image removal staged until save; uploads discarded on cancel; record delete removes its images
  - [x] Task writes from this tab skip their realtime echo (one refetch instead of two); remote bursts coalesced
  - [x] Realtime DELETE ignores tasks not in the local list
  - [x] Library loads categories first, then items once for the resolved category

## 🚀 Later — Features we hope to build

Roughly ordered by value for effort.

1. [ ] **Home Dashboard**: overdue / due today, latest log, active personnel. Candidate default landing tab.
2. [ ] **Global "Computer" search** (Ctrl+K) across Tasks, Personnel, Logs, Library. Pairs with **keyboard shortcuts** (Ctrl+N, Ctrl+L) + LCARS audio.
3. [ ] **"Red Alert" mode**: critical tasks flash LCARS borders red + klaxon.
4. [ ] **Tags & filtering** (#engineering, #diplomacy).
5. [ ] **Markdown / rich text** in Logs and Dossiers.
6. [ ] **Duty Roster / Status** for Personnel (On Duty, Away Mission, shifts).
7. [ ] **Reminders**: browser/email alerts for due dates.
8. [ ] **Data export**: Logs / Tasks to PDF or JSON.
9. [ ] **Voice commands**: Web Speech API dictation for Logs and Tasks.
10. [ ] **Offline mode (PWA)** with background sync.
11. [ ] **Real-time collaboration** across crew members.

## ✅ Done

### 2026-04 — Stardate groundwork
- Global `SettingsContext` + Settings panel toggle (persisted to localStorage).
- `stardate.js` converter; Stardate shown in Captain's Log.
- `formatLogDate` centralized in `dateUtils.js`.

### 2026-02 and earlier
- **Supabase migration**: email/password auth; Tasks, Notes (Captain's Log), Library, Personnel in Postgres; images in Storage (`task-images`).
- **Security**: RLS on all public tables; Security tab for password changes.
- **Tasks**: drag-and-drop reorder; Shift (or lock toggle) to nest; nesting visual feedback; due dates with UTC/local handling; interactive indicator pills linking to Dossier tabs; LCARS tooltips.
- **Captain's Log**: chronological feed, auto-save, search, image attachments, header layout.
- **Library**: Supabase-backed, add entries, dynamic categories, image upload.
- **Personnel**: manager with LCARS file-folder frame, alphabetical sort, demo data seeding.
- **UI**: LCARS layout + dynamic colors, static sidebar geometry, TNG palette, custom `LCARSDatePicker` with ENGAGE button, interface sounds, touch-friendly drag tolerances, "USS CERRITOS" elbow.
