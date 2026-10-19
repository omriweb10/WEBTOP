# Supabase setup (account mode)

The app runs in one of two modes, chosen at build time:

| Mode | When | Data | Sign-in |
|---|---|---|---|
| **Local** | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` not set | This device only (localStorage) | None |
| **Account** | Both variables set | Supabase (Postgres, Auth, Storage, Edge Functions) | Students: personal access code. Admins: email + password at `#/admin` |

Everything below is needed only for account mode. No secret ever goes into the repository or
the frontend bundle. The anon (publishable) key is public by design; every request is
authorised in the database with Row Level Security and server-side functions.

## 1. Create the project

1. Create a project at <https://supabase.com/dashboard> (a region close to the users, e.g. Frankfurt).
2. Install the Supabase CLI, then link this repository to the project:

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```

## 2. Apply the database schema

```bash
npx supabase db push
```

This applies `supabase/migrations/*.sql` in order:

| Migration | Contents |
|---|---|
| `…120000_foundation` | Enums, `private` schema, period validation, default bell times |
| `…120100_accounts` | `admins`, `profiles`, `access_codes` (hashes only), `user_sessions` (one live session per code), login attempts |
| `…120200_schedules` | Subject presets (10 defaults with the spec colours), per-student preset access, templates, per-student timetables and lessons |
| `…120300_content` | Events/exams and notices (for everyone or for one student) |
| `…120400_session_auth` | `is_admin()`, `current_profile_id()`, the atomic login claim, rate limiting, code replacement |
| `…120500_rls` | RLS on every table, minimal grants, column-level protection of `code_hash`, `status` and `auth_user_id` |
| `…120600`–`…120800` | Lesson validation, student RPCs, admin RPCs and admin overview views |
| `…120900_storage` | Private `avatars` bucket (2 MB, JPEG/PNG/WebP) and its policies |

## 3. Auth settings (Dashboard → Authentication)

- **Sign In / Providers → Email**: keep the provider **enabled** (student sessions are minted
  through it, no e-mail is ever sent) and turn **off** "Allow new users to sign up".
  "Confirm email" may stay on: the server creates student users already confirmed.
- **Sessions**: leave **"Time-box user sessions"** and **"Inactivity timeout"** unset. Students
  stay signed in until they log out, an admin disconnects them, or the code/account is revoked.
- **JWT expiry** stays at **3600 s**; **refresh-token rotation** stays enabled (default) with
  a reuse interval of 10 s. Access tokens are short-lived; the session lives on through rotating
  refresh tokens.
- **Rate limits**: raise **"Token verifications"** (e.g. to 1000 per 5 minutes). Every student
  login verifies a one-time token from the Edge Function, so this limit is shared by all
  students. Code guessing is limited separately, per client IP, inside the database
  (10 wrong codes per 15 minutes per IP, plus a global ceiling).

`supabase/config.toml` holds the same values for the CLI and local development.

## 4. Secrets and Edge Functions

Generate a random pepper and store it as a function secret (never in the repository):

```bash
npx supabase secrets set ACCESS_CODE_PEPPER="$(openssl rand -base64 48)"
npx supabase functions deploy student-login
npx supabase functions deploy admin-access-code
```

- Access codes are stored as **HMAC-SHA-256(pepper, code)**. Changing the pepper invalidates
  every existing code (issue new ones afterwards).
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to
  functions automatically. The service-role key exists **only** there.
- Both functions run with `verify_jwt = false` (see `config.toml`): `student-login` is public
  (the code is the credential) and `admin-access-code` validates the admin's session itself.
- Optional: `STUDENT_EMAIL_DOMAIN` overrides the synthetic, undeliverable address domain used
  for students' Auth users (default `students.webtop.invalid`), should the project reject it.

## 5. Create the first administrator

1. **Dashboard → Authentication → Users → Add user**: an e-mail and a strong password,
   "Auto Confirm User" on.
2. **SQL Editor**:

   ```sql
   select private.grant_admin('admin@example.com');
   ```

Admins sign in at `https://<user>.github.io/WEBTOP/#/admin`. Student access codes never work
there, and the hidden 7-tap edit code never grants admin access.

## 6. Build and deploy the site

In GitHub: **Settings → Secrets and variables → Actions → Variables**, add:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the project's **anon / publishable** key (never `service_role`) |

The workflow builds the Pages site with these values on pushes to `main`. Without them it
deploys the local-only app.

## How sign-in and sessions work

1. The admin creates a student and issues a code (generated — 12 characters from an
   unambiguous alphabet — or custom, with strength warnings and an explicit opt-in for weak
   codes). The code is shown **once**; only its HMAC is stored.
2. The student enters the code. `student-login` normalises it, hashes it, and calls
   `svc_claim_student_session`, which locks the code row and inserts a session. A partial
   unique index (`one live session per code`) makes a second concurrent claim fail, so of any
   number of simultaneous logins exactly one succeeds; the others get `409 code_in_use`.
3. The function mints a real Supabase Auth session for the student's Auth user and links it to
   the claim. From then on, `current_profile_id()` accepts a request only if the JWT's
   `session_id` is that code's single active session, and the code and account are active.
4. A second device is **rejected** while the first is signed in; the first is never kicked out.
   The code frees up only when the student logs out, an admin uses **Force Disconnect**, or the
   code/account is revoked, replaced, disabled or deleted. Inactivity, missed heartbeats or a
   closed browser never release it.
5. Ending a session also deletes its Auth session, so its refresh tokens stop working at once.
   The app checks with the server at start-up and regularly afterwards, so a disconnected device
   returns to the login screen the next time it is used.

### Persistence caveat

The session is stored in the browser's storage for the site and renewed with rotating refresh
tokens, so it survives closing the app, restarting the phone and long inactivity. It cannot be
guaranteed absolutely: if iOS or the user clears the site's data (e.g. "Clear History and
Website Data", removing the Home Screen app, or storage eviction), the device forgets the
session while the server still holds the code. The student then sees "already connected on
another device" and an admin must use **Force Disconnect** (Sessions dashboard) first. A Home
Screen app on iOS has storage separate from Safari, so it signs in on its own.

## Local development and tests (no Supabase account needed)

`npm run stack` starts a local Supabase-equivalent stack: PostgreSQL 16, the official Supabase
Auth (GoTrue) and PostgREST binaries, the Edge Functions in Deno, and a small gateway that
mimics the Supabase URL layout plus a test-only Storage emulator. Secrets are random per run and
written to the git-ignored `.local-stack/env.json` (including the test admin's credentials).

```bash
npm run stack                 # foreground; wait for "ready at http://127.0.0.1:54321"
npm run test:backend          # RLS, isolation, single-session rule, codes, admin RPCs
npm run test:e2e:account      # Playwright: admin panel + students against the stack

# Run the app against the stack:
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_ANON_KEY="$(node -p "require('./.local-stack/env.json').anonKey")" \
npm run dev
```

Requirements: PostgreSQL 16 server binaries (`/usr/lib/postgresql/<v>/bin`, or set `PG_BIN`),
`curl` and `tar`. Supabase Auth and PostgREST are downloaded on first run into `.local-stack/bin`.

## Troubleshooting

- **`supabase db push` fails on `auth.*`**: the migrations reference `auth.users` (foreign keys)
  and, inside `security definer` functions, delete rows from `auth.sessions`/`auth.users` to end
  sessions and delete students. These work with the standard project roles; if a project has
  customised them, run the failing migration from the SQL Editor as `postgres`.
- **Students get "השרת אינו זמין"**: check the function logs (Dashboard → Edge Functions) for a
  missing `ACCESS_CODE_PEPPER`, a disabled Email provider, or the token-verification rate limit.
- **"החשבון הזה אינו מוגדר כמנהל"**: run `select private.grant_admin('<email>');` for that user.
