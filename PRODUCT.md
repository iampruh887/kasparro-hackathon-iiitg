# Product Document

## What We Built

AI Representation Optimizer is a merchant-facing diagnostic dashboard for Shopify stores. It helps merchants understand how an AI shopping agent may describe their store today, where that differs from the story they want told, and which fixes should be handled first.

The product combines three layers:

- Public Shopify ingestion for storefront or product URLs
- Deterministic scoring and issue detection across five readiness dimensions
- A local AI summary layer that turns analysis into merchant-facing language

## Who It Is For

Primary user:

- Merchant operator, such as a founder, ecommerce manager, or growth lead

Secondary user:

- Agency or consultant managing one or more Shopify stores

## Why It Exists

Merchants are increasingly represented by shopping agents instead of direct browsing. Those systems rely on whatever public, machine-readable evidence they can find. If product copy is thin, policies conflict, or trust signals are weak, the merchant can be omitted or described incorrectly.

The product is designed to answer three practical questions:

- How does AI likely see this store right now?
- What is missing or contradictory?
- What should I fix first to improve recommendation quality?

## Scope

In scope:

- Single-store diagnostic runs
- Public URL connection for Shopify storefronts and product pages
- Five scoring dimensions: product clarity, policy coverage, FAQ coverage, trust signals, and structured data
- Current-versus-desired narrative comparison
- Ranked action plan with impact and effort weighting
- Local AI summary generation through Ollama

Out of scope for this version:

- Shopify Admin writeback or automatic content editing
- Multi-store benchmarking
- Long-term trend tracking
- Notification or monitoring workflows
- Full semantic rewriting of policies or product copy

## Key Decisions

Deterministic scoring was chosen for the core diagnosis because it is explainable, debuggable, and easy to validate. That matters more than raw model creativity for a merchant tool that needs to justify recommendations.

The Shopify connector uses public storefront data first instead of requiring an installation flow. That keeps the demo lightweight and lets users try the product from a shared URL with no setup friction.

The app still uses a local Ollama model, but only for narrative output. The underlying score and action ranking remain deterministic so the merchant can trust that the recommendation order is stable.

## Tradeoffs

The product favors clarity over breadth. It can inspect and rank obvious representation gaps quickly, but it does not yet deeply understand every category nuance or hidden storefront detail.

The connector is best-effort rather than exhaustive. That means it can produce useful output from a shared link, but it will not always recover every policy, review, or structured-data field.

Local AI output improves the presentation, but the app is designed to keep working even when Ollama is unavailable. In that case, the deterministic fallback still gives the merchant something usable.

## Success Criteria

The product is successful if it helps a merchant:

- Identify the top content and trust gaps quickly
- Understand the mismatch between intended and current brand narrative
- Prioritize fixes that are most likely to improve AI recommendation inclusion
- Move from generic store data to a more machine-readable, trustworthy storefront
