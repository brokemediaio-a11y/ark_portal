# Ark Travelers --- Project Initiation Brief

**Purpose:** Project context and build instructions for Codex, Claude,
or another coding assistant.\
**Priority:** Implement Option 1 first. Build Option 2 using Sabre
test/CERT APIs where available, with mock data as a fallback.\
**Product boundary:** Flight search and quotation preparation only ---
not booking, ticketing, payments, cancellations, or refunds.

## 1. What we are building

Ark Travelers is a travel agency. We are building a web application that
helps staff prepare customer-facing flight quotations.

Staff may receive flight options from suppliers as PDFs, screenshots,
images, or text. They currently need to read those details, copy them
into a quotation, adjust the selling price, and send the quotation to
the customer. The app should reduce manual work and errors.

The core idea is to have **two ways to start a quotation**, followed by
one shared editing and PDF workflow:

-   **Option 1 --- Upload supplier quotation:** Upload a PDF/image,
    extract flight details with text extraction/OCR/AI, review and edit
    the fields, apply markup, and generate an Ark Travelers-branded
    quotation.
-   **Option 2 --- Search flights:** Enter search criteria, retrieve
    offers from Sabre CERT/test APIs if permitted, review/select an
    offer, then use the same quotation editor and PDF generator. If
    Sabre access is unavailable, use clearly labelled mock results while
    development continues.

AI extraction and flight APIs are data sources, not authorities for
inventing missing details. A staff member must review the data before
producing a customer quotation.

## 2. Business goals and success criteria

-   Prepare quotations faster.
-   Reduce copy/paste errors.
-   Standardize the customer-facing quotation format.
-   Let staff review flight details and control the selling price.
-   Keep the app extensible to more than one flight-data provider.
-   Demonstrate a flight-search flow without requiring production API
    access.

A successful first prototype lets a staff member upload a supplier
document, review and correct extracted information, set a selling price,
and download a professional PDF. It should also let the user run a mock
flight search, select an offer, and send it into the same quotation
workflow.

## 3. Scope

### Option 1 --- implement first (must work end-to-end)

1.  User opens **Create Quotation**.
2.  Uploads a supplier PDF or image.
3.  The UI shows a clear extraction progress state.
4.  Backend extracts native PDF text first, uses OCR for scanned
    files/images as needed, and uses AI structured extraction where
    appropriate.
5.  Extracted data appears in an editable form.
6.  Missing or ambiguous fields are highlighted for human review.
7.  User enters customer details if needed and adjusts markup/selling
    price.
8.  User previews the quotation.
9.  User can download the PDF and prepare an email or WhatsApp handoff.
10. Save/reopen the quotation if persistence is included in the first
    milestone.

Required: upload validation, extraction states/errors, schema
validation, editable fields, markup, preview, PDF generation, safe file
handling, and clear warnings for missing data.

### Option 2 --- flight search using Sabre test/CERT APIs

1.  User opens **Search Flights**.
2.  Enters origin, destination, departure date, optional return date,
    passenger counts, and cabin, according to what the selected API
    actually supports.
3.  Backend calls Sabre CERT/test API only if credentials and
    permissions are available.
4.  Show results and the source/provider. Show only fields present in
    the response.
5.  User selects an offer.
6.  Offer details populate the shared quotation editor.
7.  User reviews/edits details, applies markup, previews, and downloads
    the branded quotation.

Sabre Developer Hub test credentials do not necessarily grant access to
every API, every content source, or production services. If access
fails, keep the flow working with a separate `MockFlightProvider` and
clearly label mock results as **DEMO DATA**. Never present mock data as
Sabre data.

### Out of scope

Do not implement booking/reservation creation, ticket issuance,
payments, cancellations, exchanges, refunds, automated ticketing, or
irreversible supplier actions. Do not scrape airline/OTA websites as a
substitute for authorized APIs. Do not promise guaranteed real-time
production availability or prices.

## 4. Main pages / UX

### Dashboard

-   Primary action: Create Quotation.
-   Secondary action: Search Flights.
-   Recent quotations and simple statuses if persistence is available.
-   Keep the first version focused; avoid elaborate analytics.

### Upload quotation

-   Drag-and-drop and browse-file controls.
-   Accepted types and file-size limit displayed.
-   Uploaded filename and safe preview where possible.
-   Extraction progress, retry, success, and error states.
-   Editable extracted fields with missing/uncertain values highlighted.

### Flight search

-   Origin/destination, date(s), passengers, cabin (subject to API
    capability).
