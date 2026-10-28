# PADD Risk Register

Tracks every known security, privacy, legal and reliability risk. **Update this file in every PR that adds, changes or closes a risk**, and call out any new or still-open High risk in the PR description in bold.

Last reviewed: 2026-10-27 (initial register, from a read of the repo; the live Supabase and Netlify settings have not been inspected, so items marked *unverified* need your eyes on the dashboards).

Severity: **HIGH** = could expose user data or cause legal trouble; **MED** = real weakness, limited blast radius today; **LOW** = hygiene.

---

## **OPEN RISKS THAT NEED YOUR ATTENTION**

- **R1 (HIGH): Images are publicly readable.** The `task-images` bucket is public, so anyone with an image URL can view it, and URLs are stored in the database. *Plan: private bucket + signed URLs + a one-time migration (approved 2026-10-27).*
- **R2 (HIGH): No age gate, terms, reporting or moderation.** Fine for a single-user organizer. **Not acceptable before any public feed, friends feed or messaging ships.** Needs: age confirmation at signup (and handling for under-13s, e.g. COPPA in the US), terms/privacy acceptance, report/block tools, content-safety scanning for uploads, and a legal review of your obligations as a platform. *No social feature will be released before these land.*
- **R4 (HIGH, unverified): The live database may not match the repo.** RLS policies are in `supabase_rls_policies.sql`, but they are applied by hand, and `CREATE TABLE` statements for `tasks`, `notes` and `library_items` are not in the repo. The public anon key is only safe if RLS is airtight. *Plan: migrations folder + a verification query you can run (see below).*

## Register

| ID | Sev | Status | Risk | Mitigation / next step |
|----|-----|--------|------|------------------------|
| R1 | HIGH | Open, approved to fix | Public image bucket | Private bucket, store paths not URLs, signed URLs, migrate existing records |
| R2 | HIGH | Open, blocks social features | No age gate, ToS, moderation, reporting, upload scanning | Build before any public/friends feed or messaging; legal review |
| R4 | HIGH | Open, unverified | Live DB policies may drift from repo; schema missing | `supabase/migrations/`, verification query, periodic re-check |
| R5 | MED | Open | `task_personnel` INSERT policy checks the task's owner but not that `personnel_id` belongs to the same user. UUIDs are unguessable and reads are protected, so exploitation is hard today, but it becomes serious once cross-user linking exists | Add `personnel_id IN (SELECT id FROM personnel WHERE user_id = auth.uid())` to the policy, in the migrations PR |
| R6 | MED | Open, unverified | Open email/password signup using Supabase defaults: password strength, email confirmation, rate limiting and CAPTCHA settings not confirmed; no MFA | Check Auth settings; require a longer minimum; add MFA (TOTP) |
| R7 | MED | Open (CSP allows any https image until fixed) | Dragged-in images from other sites are saved as external URLs (or `data:` URLs). External URLs can track viewers and can disappear; they also bypass storage controls | Re-upload dropped images to our storage, or reject external URLs |
| R8 | MED | Open | Private documents are not end-to-end encrypted, so the database/storage operator (and anyone who compromises the project) could read them | Add client-side encryption (WebCrypto) for documents marked "vault"; accept that server-side search won't see their contents |
| R9 | MED | Open | No account deletion or data export, which privacy laws (GDPR/CCPA) expect before public launch | Build alongside R2; export is already on the Later list |
| R10 | MED | Open | No backups or recovery plan documented; free-tier Supabase has no point-in-time recovery | Confirm plan/backups; scheduled export |
| R11 | LOW | Open | No automated dependency scanning (no Dependabot/CodeQL); `npm audit` is clean today | Add `.github/dependabot.yml` and a CI workflow (lint, test, build) |
| R12 | LOW | Open | No audit log of sensitive actions (login, password change, sharing) | Add once sharing exists |
| R13 | LOW | Mitigated | `scripts/debug-db.cjs` writes to the live DB with the configured credentials | Header warning added 2026-10-22; consider deleting it |

## Verification query for R4 (run in the Supabase SQL editor)

Lists every table in `public` and whether RLS is on, plus how many policies it has. Any row with `rls_enabled = false` or `policies = 0` is a hole.

```sql
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
```

## Closed risks

| ID | Closed | What was done |
|----|--------|---------------|
| R3 | 2026-10-27 (PR: `feat/security-headers`; **confirm on the Netlify deploy preview**) | `netlify.toml` now sends a CSP (scripts same-origin only, connections limited to this site and `*.supabase.co`), `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, referrer policy, permissions policy and HSTS. Tested in headless Chromium against the production build: no violations, and an injected inline script was blocked. The Google Fonts stylesheet was replaced by a self-hosted font so the CSP needn't trust Google. |
| R14 | 2026-10-27 | `npm audit` flagged `zod` (high, memory exhaustion). It is only reachable through the ESLint plugin (dev tooling, never shipped to users). Fixed with `npm audit fix`; audit is at 0. |

Residual notes for R3: `style-src` still allows `'unsafe-inline'` (the components use inline style attributes), and `img-src` allows any `https:` image until R7 is fixed. A custom Supabase domain would need adding to `connect-src`.
