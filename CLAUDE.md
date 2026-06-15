# Reweave — HackATL 2026

**Track 05: Make & Remake** (sponsored by Carter's)
Cox 'Play With Purpose' Hackathon · Atlanta, GA · June 14–17, 2026

Problem statement we're solving: **Industrial Symbiosis & Byproduct Exchange** — build a platform that turns textile factory fabric scraps (industrial byproducts) into raw material inputs for buyers, eliminating waste before it's created.

Carter's is the anchor pilot: their fabric offcuts flow through Reweave → sorted by CV → listed on marketplace → claimed by recyclers/makers.

---

## Judging Criteria (keep these in mind for every feature decision)

| Weight | Criterion | What judges look for |
|--------|-----------|----------------------|
| 30% | **Impact** | How sustainable is the solution? Quantify waste diverted, CO₂ saved, water saved. Make the environmental numbers visible and credible. |
| 25% | **Polish** | How well are the demo and pitch delivered? UI must look finished. The demo flow must be smooth and tell a story end-to-end. |
| 25% | **Innovation** | How novel and ambitious is the solution? CV-based sorting + AI pricing + marketplace is the differentiator — lean into it. |
| 20% | **Value** | How well does the team understand the problem and customer? Carter's pilot story, factory worker UX, buyer personas all matter. |

**Priority order for any new feature:** Impact > Polish > Innovation > Value.

---

## What we have

- **Factory portal** — CV capture (vision pipeline) + Bin Feed (worker UI showing which bin each scrap goes in)
- **Admin portal** — Dashboard with P&L, lot performance, environmental impact, top buyers, fabric breakdown
- **Buyer portal** — Marketplace with filters, quantity slider, cart, order placement
- **AI pricing** — Exponential decay model: `base * max(0.35, e^(-0.015 * max(0, days-7)))`, floor at 35%
- **Reweave Assistant** — AI chatbot (OpenRouter gpt-4o-mini) with full system context
- **Carter's spotlight** — Supplier pilot callout on the marketplace

## Demo credentials

- factory@demo.com / factory123
- admin@demo.com / admin123
- buyer@demo.com / buyer123

## Stack

- Backend: FastAPI + SQLite + SQLAlchemy (port 8000)
- Frontend: React + Vite (port 5173, proxies /api/* to 8000)
- Auth: JWT (python-jose), passwords hashed with hashlib.sha256
- CV: OpenCV headless
- AI: OpenRouter API (OPENROUTER_API_KEY in .env)

## Ground rules for vibe coding

- One solid feature beats three half-finished ones. Ship complete, working things.
- Every feature should make one of the four judging criteria stronger. If it doesn't, skip it.
- Impact metrics (kg diverted, CO₂, water) should be visible and prominent — that's 30% of the score.
- Polish matters: no broken layouts, no loading spinners that never resolve, no console errors.
- The Carter's pilot narrative is our strongest real-world hook — keep it front and center.