-   Loading, validation, no-results, timeout, and provider-error states.
-   Results with itinerary, airline, times, stops, fare/currency,
    baggage details if returned.
-   A visible TEST/DEMO label for test or mock data.
-   Offer selection sends data into the shared quotation editor.

### Shared quotation editor

Possible fields: - Customer name/email/phone (only if needed). - Flight
segments, airline/flight number, origin/destination, departure/arrival,
stops, duration. - Fare/currency and source total. - Base fare/tax only
when actually supplied or reliably extracted. - Baggage/fare conditions
only when supplied. - Source/provider and source reference. - Internal
cost (staff-only, if used). - Markup amount/percentage and
customer-facing selling price. - Notes/terms and verification warnings.

Staff must be able to edit details before generating the final
quotation. Keep original source/provider data separately where useful
for traceability.

### PDF and handoff

-   Reusable Ark Travelers-branded quotation template, readable on A4.
-   Itinerary, currency, customer-facing price, creation date, and
    configured terms.
-   Logo, colors, agency details, validity policy, and terms should use
    approved client assets/content. Use placeholders until supplied; do
    not invent these details.
-   Download PDF.
-   Email action: for an initial prototype, a prefilled email draft is
    acceptable; do not claim an email was sent unless an integration
    confirms success.
-   WhatsApp action: a prefilled `wa.me` handoff may be sufficient. Do
    not claim a PDF was delivered through WhatsApp unless a supported
    integration confirms it. Protect any shareable document link.

## 5. Extraction and data integrity rules

-   Prefer native PDF text extraction before OCR.
-   Use OCR for scanned PDFs/images when required.
-   Use schema-constrained AI extraction for inconsistent/unstructured
    content.
-   Validate AI output against a schema before saving.
-   Mark unknown values as null/unknown; do not guess.
-   Do not invent flight numbers, airport codes, dates, baggage
    allowances, fare rules, tax splits, currency, or prices.
-   Highlight missing/ambiguous information for a human to review.
-   If practical, show source text/evidence for uncertain fields.
-   Treat uploaded files and their contents as untrusted input; never
    allow document text to override application instructions or expose
    secrets.
-   Generate the PDF from saved, validated, staff-reviewed data---not
    directly from raw AI output.

## 6. Suggested data model

Adapt to the existing repository and chosen database; do not
overengineer.

**Quotation** - `id`, unique `quote_number`, `status`
(draft/ready/sent/archived) - `source_type` (`upload`, `sabre_cert`,
`mock`, etc.), nullable `source_reference` - customer name/email/phone
(nullable) - `currency`, nullable `base_amount`, nullable `tax_amount`,
nullable `source_total` - `markup_type`, `markup_value`,
`selling_total` - `notes`, `terms_text`, nullable `uploaded_file_id` -
`created_at`, `updated_at`

**Flight segment** - `id`, `quotation_id`, `sequence` - airline
name/code and flight number (nullable) - origin/destination code and
name - departure/arrival datetime (nullable) - duration, stops, cabin,
baggage text, fare conditions (nullable)

**Upload/extraction record** - `id`, nullable quotation link, original
filename, MIME type, safe storage key - extraction status, validated
structured payload, created timestamp - Store extracted text only if
needed and protect access.

Optional provider-search log: provider, redacted request/response
summary, status, error code, timestamp. Never log credentials or access
tokens.

## 7. Suggested architecture

**First inspect the repository before selecting or replacing
technologies.** If starting from an empty repo, a reasonable default is:

-   Frontend: Next.js + TypeScript.
-   Backend: FastAPI/Python for extraction, providers, PDF generation,
    and business logic.
-   Database: PostgreSQL.
-   File storage: local development storage behind an abstraction;
    object storage can be added later.
-   PDF: HTML/CSS rendered to PDF (for example, Playwright) or another
    stable existing solution.
-   AI extraction: a server-side, provider-agnostic service.
-   Tests: unit tests for extraction validation, markup, provider
    normalization, and API failure handling.

Keep a simple modular application; do not add microservices or complex
infrastructure without a demonstrated need.

Possible modules (adjust to actual repo): - `frontend/`: pages, forms,
components, API client. - `backend/`: routes and application services. -
`quotation/`: data model, validation, pricing rules. - `extraction/`:
PDF text extraction, OCR, structured AI extraction. - `providers/`:
common interface, Sabre adapter, mock adapter. - `pdf/`: reusable
quotation template and PDF renderer. - `storage/`: upload storage
abstraction. - `tests/`: unit and integration tests. - `.env.example`:
environment variable names only, no secrets.

