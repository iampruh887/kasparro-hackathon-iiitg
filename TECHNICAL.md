# Technical Document

## Architecture

The app uses a simple three-part stack:

- Static frontend in `public/` for data entry and dashboard rendering
- Express backend in `src/server.js` for API routes and static asset serving
- Analysis modules in `src/analyzer.js`, `src/agenticAnalyzer.js`, `src/shopifyConnector.js`, and `src/ollama.js`

Request flow:

1. The UI posts merchant JSON to `POST /api/analyze` or first normalizes a public Shopify URL through `POST /api/connect-shopify`
2. `src/agenticAnalyzer.js` normalizes the payload, runs deterministic scoring, verifies the result, and may refine it through a closed loop
3. `src/ollama.js` turns the resulting analysis into a local AI summary
4. The frontend renders scores, issues, prioritized actions, and the current-vs-desired narrative comparison

## Core Implementation Decisions

Deterministic scoring is the source of truth. `src/analyzer.js` evaluates five dimensions:

- Product clarity
- Policy coverage
- FAQ coverage
- Trust signals
- Structured data

Each dimension returns a score, metrics, and issue objects. The final score is a weighted combination of those dimensions, and the action plan is ranked by `impact * severityWeight - effort * 0.45`.

The agentic wrapper adds orchestration value without changing the basic scoring model. `src/agenticAnalyzer.js` normalizes input, checks score validity, verifies action ordering, optionally refines malformed output, derives execution objectives, and records stage timings.

The local AI layer is intentionally narrow. `src/ollama.js` does not invent business facts; it prompts a model to describe the already-computed analysis and falls back to a deterministic response if Ollama fails or returns unusable output.

## Failure Handling

The app is designed to fail closed and stay usable:

- `src/server.js` wraps API handlers in `try/catch` and returns `400` or `500` with a readable message
- `src/shopifyConnector.js` uses best-effort fetches and continues when a public endpoint is missing or blocked
- Missing arrays and objects are normalized to empty collections before analysis
- If model generation fails, `src/ollama.js` falls back to another local model or a deterministic response
- The frontend rejects malformed JSON before sending analysis requests

This means sparse or partially broken data usually produces a low-confidence result with issues to fix, rather than a crash.

## Limitations

The Shopify connector is public-link based, not an authenticated Admin API integration. It can extract useful storefront signals, but it cannot guarantee full catalog coverage or access private store data.

The analyzer uses heuristics and keyword-based checks. That makes the system explainable and fast, but it also means category nuance, brand tone, and some contradictions can be missed.

The current AI summary is generated locally through Ollama and depends on the availability and quality of a local model. When the model is unavailable, the app degrades gracefully but the narrative quality drops.

The dashboard is a single-page static UI with no persistence layer. Results are computed at request time and are not stored for historical comparison.

## Extensibility

The most natural next technical additions are:

- Shopify Admin or OAuth-based store access for deeper catalog and policy coverage
- Persistent storage for comparison over time
- Category-specific benchmarks and richer heuristics
- More robust semantic checks for policy contradictions and product claims
- Optional background jobs for monitoring and alerts

## Verification Notes

The agentic verification loop in `src/agenticAnalyzer.js` exists to protect downstream consumers of the analysis object. It checks score ranges, action ordering, and issue/action consistency before final synthesis, which keeps the dashboard stable even when input data is noisy.
