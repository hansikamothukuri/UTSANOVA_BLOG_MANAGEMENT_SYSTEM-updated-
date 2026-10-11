# User management, permissions and scheduled publishing

## 1. Run the migrations manually, in order (nothing runs them for you)
1. Back up: `mysqldump -u <user> -p utsanova_blog > backup.sql`
2. Check it was not applied yet (expect 0 rows) with the query at the top of
   `database/migrations/004_add_permissions_and_scheduling.sql`.
3. `mysql -u <user> -p utsanova_blog < database/migrations/004_add_permissions_and_scheduling.sql`
4. Apply it BEFORE deploying the new code. Existing admins keep full blog access; existing blogs are untouched.
5. Then migration 005 (multi-owner; adds only `admins.is_owner`, nobody becomes an owner by running it):
   `mysql -u <user> -p utsanova_blog < database/migrations/005_add_multi_owner.sql`
Rollbacks (destructive, need your approval): `004_rollback_permissions_and_scheduling.sql`, `005_rollback_multi_owner.sql`
(roll back 005 before 004).

## 2. Environment variables (server / Vercel)
| Name | Purpose |
|---|---|
| `OWNER_FIREBASE_UID` | BOOTSTRAP owner(s): Firebase UID(s), comma separated. Always owners, no DB row needed, cannot be removed via the app. Email never grants ownership (`OWNER_EMAIL` is no longer used). |
| `CRON_SECRET` | Random string, 32+ chars (`openssl rand -hex 32`). If unset/short the cron endpoint answers 503. |
Existing `FIREBASE_ADMIN_*` credentials are required (user provisioning uses the Firebase Admin SDK).
Recommended: set `ADMIN_SELF_REGISTRATION=false` in production.

## 3. GitHub Secrets (Settings > Secrets and variables > Actions)
`CRON_SECRET` (same value as the deployment) and `APP_URL` (e.g. `https://your-site.example.com`).
Workflow: `.github/workflows/publish-scheduled-blogs.yml` (manual `workflow_dispatch`, dry-run default true).
The recurring `schedule:` block is commented out; uncomment it only after reviewing.

## 4. Local testing
```
node --import ./server/tests/helpers/register-stubs.mjs --test server/tests/permissions-scheduling.test.mjs
node --test client/tests/ist-time.test.mjs
curl -X POST localhost:3000/api/cron/publish-scheduled-blogs -H "Authorization: Bearer $CRON_SECRET" \
     -H "Content-Type: application/json" -d '{"dry_run": true}'
```
Local dev without MySQL uses the JSON fallback store; it is migrated automatically (dev only).

## 5. Behaviour summary
- Owners (any number): bootstrap owners from `OWNER_FIREBASE_UID` plus database owners (`admins.is_owner = 1`).
  Owners list/create/delete users, grant/revoke permissions and add/remove owner status (`/admin/users`).
  Ownership is re-read from the database on every request. The last owner cannot be demoted, disabled or deleted;
  an owner cannot disable/delete their own account; bootstrap owners are changeable only via server configuration.
- Legacy admins (rows that existed before the migration): keep full blog access, never manage users.
- Delegated users: exactly the BLOG_* codes saved in `admin_permissions`; a self-registered account has none.
- Cancelling a schedule returns the blog to Draft (content kept). Scheduling a Published blog returns 409.
- Email-based linking of admin rows now requires a Firebase-verified email.