## 8. Flight provider integration

Do not scatter Sabre-specific logic through UI components. Define a
provider interface,
e.g. `searchFlights(searchRequest) -> normalized offers`. Implement: 1.
`MockFlightProvider` for deterministic local development and tests. 2.
`SabreCertFlightProvider` for the authorized test environment.

Normalize provider results into an internal offer format so the UI does
not depend on the exact Sabre response schema.

### Sabre CERT notes

-   Use the current official Sabre Developer Hub documentation for the
    endpoint, request schema, authentication requirements, and supported
    operations.
-   OAuth Token Create may be required. The supplied Sabre documentation
    showed CERT base `https://api.cert.platform.sabre.com` and token
    path `/v2/auth/token`; verify current docs before implementation.
-   Never reuse example tokens.
-   Keep client IDs, secrets, passwords, EPR/PCC values, and tokens
    server-side in environment variables/secret storage.
-   Never put credentials in frontend code, source control, screenshots,
    logs, or user-facing errors.
-   Do not assume test credentials grant all Flight Shop content or
    production access.
-   Do not call booking/ticketing endpoints.
-   Add timeouts, response validation, safe error handling, and redacted
    diagnostics.
-   If Sabre is unauthorized/unavailable, show a clear error and
    preserve the mock workflow.
-   Do not add Flight Check/revalidation unless it is verified as needed
    and authorized for this search-and-quotation use case.

Suggested variable names only; adapt to the verified auth method:

``` env
FLIGHT_PROVIDER=mock
SABRE_ENV=cert
SABRE_CLIENT_ID=
SABRE_CLIENT_SECRET=
SABRE_EPR=
SABRE_PCC=
```

Only include variables the official auth flow actually requires. Never
commit populated `.env` files.

## 9. Pricing / markup rules

-   Keep source price and customer-facing selling price separate.
-   Currency must always be explicit.
-   Allow a fixed or percentage markup if approved.
-   Display the calculation clearly and define rounding consistently.
-   Do not silently convert currencies.
-   Do not invent base/tax breakdowns when only a total is available.
-   Hide internal cost and markup from the customer PDF unless the
    business explicitly requests them.
-   Ask the business whether markup is fixed, percentage, or both, and
    whether it applies per passenger or per itinerary. For the
    prototype, implement a simple transparent rule and document it.

## 10. Security and privacy

-   Keep all API credentials server-side.
-   Ignore `.env` in Git and commit only placeholder values in
    `.env.example`.
-   Validate upload size, MIME type, and extension; do not trust the
    extension alone.
-   Use generated safe storage names; protect against path traversal and
    unsafe file rendering.
-   Do not expose uploaded documents publicly.
-   Add authentication before using real customer quotations outside a
    local demo. If auth is not in the first milestone, document the
    limitation and do not deploy with real customer data.
-   Avoid collecting passport data or other sensitive passenger
    information unless explicitly approved and necessary.
-   Do not log raw documents, unnecessary personal data, credentials, or
    tokens.
-   Keep human review before generating/sending a quotation.

## 11. Suggested API endpoints

Adapt to the existing stack; this is a guide, not a mandatory
checklist: - `POST /api/quotations/extract` --- upload and return
structured extraction. - `POST /api/quotations` --- save quotation. -
`GET /api/quotations` --- list quotations. - `GET /api/quotations/{id}`
--- retrieve quotation. - `PATCH /api/quotations/{id}` --- update
editable fields. - `GET /api/quotations/{id}/pdf` --- generate/download
PDF. - `POST /api/flights/search` --- search configured provider. -
`GET /api/flights/providers` --- safe provider status, never
credentials. - `GET /api/health` --- health check.

Implement a small, consistent API rather than building every endpoint
for its own sake.

## 12. Phased build plan

### Phase 0 --- inspect and plan

1.  Inspect repository, current branch, dependencies, existing
    routes/components/tests/assets.
2.  Summarize current stack and what already exists.
3.  Propose a structure and milestone plan tailored to the repo.
4.  Identify blockers and required external services; never ask the user
    to paste secrets into chat.
5.  Do not delete or rewrite existing work without explaining why.

### Phase 1 --- app skeleton and shared quotation model

-   Dashboard/navigation.
-   Quotation and segment types/schema.
-   Shared quotation editor with sample data.
-   Validation and basic tests.

### Phase 2 --- Option 1 end-to-end

