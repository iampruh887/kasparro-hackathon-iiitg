# AI Representation Optimizer

Merchant-facing diagnostic dashboard for understanding how AI shopping agents may perceive a Shopify store and what to improve first.

## Problem Statement

Merchants increasingly get represented through shopping agents rather than direct browsing. When product data, policies, FAQs, reviews, or structured data are incomplete or contradictory, the store can be skipped or described incorrectly. This app helps merchants find the highest-risk gaps and fix them in priority order.

## What It Does

- Connects to a public Shopify storefront or product URL and normalizes the visible data
- Scores the store across product clarity, policy coverage, FAQ coverage, trust signals, and structured data
- Compares the current AI narrative with the merchant's desired narrative
- Produces ranked actions using impact and effort weighting
- Generates a local AI summary through Ollama, with fallback behavior if the model is unavailable

## Product Demo

Watch a quick demo of the dashboard in action:

[AI Representation Optimizer Demo Video](https://youtu.be/279NSpLVYqE)

## Setup

Prerequisite: Node.js 18 or newer.

```bash
npm install
```

Start the app in watch mode:

```bash
npm run dev
```

Open the dashboard at:

- http://localhost:5177

If port 5177 is already in use and `PORT` is not set, the server automatically retries on the next port.

## Running It Locally

The app serves a static dashboard from `public/` and exposes a small Express API from `src/server.js`.

Useful endpoints:

- `GET /api/health` - service health check
- `GET /api/sample-store` - synthetic sample payload
- `POST /api/analyze` - runs the full analysis pipeline
- `POST /api/connect-shopify` - best-effort connector for a public Shopify URL

Example analysis payload:

```json
{
  "storeProfile": {
    "storeName": "LumaLeaf Skincare",
    "category": "skincare"
  },
  "desiredRepresentation": {
    "narrative": "...",
    "targetAudience": "...",
    "requiredTrustSignals": ["verified reviews"],
    "primaryConversionGoal": "..."
  },
  "products": [],
  "policies": [],
  "faqs": [],
  "reviews": [],
  "trustSignals": [],
  "structuredData": {}
}
```

## Shopify Connection

The connector is intentionally lightweight and public-link friendly:

- Accepts either a storefront URL or a product URL
- Tries Shopify's public JSON endpoints first
- Falls back to homepage metadata, Open Graph tags, and JSON-LD parsing
- Returns a best-effort payload even when some public data is missing

This is not a full Shopify Admin installation flow. It is designed for a demoable link-based workflow and can later be extended to OAuth or Admin API access.

## Local AI Configuration

The app generates merchant-facing AI text through Ollama when available.

Default settings:

- `OLLAMA_BASE_URL=http://127.0.0.1:11434`
- `OLLAMA_MODEL=gemma4:latest`
- `OLLAMA_FALLBACK_MODEL=gemma3:latest`

If the primary model fails to load, the app tries fallback models and still returns a usable response. If Ollama is unavailable entirely, the app returns a deterministic fallback response so the dashboard still works.

## Repository Guide

- `src/analyzer.js` - deterministic scoring, issue detection, and prioritization
- `src/agenticAnalyzer.js` - verification loop, refinement, and execution metadata
- `src/shopifyConnector.js` - best-effort public Shopify data extraction
- `src/ollama.js` - local model prompting and fallback handling
- `src/server.js` - Express API plus static frontend serving
- `public/` - dashboard UI
- `data/sampleStore.json` - sample merchant payload
- `PRODUCT.md` - product framing, scope, and tradeoffs
- `TECHNICAL.md` - architecture, implementation choices, and limitations

## Project Name

AI Representation Optimizer
