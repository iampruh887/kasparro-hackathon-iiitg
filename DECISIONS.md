# Decision Log

## D-01: Deterministic-first diagnostic engine
- Date: 2026-04-26
- Decision: Build explainable heuristics before introducing generative AI.
- Reason: Track values product thinking and engineering clarity; deterministic output is auditable.

## D-02: Single-page merchant dashboard
- Date: 2026-04-26
- Decision: Ship one focused screen for input -> analysis -> actions.
- Reason: Keeps demo flow tight and understandable for evaluators.

## D-03: Prioritized action plan over flat issue list
- Date: 2026-04-26
- Decision: Rank issues using impact/effort and severity weight.
- Reason: Merchant operators need clear execution order, not only diagnostics.

## D-04: Current vs desired representation model
- Date: 2026-04-26
- Decision: Explicitly compare AI narrative and merchant intent.
- Reason: Core of the track is representation quality, not generic content QA.

## D-05: Synthetic dataset included
- Date: 2026-04-26
- Decision: Provide ready-to-run sample payload in repo.
- Reason: Aligns with challenge guidance and speeds evaluator onboarding.

## D-06: Public Shopify connection first
- Date: 2026-05-02
- Decision: Connect to storefront and product URLs through public Shopify endpoints before any authenticated flow.
- Reason: Minimizes setup friction and keeps the demo usable from a shared link.

## D-07: Deterministic analysis remains source of truth
- Date: 2026-05-02
- Decision: Keep scoring, issue detection, and prioritization deterministic even when AI summaries are enabled.
- Reason: Merchants need stable, explainable rankings they can trust and act on.

## D-08: Local AI with graceful fallback
- Date: 2026-05-02
- Decision: Generate merchant-facing summaries through Ollama, but fall back to another local model or a deterministic response if generation fails.
- Reason: The product should still work when the preferred model is unavailable or returns unusable output.

## D-09: Verification loop around analysis output
- Date: 2026-05-02
- Decision: Add an agentic verify -> refine -> re-verify loop before final synthesis.
- Reason: Protects downstream UI and summaries from malformed or inconsistent analysis output.
