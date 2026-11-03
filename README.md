# Ark Travelers — Quotation Portal

A web app that helps Ark Travelers staff turn supplier flight quotations (PDFs, screenshots, photos) into branded customer quotations.

**Scope:** flight quotation preparation only. There is no booking, ticketing, payment, cancellation or refund functionality. See [docs/ark_travelers_project_initiation.md](docs/ark_travelers_project_initiation.md) for the full brief.

## Status

| Milestone | Status |
| --- | --- |
| Option 1: upload a supplier quotation → review → price → branded PDF | ✅ Done |
| Option 2: live fare search (Duffel, test or live mode) → select → re-price → same editor and PDF | ✅ Done |
| Option 2 follow-up: traveller details, bags/seats, TEST booking (Duffel guide §9–11) | ⏳ Awaiting go-ahead |
| Booking and payment | ⏳ Not built: the app only searches and quotes |
| Server database, login, email sending | ⏳ Later (see *Limitations*) |

## How it works (Option 2: search flights)

1. **Search.** Staff pick:
   - **From/To:** a city ("London (all airports)"), an airport name or a code.
   - **Trip type:** return, one way or multi-city (up to 4 flights).
   - **Travellers:** adults; children and infants by age, because fares depend on it.
   - **Cabin and stops.**
2. **Results.** Each result is a complete priced itinerary, connections included. It shows local departure and arrival times, "+1" day changes, the stops and where, the duration, the airline and the **total price** in the currency Duffel returns.
   - Sort by cheapest, fastest or earliest, and filter by stops or airline.
   - **Flight details** shows every flight with its number, aircraft, terminals, cabin, connection times, baggage, fare brand, change/refund rules, the fare/tax split, and how long the price is held.
3. **Select.** The server re-prices the offer with Duffel (`GET /air/offers/{id}`).
   - If the price changed, staff see the old and new prices and must accept before continuing.
   - If the fare expired, they are asked to search again.
4. **Quotation.** The offer goes into the same quotation editor and PDF as Option 1:
   - Flights, local times, cabin, baggage and fare rules are filled in.
   - The **Duffel total becomes the supplier price**, and staff add their markup.
   - An immutable `providerSnapshot` (offer id, search id, test/live mode, original total, expiry, re-price time) is stored with the quotation.

