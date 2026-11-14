# Portal access contract

All JSON responses use `{ok: true, ...}` or `{ok: false, error}`. Authentication errors are 401; permission, temporary-password and cross-origin write failures are 403. Responses containing account/document data are private and never cached.

- `POST /api/auth`: `{action: "login", email, password}` establishes an eight-hour HTTP-only session; generic login errors; durable email-based throttling. `{action: "logout"}` revokes the current session. `{action: "change-password", currentPassword, password}` changes the password and revokes all old sessions. Public signup/setup is disabled. Client administrator and development super administrator accounts are initialized once from server-only password hashes and must replace their bootstrap passwords. `{action:"forgot-password",email}` returns the same generic acknowledgement for known/unknown accounts and queues one pending recovery request for a known account. Requests are durably throttled by email and client address.
- `GET /api/admin/users`: administrator only, returns safe user fields and recent account audit entries.
- `POST /api/admin/users`: administrator only, `{name,email,role,password}` creates an account with the administrator-chosen password. The user must replace this temporary password once before portal access. Later sign-ins do not prompt again. Passwords require 12–256 characters and are stored as salted scrypt hashes; passwords and hashes are never returned.
- `PATCH /api/admin/users`: administrator only, `{id,action:"update",name,email,role,active}` or `{id,action:"reset-password",password}`. Resets issue an administrator-chosen temporary password, revoke sessions, resolve pending recovery requests, clear failed-login counters, and require one password change on the next sign-in. Role, status, and password changes revoke sessions. Admins cannot disable/demote themselves. Normal administrators must keep an active administrator; super administrators can manage every other account. Passwords are never readable after creation/reset.
- `GET /api/documents/{kind}`: quotations/tickets visible to the current user. Employees see their own records; admins see team records.
- `PUT /api/documents/{kind}`: validated document body. Ownership assigned from session for creation and never from client input. Updating another user's record requires team permission. Flight-source quotations require flight-search permission on creation/source changes.
- `DELETE /api/documents/{kind}` with `{id}`: manager (own records) / admin, ownership checked, audit entry recorded.

All writes require a matching Origin header. Extraction and flight routes also require a current session and the relevant permission before any paid upstream call. UI hiding supplements these server checks.

Super administrators inherit all administrator permissions and additionally have `recovery` and `database` access. Normal administrators cannot create, promote to, modify, disable, delete, or reset a super administrator. Only super administrators can delete accounts; deletion removes owned documents/sessions and preserves audit history. The last active super administrator and an actor's own account cannot be deleted or demoted/disabled. A super administrator can reset their own password, which signs them out.

- `GET /api/admin/recovery`: super administrator only; recent recovery requests with account details.
- `PATCH /api/admin/recovery`: `{id,action:"dismiss"}` dismisses a pending request. Reset through `/api/admin/users` with `{id: userId,action:"reset-password",password}` after verifying the requester privately; it resolves all pending requests for that user. No email is sent automatically.
- `DELETE /api/admin/users`: super administrator only; `{id}` deletes an account and its documents.
- `GET /api/admin/database?table=users&offset=0`: super administrator only; table counts and paginated records from an allowlist, excluding password/session token hashes from previews.
- `POST /api/admin/database`: super administrator only; returns a consistent SQLite backup, including private authentication data. Backup access is audited.
- `/settings`: every signed-in user can change their own password with their current password; changing it clears the first-login flag permanently until another temporary password is issued.
