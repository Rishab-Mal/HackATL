# Reweave

Factories throw away fabric scraps because sorting them is too slow. This app turns a photo of a messy scrap pile into sorted, sellable lots, backed by real factory production records, and connects those lots to recyclers and makers in a marketplace.

## Stack

- **backend/** - Python (FastAPI + SQLite). One server, organized into routers/modules so each person can work in their own files without stepping on each other.
- **frontend/** - React (Vite). One app with four screens.

The whole thing runs end-to-end with seeded demo data from minute one, so nobody has to wait on anyone else to start building.

## Running it

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Mac/Linux
.venv\Scripts\activate           # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Copy `.env.example` to `.env` and fill in your `OPENROUTER_API_KEY` before starting. This creates `backend/scraps.db` (SQLite) on first run and seeds it with demo factory records, lots, and marketplace buyers. API docs are available at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173`). Requests to `/api/*` are proxied to the backend on port 8000 (see `frontend/vite.config.js`).

---

## Pricing model

**File:** `backend/app/pricing.py`

Lot prices are calculated automatically from five factors when a lot is created. No manual entry needed — the CV output and factory record supply everything required.

### Base price per kg (by dominant fabric type)

| Fabric | $/kg |
|---|---|
| Silk | $14.00 |
| Wool | $6.50 |
| Linen | $4.50 |
| Denim | $3.80 |
| Cotton Twill | $3.50 |
| Cotton | $3.20 |
| Jersey | $2.80 |
| Spandex | $2.20 |
| Nylon | $1.80 |
| Polyester | $1.20 |

### Multipliers applied on top of base

| Factor | Rule | Effect |
|---|---|---|
| **Composition purity** | ≥95% single fiber | ×1.20 — easiest to recycle |
| | 85–94% | ×1.10 |
| | <70% | ×0.85 — blends are harder to process |
| **Color** | White / natural | ×1.15 — can be re-dyed to any color |
| | Beige / ivory | ×1.10 |
| | Black / grey | ×1.05 |
| | Mixed / unknown | ×0.85 |
| **Weight tier** | ≥15 kg | ×0.88 — bulk discount |
| | <1 kg | ×1.20 — small lots are harder to move |
| **Piece count** | <10 pieces | ×1.20 — few large pieces, maker-friendly |
| | >50 pieces | ×0.90 — many small pieces, more sorting work |

### Price decay

Unsold lots lose value over time to incentivize quick turnover — the same logic used in airline pricing and produce markets.

```
current_price = base_price × max(0.35, e^(−0.015 × max(0, days_listed − 7)))
```

- **Grace period:** no decay for the first 7 days
- **Decay rate:** 1.5% per day after the grace period
- **Half-life:** ~46 days after grace (price halves in ~7 weeks)
- **Floor:** 35% of base price — clearance minimum, never goes lower
- **UI:** a yellow `↓N%` badge appears on any lot whose price has decayed, with a "was $X" line so buyers can see the original value

The decay factor and floor are tunable constants at the top of `pricing.py`.

---

## How the project splits into 4 parts

### Person 1 — Computer vision and sorting
**Owns:** `backend/app/vision/`, `backend/app/routers/vision.py`

- `vision/segmentation.py` — detects individual scrap pieces in a photo (OpenCV contour detection on a thresholded background), reads each piece's average color and rough size, and groups pieces by color. One pile photo in, sorted color groups out.
- `vision/colors.py` — named-color palette for turning RGB into labels like "blue" or "denim".
- **Endpoint:** `POST /api/vision/detect` (multipart image upload) returns `{ image_width, image_height, pieces: [...], groups: [...] }`. See `schemas.py` (`DetectResponse`, `Piece`, `ColorGroup`) — keep this contract stable.
- **To level up:** swap contour detection for a Segment Anything (SAM) call. Same return shape, nothing else changes.

### Person 2 — Backend, lots, and factory records
**Owns:** `backend/app/models.py`, `backend/app/schemas.py`, `backend/app/routers/factory.py`, `backend/app/routers/lots.py`, `backend/app/database.py`

- `FactoryRecord` — production-records table (batch name, fabric type, composition, notes).
- `Lot` — a sellable group created from a vision color group + optional factory record. Price is auto-calculated by the pricing model if not supplied.
- **Endpoints:** `POST/GET /api/factory-records`, `POST/GET /api/lots`, `POST /api/lots/{id}/claim`

### Person 3 — Frontend and product flow
**Owns:** `frontend/`

Four screens wired to the API via `frontend/src/api.js`:

1. `pages/Capture.jsx` — upload a scrap photo, run detection, see bounding boxes + color groups, create a lot from a group.
2. `pages/SortedLots.jsx` — grid of lots with current (decayed) price and decay badge.
3. `pages/Marketplace.jsx` — available lots + buyer profiles + Carter's pilot spotlight. Claim a lot for a buyer.
4. `pages/Dashboard.jsx` — impact totals (fabric diverted, CO₂ saved, water saved, lots claimed) and breakdown by fabric type.

### Person 4 — Marketplace, impact logic, and demo data
**Owns:** `backend/app/seed.py`, `backend/app/routers/marketplace.py`, `backend/app/constants.py`

- `seed.py` — demo factory records, lots (with staggered timestamps so price decay is visible), and buyer profiles. This is where the Carter's supplier story lives.
- `routers/marketplace.py` — `GET /api/marketplace/buyers`, `POST /api/marketplace/buyers`, `GET /api/impact`.
- `constants.py` — `CARBON_PER_KG` / `WATER_PER_KG` used to compute each lot's impact numbers.

---

## How it all connects

1. Person 3's Capture screen uploads a photo to Person 1's `/api/vision/detect`, which returns color groups.
2. From a group, the Capture screen calls Person 2's `POST /api/lots` — price is auto-calculated from the lot's fabric type, composition, color, weight, and piece count.
3. Person 3's Sorted Lots and Marketplace screens read those lots back via `GET /api/lots`, showing the current decayed price.
4. Person 4's buyer profiles (seeded data) show up in the Marketplace screen; claiming a lot calls `POST /api/lots/{id}/claim`.
5. Person 4's `/api/impact` feeds the Dashboard screen.

Everyone can build against the seeded demo data immediately — swap in real vision output, real factory records, and real buyer/lot copy as each piece comes online.