**Data source: [Duffel](https://duffel.com/docs) API v2.** I checked it against the live API.

| Endpoint | Used for |
| --- | --- |
| `POST /air/offer_requests?return_offers=true&supplier_timeout=20000` | Search; returns priced offers with slices, segments, baggage and conditions |
| `GET /air/offers/{id}` | Re-price the selected offer before quoting |
| `GET /places/suggestions?query=` | Airport/city autocomplete (cached per query for a day) |

**Live mode:** with `DUFFEL_ENV=live` and a `duffel_live_` token, results are real fares from the airlines connected to the Duffel account.
- Test labels and the PDF watermark disappear, because they follow the `live_mode` flag Duffel puts on each result.
- The results show the airline flown. If a different airline sells the fare (e.g. Hahn Air selling a Kam Air flight), the card adds "Sold by".
- Coverage is what the Duffel account returns, and some airlines may be missing. For example, a direct London–Dubai search returned only British Airways.
- Many airlines don't send change and refund rules through Duffel. The app then says they weren't provided and leaves them off the quotation.
- Prices were held for 30–60 minutes in live testing, and come back in EUR, unconverted.
- The app can't create orders, so no ticket is issued and no money moves.

**Test mode:** with `DUFFEL_ENV=test`, results come from Duffel's test environment.
- Airlines and prices are for demonstration only. Duffel's test data includes real airline names, e.g. Etihad and Iberia, plus its fictional "Duffel Airways" (ZZ).
- Every screen shows a **TEST MODE** label, and the PDF is watermarked "TEST MODE — NOT A REAL FARE".
- The server refuses to call Duffel if a non-test token is configured for test mode, and discards any response marked live.

**Safety:**
- The token is used only on the server.
- Searches are rate-limited per user, because they will be billable when live.
- Every Duffel call is logged with its `x-request-id` and a correlation id. Tokens and passenger data are never logged.
- Errors (validation, auth, expired offer, rate limit, supplier failure, timeout) are mapped to clear messages.

**Code:**
- `src/features/flights/server/providers/duffel/`: `client.ts` (HTTP + errors), `config.ts` (test/live guard), `normalize.ts` (pure, unit-tested against real captured responses in `__fixtures__`).
- The UI only uses the provider-neutral `FlightOffer` type, so another provider (e.g. a GDS) can be added behind `FlightProvider`.

## How it works (Option 1)

1. **Upload.** Drag in a PDF or image, browse for one, or paste a screenshot with Ctrl+V.
2. **Extraction** (server-side, `POST /api/quotations/extract`):
   - The file is checked for size, extension and its real content type (magic bytes). It is processed in memory and never stored.
   - **PDFs with a text layer:** the text is read locally (`unpdf`) and sent to the AI as text. This is cheaper and more exact.
   - **Scanned PDFs and images:** the file goes to a vision model, which acts as OCR.
   - The AI must answer in a strict JSON schema in which every field is nullable. It is told never to guess, and to list uncertain fields along with evidence.
   - The response is validated with Zod. Badly formatted values (for example `"10 Dec"` as a date) are dropped and flagged rather than guessed.
   - Code-level safeguards cover cheaper models that don't always follow instructions:
     - **Text PDFs:** any name or label the AI returns that doesn't appear in the document is removed. For example, it won't turn "QR" into "Qatar Airways".
     - **Dates with no year:** the year is set to the next upcoming occurrence and flagged for staff to confirm.
     - **Past departure dates:** a departure date in the past blocks sending.
3. **Review.** Staff check the flights in an editable form:
   - 🔴 **Red** fields must be fixed before the quotation can be sent.
   - 🟡 **Yellow** fields are worth checking. These are AI flags, which show the source text.
   - A checklist jumps straight to each problem.
4. **Customer & price.** Enter the customer details and the supplier price, then add a fixed or percentage markup. The calculation is shown on screen.
5. **Preview & send.** A live A4 PDF preview, PDF download, a pre-filled email draft, a WhatsApp chat link, and a "mark as sent" button.

Quotations autosave in the browser and are listed on the home page.

### Pricing rule (prototype, to be confirmed with Ark Travelers)

- Markup is applied **once to the itinerary total**, not per passenger.
- Percentage markup is rounded half-up to the currency's minor unit, e.g. cents. JPY has no decimals.
- `selling total = supplier total + markup`. Currencies are never converted.
- The supplier price and markup are **never** printed on the customer PDF. The PDF is built only from a customer-facing view model (`buildCustomerQuote`), and a test enforces this.

## Getting started

Requirements: Node.js 20.9+ (developed on Node 24).

```bash
npm install
cp .env.example .env.local   # then edit .env.local
npm run dev                  # http://localhost:3000
```

To try the app **without an AI key**, set `EXTRACTION_PROVIDER=mock` in `.env.local`. Every upload then returns the same sample data, labelled **DEMO DATA** in the app and on the PDF.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `EXTRACTION_PROVIDER` | no | `openai` (default) or `mock` |
| `OPENAI_API_KEY` | for `openai` | Server-side only |
| `OPENAI_MODEL` | no | Default `gpt-4o`. Must support vision and structured outputs |
| `OPENAI_BASE_URL` | no | Any OpenAI-compatible endpoint, e.g. Gemini or OpenRouter |
| `FLIGHT_PROVIDER` | no | `duffel` (default) |
| `DUFFEL_ENV` | no | `test` (default) or `live` |
| `DUFFEL_TEST_ACCESS_TOKEN` | for test mode | Must start with `duffel_test_`. Server-side only |
| `DUFFEL_LIVE_ACCESS_TOKEN` | for live mode | Must start with `duffel_live_`. Server-side only |

`.env*` files are git-ignored except `.env.example`.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |

## Choosing the AI model (cost)

The extraction code is provider-agnostic, so you can switch models with environment variables alone:

| Option | How | Notes |
| --- | --- | --- |
| `gpt-4o` | default | Most accurate on messy screenshots; the most expensive of these options |
| `gpt-4o-mini` / `gpt-4.1-mini` | `OPENAI_MODEL=…` | Much cheaper per document; usually fine for clean PDFs |
| Google Gemini Flash | `OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`, `OPENAI_MODEL=<gemini flash model>`, Gemini key in `OPENAI_API_KEY` | Very low cost with strong OCR; verify structured-output support for the chosen model |

Text PDFs are sent as text rather than images, which already cuts cost substantially. Check current provider pricing before you decide.

## Project structure

```
src/
  app/                          Routes (thin — they only compose features)
    page.tsx                    Dashboard
    quotations/new/             Upload flow
    quotations/[id]/            Quotation editor (wizard)
    api/quotations/extract/     Upload + AI extraction endpoint
    flights/search/             Flight search (Option 2)
    api/flights/search/         Fare search (validates, rate-limits, calls Duffel)
    api/flights/offers/[id]/    Re-price one offer before quoting
    api/flights/locations/      Airport/city autocomplete
    api/health/                 Health check (config status, no secrets)
  components/
    ui/                         Reusable UI: Button, Card, Alert, Badge, form fields, Stepper…
    layout/                     App header
  config/
    brand.ts                    ⚠ Placeholder branding, contact details, terms, validity
    upload.ts                   File type / size limits (shared client + server)
  features/
    extraction/                 Upload validation, AI schema, client hook, upload UI
      server/                   PDF text, prompt, providers (openai, mock), service
    quotation/                  Data model (Zod), pricing, review rules, storage, editor UI
    flights/                    Search types, airport picker, results UI
      server/providers/duffel/  Duffel client, test/live guard, normalisation, real-response fixtures
    pdf/                        Branded A4 PDF template (@react-pdf/renderer)
```

To add another flight data source (for example a GDS), implement `FlightProvider` in `src/features/flights/server/providers/` and register it in `providers/index.ts`. The UI and quotation code only use the normalised `FlightOffer` type.

To add another AI backend, implement `ExtractionProvider` in `src/features/extraction/server/providers/` and register it in `providers/index.ts`.

## Security notes

- API keys stay on the server. The browser only talks to `/api/quotations/extract`.
- Uploads are validated by size, extension and content signature. They are kept in memory only and never written to disk or exposed publicly.
- Document content is treated as untrusted data: the prompt tells the model to ignore any instructions inside it, and the output is schema-validated.
- Logs contain error types only. They never include document contents, keys or customer data.

## Limitations / before going live

- **No login yet.** Don't deploy publicly with real customer data until authentication is added.
- **Storage is per-browser (localStorage).** Quotations aren't shared between computers. `src/features/quotation/storage.ts` is the single place to swap in a database (e.g. PostgreSQL) via an API.
- **Email and WhatsApp** open pre-filled drafts. Staff attach the downloaded PDF themselves, and nothing is sent automatically.
- **Branding** (logo, colours, contact details, terms, validity days, quote number format) uses placeholders in `src/config/brand.ts` until Ark Travelers approves the real values. To use a logo, put it in `public/` and set `logoPath`.
- There is no rate limiting on the extraction endpoint yet. Add it before public deployment to control AI costs.
- Caches and rate limits are in memory, per server instance. On several instances or serverless platforms, use a shared store such as Redis.
- The quotation's validity (`quoteValidityDays` in `brand.ts`) is agency policy. Duffel holds a fare price for a much shorter time (shown in the editor), so re-check before booking.

## Decisions needed from Ark Travelers

Logo and brand colours · official contact details · approved terms/disclaimer · quote validity policy · quote number format · markup rules (fixed/percentage, per passenger or per booking, rounding) · hosting and login requirements · fare currency for the Duffel account.