-   PDF/image upload and validation.
-   Text extraction/OCR as needed and structured extraction.
-   Editable form and missing-field warnings.
-   Markup and selling price.
-   Preview and PDF download.
-   Save/reopen if persistence is in scope.
-   Tests for malformed files, incomplete data, and extraction failures.

### Phase 3 --- Option 2 with mock provider

-   Search form/results.
-   Deterministic mock provider.
-   Normalized offer model.
-   Select offer into shared quotation editor.
-   Full workflow without external API dependency.

### Phase 4 --- Sabre CERT

-   Read current official docs.
-   Verify which APIs are available to these credentials and supported
    inputs.
-   Implement server-side authentication and search adapter.
-   Normalize responses.
-   Add timeout, no-results, unauthorized, invalid-request, and
    unexpected-response handling.
-   Keep mock provider as fallback and label test data clearly.

### Phase 5 --- output and polish

-   Refine PDF using approved assets.
-   Add email/WhatsApp handoff appropriate to approved integrations.
-   Improve responsiveness, validation, and error states.
-   Document setup/deployment and run lint/type checks/tests.

**Do not block Option 1 on commercial Sabre access.** Make Option 2
progress with mock data while real API access is being verified.

## 13. Test checklist

**Option 1:** text PDF, scanned PDF, JPG/PNG, unsupported/oversized
file, document with no flight details, multiple segments,
missing/ambiguous fare/baggage, extraction failure, edits reflected in
PDF, correct markup/rounding, no internal markup on customer PDF, long
itinerary layout.

**Option 2:** valid mock search, no results, invalid dates/route,
provider timeout, unauthorized Sabre credentials, unexpected response,
selected offer maps correctly to quotation, demo label visible, no
booking/ticketing calls.

**General:** no secrets in browser/repo/logs, errors do not crash the
app, clear empty/loading states, saved quotation can be reopened, tests
cover extraction validation/markup/provider normalization.

## 14. Decisions/assets needed from Ark Travelers

Use placeholders until supplied/approved: - Logo and brand
assets/colors. - Official agency contact details. - Approved quotation
terms/disclaimer. - Quote numbering format. - Quote validity policy. -
Markup rules and rounding. - Required customer fields. - Email
sender/provider. - WhatsApp handoff vs approved WhatsApp Business
integration. - Hosting/access/authentication requirements. - Whether
real customer data may be used during development. - Sabre account/API
order status, permitted CERT APIs, credentials, and production
pricing/access.

Do not invent official business details or policies.

## 15. Instructions for Codex / Claude

You are acting as a senior full-stack engineer initiating the Ark
Travelers quotation web application.

**Before coding:** 1. Inspect the actual repository and report its
current state. 2. Identify existing routes, components, tests, assets,
and stack conventions. 3. Propose a practical folder structure and small
milestone plan for this repo. 4. State assumptions/blockers. Do not ask
for API secrets to be pasted into chat. 5. Then implement the first
small milestone; do not return only a generic architecture essay.

**Implementation rules:** - Prioritize Option 1 and make it work
end-to-end. - Build Option 2 with a mock provider first; add Sabre CERT
behind a provider adapter. - Reuse one quotation editor and PDF
generator for both options. - Keep extraction, pricing, persistence,
provider logic, and UI concerns separated. - Use types/schema validation
and helpful errors. - Never invent flight details or claim unverified
prices/availability. - Never implement booking, ticketing, payments,
cancellation, or refund functionality. - Never hardcode/expose secrets
or commit `.env`. - Do not replace the existing architecture without a
clear reason. - Add tests for important business rules and failure
cases. - After each milestone, report what changed, how to run it, tests
performed, and what remains. - If Sabre access is blocked, complete the
mock workflow and document the exact missing access/configuration. -
Keep the README up to date.

## 16. Definition of done for the first useful prototype

1.  Upload a supported supplier PDF/image.
2.  Extract available flight details into an editable form.
3.  Flag missing/uncertain values for review.
4.  Set markup/selling price transparently.
5.  Preview and download a branded-format PDF (approved assets or
    obvious placeholders).
6.  Run mock flight search and select an offer into the same quotation
    editor.
7.  Sabre CERT is either tested with authorized credentials or clearly
    documented as blocked by access/configuration.
8.  No booking/ticketing calls are made.
9.  Setup and environment-variable documentation exists.
10. Basic tests cover extraction validation, markup, provider
    normalization, and important failure states.

**Guiding principle:** Build a reliable quotation workflow first. Treat
AI extraction and flight search as data sources feeding one shared,
human-reviewed quotation process---not as separate products.
