# Form Assistant (AI)

Small, stateless Python (FastAPI) service. A user types or uploads something; the service returns
**suggested values** for form fields. It never saves anything and has no database.

| Module | Input | Endpoint |
|---|---|---|
| `rfq` | a requirement in plain words | `POST /v1/rfq/assist` |
| `order_address` | pasted address / contact text | `POST /v1/order-address/assist` |
| `transport_vehicle` | photos of RC / insurance / permit / PUC (+ optional text) | `POST /v1/transport-vehicle/assist` |
| `transport_driver` | photo of the driving licence (+ optional contact text) | `POST /v1/transport-driver/assist` |

Each module also has `GET /v1/<module>/fields`: the fields the AI may fill, and the ones it never
touches with the reason (source: `app/modules/<module>/config.json`).

```
React form -> your Express backend -> Form Assistant (this) -> Gemini / OpenAI
```

The browser must not call this service directly in production (the API key would leak). Your
Express backend calls it with the `X-API-Key` header.

## Run in 5 minutes (no AI key needed)

```bash
cd form-assistant
python -m venv .venv
.venv/Scripts/activate          # Windows;  Linux/Mac: source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env            # then edit ASSIST_API_KEY (min 16 chars)
uvicorn app.main:app_factory --factory --port 8100
```

- Swagger docs: http://localhost:8100/docs (disabled when `ASSIST_ENVIRONMENT=production`)
- Health: `GET /health`
- Tests: `pytest` (offline). Lint: `ruff check .`
- Manual test page (4 tabs): `python -m http.server 5173 --directory test-ui`, open http://localhost:5173.
  Throwaway: delete `test-ui/` before shipping.

`ASSIST_AI_PROVIDER=fake` is a deterministic rule-based stand-in so everything runs offline. It reads
text only (not photos) and is refused in staging/production. For real AI set
`ASSIST_AI_PROVIDER=gemini|openai` and the matching `ASSIST_*_API_KEY` in `.env` (never commit `.env`).
Note: shell env vars named `ASSIST_*` override `.env`.

## Common rules for every `/assist` endpoint

All need header `X-API-Key: <ASSIST_API_KEY>`. Errors look like `{"error": {"code", "message", "details"}}`.
Status codes: 401 bad key, 403 module disabled, 422 bad input / bad image, 429 rate limit,
502 provider failed, 503 no provider configured.

Common request fields: `current_values` (what the form already has, keys = field names),
`skip_filled` (default true: never suggest a field the user already filled), `today` (tests only).

Common response:

```json
{
  "suggestions": {"quantity": {"value": 500, "confidence": 0.9, "routing": "prefill", "reason": ""}},
  "skipped": {"title": "already filled by the user"},
  "warnings": [],
  "usage": {"provider": "gemini", "model": "...", "prompt_version": "...", "input_tokens": 0, "output_tokens": 0, "latency_ms": 0}
}
```

- `routing: prefill` = high confidence; `confirm` = show it but ask the user to check.
- Suggestion keys are your Prisma field names. Dates are `YYYY-MM-DD` (convert to DateTime yourself).
- Documents (vehicle/driver) are sent as base64 in JSON: `"images": [{"mime_type": "image/jpeg", "data_base64": "..."}]`
  (JPEG/PNG/WebP, max 4 images, 5 MB each; content is checked, not just the mime type).
- **Never auto-fill.** Show each suggestion with an Apply button (see `test-ui/index.html`).

### RFQ - `POST /v1/rfq/assist`
`text`, `categories: [{slug, name}]` (send your real category list; the AI can only pick from it).
Fills: title, specifications, categorySlug, quantity, unit, deliveryPincode, destinationCountry, requiredByDate.

### Order address - `POST /v1/order-address/assist`
`text`. Fills `deliveryAddress.line1/line2/landmark/city/state/pincode/country` (flat keys: assemble your
own JSON, the shape of `Order.deliveryAddress` was not provided) and buyerName, buyerPhone (10-digit),
buyerEmail, buyerCompany, buyerGstin (format + checksum verified; must be written in the text).
Warns if the GSTIN state differs from the delivery state.

