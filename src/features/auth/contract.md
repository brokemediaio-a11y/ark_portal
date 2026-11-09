# Portal access contract

All JSON responses use `{ok: true, ...}` or `{ok: false, error}`. Authentication errors are 401; permission, temporary-password and cross-origin write failures are 403. Responses containing account/document data are private and never cached.

- `POST /api/auth`: `{action: "login", email, password}` establishes an eight-hour HTTP-only session; generic login errors; durable email-based throttling. `{action: "logout"}` revokes the current session. `{action: "change-password", currentPassword, password}` changes the password and revokes all old sessions. `{action: "setup", name, email, password, setupKey}` creates the first administrator only when the server-configured setup key matches. No public registration.
- `GET /api/admin/users`: administrator only, returns safe user fields and recent account audit entries.
- `POST /api/admin/users`: administrator only, `{name,email,role}` creates an account and returns a generated temporary password once.
- `PATCH /api/admin/users`: administrator only, `{id,action:"update",name,email,role,active}` or `{id,action:"reset-password"}`. Role, status, and password changes revoke sessions. Admins cannot disable/demote themselves. The last active administrator cannot be removed. Passwords are never readable after creation/reset.
- `GET /api/documents/{kind}`: quotations/tickets visible to the current user. Employees see their own records; admins see team records.
- `PUT /api/documents/{kind}`: validated document body. Ownership assigned from session for creation and never from client input. Updating another user's record requires team permission. Flight-source quotations require flight-search permission on creation/source changes.
- `DELETE /api/documents/{kind}` with `{id}`: manager (own records) / admin, ownership checked, audit entry recorded.

All writes require a matching Origin header. Extraction and flight routes also require a current session and the relevant permission before any paid upstream call. UI hiding supplements these server checks.