### Transport vehicle - `POST /v1/transport-vehicle/assist`
`images`, `text` (at least one), `company_name` (optional, only used in code to suggest `ownershipType: OWNED`).
Fills: vehicleNumber (compact, e.g. `MH12AB1234`), make, model, yearOfManufacture, ownerName, rcNumber, rc/insurance/
fitness/permit/PUC expiry dates, insuranceNumber, permitNumber, permitType, gpsProvider, plus inferred fields that are
**always `confirm`**: vehicleType, bodyType, capacityTons, gpsImei, ownershipType.
Expired documents are accepted but flagged (`warnings` + `confirm`).

### Transport driver - `POST /v1/transport-driver/assist`
`images` (max 2), `text` (at least one). Fills name, licenseNumber, licenseType (always `confirm`),
licenseExpiryDate (uses the transport/TR validity for commercial classes), and phone / alternatePhone /
emergencyContactName / emergencyContactPhone **from the pasted text only**.
Privacy: see below.

## Safety rules (enforced in code, covered by tests)

1. **No prices, totals or tax.** Money fields are never AI-fillable.
2. **Never verification or status.** `isVerified`, `verifiedAt`, `status`, ... are never returned.
3. **Every AI value is re-validated** (`app/validators/`): category must be in your list; quantity a positive integer;
   unit from an allowed list; pincode/phone/email/GSTIN must be **written in the text** and pass format checks
   (GSTIN checksum, IMEI Luhn, vehicle-number and licence-number patterns); dates valid. Invalid values are dropped, never
   silently "fixed".
4. Low-confidence (<0.5) values are discarded. Inferred values are forced to `confirm`.
5. Text and images are passed as untrusted data (prompt-injection guard). Request text is never logged.
6. **Personal data:** Aadhaar-like numbers (12 digits) are **redacted from text before it reaches the AI**, and any
   Aadhaar-like value in the AI output is dropped. Aadhaar and PAN are never extracted. Licence/RC **photos are sent to the
   configured AI provider** (Google/OpenAI) and may contain personal data (name, address, photo, Aadhaar on some cards):
   get your compliance/legal sign-off (India's DPDP Act) before enabling the driver module in production, or turn it
   off with `ASSIST_ENABLE_DRIVER_DOCUMENTS=false` (endpoint then answers 403).

## Express integration example

```js
// Node 18+: your backend route, after your own auth check
app.post("/api/rfq/ai-assist", requireLogin, async (req, res) => {
  const r = await fetch(`${process.env.ASSIST_URL}/v1/rfq/assist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": process.env.ASSIST_API_KEY },
    body: JSON.stringify({
      text: req.body.text,
      categories: await db.category.findMany({ select: { slug: true, name: true } }),
      current_values: req.body.currentValues ?? {},
    }),
  });
  res.status(r.status).json(await r.json());
});

// Documents: read the uploaded file (e.g. multer memoryStorage) and base64 it
const images = req.files.map((f) => ({ mime_type: f.mimetype, data_base64: f.buffer.toString("base64") }));
```

## Layout / adding the next form

```
app/core/        config, API-key auth, rate limit, shared response shapes, the evaluate() pipeline
app/ai/          providers: gemini / openai / fake (text + images)
app/validators/  deterministic checks (common.py, india.py, images.py)
app/modules/<form>/   config.json, schemas.py, prompts.py, service.py, router.py, fake.py   <- one folder per form
tests/
```

New form = copy a module folder (`order_address/` is the simplest), edit its schema/prompt/validators, add its router
to `app/main.py`. Modules do not import each other.

## Known limits / not covered

- Rate limiter is in-process (single instance). Use Redis if you run several replicas.
- `RfqItem`, `Quotation`, supplier GSTIN, driver PAN/Aadhaar, `experienceYears`, vehicle notes: not covered (see each
  module's `/fields` for the reason).
- `Order.deliveryAddress` JSON shape and the meaning of `rcNumber` vs `vehicleNumber` are assumptions: check them.
- Live checks done with Gemini only (text and synthetic fictional document images). OpenAI is tested with mocked HTTP only.
  Run live tests: `ASSIST_RUN_LIVE=1 pytest tests/rfq/test_rfq_live.py tests/test_live_modules.py -s` (needs `pip install pillow`).
- Real-world photos (glare, blur, handwriting, regional language) are not tested: expect lower accuracy than the
  synthetic documents, which is what the `confirm` routing and the user's review are for.
