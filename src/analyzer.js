const clamp = (num, min, max) => Math.max(min, Math.min(max, num));

const DEFAULT_WEIGHTS = {
  productClarity: 0.28,
  trustSignals: 0.24,
  policyCoverage: 0.2,
  faqCoverage: 0.13,
  technicalStructuredData: 0.15
};

const CATEGORY_BENCHMARKS = {
  skincare: {
    criticalFaqTopics: ["shipping", "returns", "ingredients", "allergens", "routine", "safety"],
    policyTopics: ["shipping", "returns", "refund", "privacy"],
    requiredProductFields: ["title", "description", "price", "ingredients", "usage"],
    preferredTrustSignals: ["verified reviews", "money-back guarantee", "dermatologist tested"]
  },
  apparel: {
    criticalFaqTopics: ["shipping", "returns", "size", "fit", "materials", "care"],
    policyTopics: ["shipping", "returns", "refund", "privacy"],
    requiredProductFields: ["title", "description", "price", "materials", "sizeGuide"],
    preferredTrustSignals: ["verified reviews", "size exchange", "clear returns"]
  },
  general: {
    criticalFaqTopics: ["shipping", "returns", "payment", "support"],
    policyTopics: ["shipping", "returns", "refund", "privacy"],
    requiredProductFields: ["title", "description", "price"],
    preferredTrustSignals: ["verified reviews", "clear guarantee", "contact support"]
  }
};

function normalizeText(input) {
  return String(input || "").toLowerCase().trim();
}

function keywordCoverage(haystacks, topics) {
  const normalizedHaystack = haystacks.map(normalizeText).join(" ");
  const covered = topics.filter((topic) => normalizedHaystack.includes(topic.toLowerCase()));
  return {
    ratio: topics.length ? covered.length / topics.length : 1,
    covered,
    missing: topics.filter((topic) => !covered.includes(topic))
  };
}

function evaluateProducts(products, requiredFields) {
  if (!Array.isArray(products) || products.length === 0) {
    return {
      score: 0,
      issues: [
        {
          severity: "critical",
          area: "product-data",
          title: "No products found",
          detail: "AI agents have no product context to recommend from.",
          impact: 95,
          effort: 30
        }
      ],
      metrics: {
        productCount: 0,
        fieldCompleteness: 0,
        ambiguitySignals: 0
      }
    };
  }

  let completeFieldCount = 0;
  let totalFieldSlots = 0;
  let ambiguitySignals = 0;
  const issues = [];

  products.forEach((product) => {
    requiredFields.forEach((field) => {
      totalFieldSlots += 1;
      const value = product[field];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        completeFieldCount += 1;
      } else {
        issues.push({
          severity: "high",
          area: "product-data",
          title: `Missing ${field} in ${product.title || "untitled product"}`,
          detail: `Agents may skip this product because ${field} is missing.`,
          impact: 72,
          effort: 20
        });
      }
    });

    const description = normalizeText(product.description);
    if (description.length > 0 && description.length < 60) {
      ambiguitySignals += 1;
      issues.push({
        severity: "medium",
        area: "product-data",
        title: `Thin description for ${product.title || "product"}`,
        detail: "Very short descriptions reduce semantic confidence for recommendation models.",
        impact: 55,
        effort: 25
      });
    }

    if (description.includes("best") && !description.includes("because")) {
      ambiguitySignals += 1;
      issues.push({
        severity: "medium",
        area: "product-data",
        title: `Unsubstantiated claim in ${product.title || "product"}`,
        detail: "Claims like 'best' without evidence can weaken trust ranking.",
        impact: 42,
        effort: 15
      });
    }
  });

  const fieldCompleteness = totalFieldSlots === 0 ? 0 : completeFieldCount / totalFieldSlots;
  const score = clamp(Math.round((fieldCompleteness * 85) - (ambiguitySignals * 6)), 0, 100);

  return {
    score,
    issues,
    metrics: {
      productCount: products.length,
      fieldCompleteness: Number(fieldCompleteness.toFixed(2)),
      ambiguitySignals
    }
  };
}

function evaluatePolicies(policies, requiredTopics) {
  const policyTexts = Array.isArray(policies)
    ? policies.map((policy) => `${policy.type || ""} ${policy.content || ""}`)
    : [];

  const coverage = keywordCoverage(policyTexts, requiredTopics);
  const contradictionSignals = [];

  const shippingPolicy = policyTexts.find((policy) => policy.includes("shipping")) || "";
  const returnsPolicy = policyTexts.find((policy) => policy.includes("return")) || "";

  if (shippingPolicy.includes("3-5") && shippingPolicy.includes("10-14")) {
    contradictionSignals.push("Shipping times conflict across policy statements.");
  }
  if (returnsPolicy.includes("final sale") && returnsPolicy.includes("30 day return")) {
    contradictionSignals.push("Returns policy appears contradictory (final sale vs 30-day return).");
  }

  const issues = [
    ...coverage.missing.map((topic) => ({
      severity: "high",
      area: "policy",
      title: `Missing ${topic} policy coverage`,
      detail: `AI agents may avoid recommending when ${topic} terms are unclear.`,
      impact: 78,
      effort: 35
    })),
    ...contradictionSignals.map((detail) => ({
      severity: "high",
      area: "policy",
      title: "Contradictory policy language",
      detail,
      impact: 81,
      effort: 45
    }))
  ];

  const score = clamp(Math.round((coverage.ratio * 100) - (contradictionSignals.length * 18)), 0, 100);
  return {
    score,
    issues,
    metrics: {
      topicCoverage: Number(coverage.ratio.toFixed(2)),
      coveredTopics: coverage.covered,
      missingTopics: coverage.missing,
      contradictionCount: contradictionSignals.length
    }
  };
}

function evaluateFaqs(faqs, criticalTopics) {
  const faqTexts = Array.isArray(faqs)
    ? faqs.map((item) => `${item.question || ""} ${item.answer || ""}`)
    : [];

  const coverage = keywordCoverage(faqTexts, criticalTopics);
  const vagueAnswerCount = (Array.isArray(faqs) ? faqs : []).filter((item) => {
    const answer = normalizeText(item.answer);
    return answer.length > 0 && answer.length < 30;
  }).length;

  const issues = [
    ...coverage.missing.map((topic) => ({
      severity: "medium",
      area: "faq",
      title: `FAQ gap: ${topic}`,
      detail: `Add a FAQ entry for ${topic} to improve agent confidence.`,
      impact: 59,
      effort: 20
    }))
  ];

  if (vagueAnswerCount > 0) {
    issues.push({
      severity: "medium",
      area: "faq",
      title: "Vague FAQ answers",
      detail: `${vagueAnswerCount} FAQ answers are too short and likely unhelpful to retrieval models.`,
      impact: 48,
      effort: 22
    });
  }

  const score = clamp(Math.round((coverage.ratio * 100) - (vagueAnswerCount * 8)), 0, 100);
  return {
    score,
    issues,
    metrics: {
      faqCount: Array.isArray(faqs) ? faqs.length : 0,
      topicCoverage: Number(coverage.ratio.toFixed(2)),
      missingTopics: coverage.missing,
      vagueAnswerCount
    }
  };
}

function evaluateTrustSignals(reviews, trustSignals, benchmarkSignals) {
  const reviewCount = Array.isArray(reviews) ? reviews.length : 0;
  const avgRating = reviewCount
    ? reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / reviewCount
    : 0;

  const availableSignals = Array.isArray(trustSignals) ? trustSignals.map(normalizeText) : [];
  const preferredMatch = benchmarkSignals.filter((signal) => availableSignals.includes(signal.toLowerCase()));

  const issues = [];

  if (reviewCount < 10) {
    issues.push({
      severity: "high",
      area: "trust",
      title: "Low review volume",
      detail: "AI agents often rank merchants lower when social proof is sparse.",
      impact: 67,
      effort: 30
    });
  }

  if (avgRating > 0 && avgRating < 4.0) {
    issues.push({
      severity: "high",
      area: "trust",
      title: "Below-threshold average rating",
      detail: "Average rating below 4.0 can reduce recommendation likelihood.",
      impact: 63,
      effort: 50
    });
  }

  if (preferredMatch.length < Math.ceil(benchmarkSignals.length / 2)) {
    issues.push({
      severity: "medium",
      area: "trust",
      title: "Weak trust signal portfolio",
      detail: "Add stronger guarantees and verification cues for agent ranking models.",
      impact: 52,
      effort: 28
    });
  }

  const score = clamp(
    Math.round(
      Math.min(100, (avgRating / 5) * 45 + Math.min(40, reviewCount * 2.4) + (preferredMatch.length / Math.max(1, benchmarkSignals.length)) * 15)
    ),
    0,
    100
  );

  return {
    score,
    issues,
    metrics: {
      reviewCount,
      avgRating: Number(avgRating.toFixed(2)),
      preferredSignalMatches: preferredMatch,
      totalTrustSignals: availableSignals.length
    }
  };
}

function evaluateStructuredData(structuredData = {}) {
  const required = ["schemaOrgProduct", "schemaOrgOrganization", "openGraph", "jsonLdBreadcrumbs"];
  const missing = required.filter((field) => !structuredData[field]);

  const issues = missing.map((field) => ({
    severity: "medium",
    area: "structured-data",
    title: `Missing ${field}`,
    detail: "Structured markup gaps reduce machine-readability for shopping agents.",
    impact: 46,
    effort: 18
  }));

  const score = clamp(Math.round(((required.length - missing.length) / required.length) * 100), 0, 100);
  return {
    score,
    issues,
    metrics: {
      coverage: Number(((required.length - missing.length) / required.length).toFixed(2)),
      missing
    }
  };
}

function generatePerceptionSummary(results, storeProfile, desiredRepresentation) {
  const current = {
    valueProp: results.productClarity.score >= 70
      ? "Products are moderately understandable to AI agents."
      : "Products are under-described, making recommendations uncertain.",
    trust: results.trustSignals.score >= 65
      ? "Trust profile is acceptable but can be stronger."
      : "Trust indicators are weak and may suppress recommendations.",
    reliability: results.policyCoverage.score >= 75
      ? "Policies are mostly complete and machine-readable."
      : "Policy ambiguity risks merchant misrepresentation.",
    likelyAgentNarrative: results.overallScore >= 75
      ? `${storeProfile.storeName} appears as a dependable option with fair confidence.`
      : `${storeProfile.storeName} may be skipped or presented with caveats by AI shopping agents.`
  };

  const desired = {
    merchantDesiredNarrative:
      desiredRepresentation.narrative ||
      `${storeProfile.storeName} wants to be represented as premium, transparent, and dependable.`,
    targetAudience: desiredRepresentation.targetAudience || "Underspecified",
    requiredTrustSignals: desiredRepresentation.requiredTrustSignals || [],
    primaryConversionGoal: desiredRepresentation.primaryConversionGoal || "Increase high-intent product recommendations"
  };

  const gaps = [];

  if (results.policyCoverage.metrics.missingTopics.length > 0) {
    gaps.push("Policy topic coverage is incomplete vs desired transparent brand positioning.");
  }
  if (results.trustSignals.metrics.reviewCount < 10) {
    gaps.push("Social proof volume is below agent-friendly threshold.");
  }
  if (results.faqCoverage.metrics.missingTopics.length > 0) {
    gaps.push("FAQ coverage does not yet answer likely pre-purchase agent queries.");
  }

  if (gaps.length === 0) {
    gaps.push("Current representation is mostly aligned with desired narrative.");
  }

  return {
    current,
    desired,
    representationGaps: gaps
  };
}

function issuePriorityScore(issue) {
  const severityWeight = {
    critical: 1.35,
    high: 1.15,
    medium: 1,
    low: 0.85
  };
  const weightedImpact = issue.impact * (severityWeight[issue.severity] || 1);
  const effortPenalty = issue.effort * 0.45;
  return Number((weightedImpact - effortPenalty).toFixed(1));
}

function rankActionPlan(issues) {
  return issues
    .map((issue, index) => ({
      id: `A-${index + 1}`,
      ...issue,
      priorityScore: issuePriorityScore(issue)
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((issue, index) => ({
      ...issue,
      rank: index + 1,
      recommendation: buildRecommendation(issue)
    }));
}

function buildRecommendation(issue) {
  switch (issue.area) {
    case "product-data":
      return "Standardize product templates with required attributes and evidence-backed claims.";
    case "policy":
      return "Rewrite policy content into explicit, non-conflicting clauses and publish in dedicated pages.";
    case "faq":
      return "Add intent-specific FAQs that mirror real shopping-agent questions.";
    case "trust":
      return "Increase review capture and expose guarantees/verification badges near product decisions.";
    case "structured-data":
      return "Ship missing schema.org and Open Graph markup with validation in CI.";
    default:
      return "Resolve this issue with clear, machine-readable store content updates.";
  }
}

function overallScoreFrom(results, weights) {
  return clamp(
    Math.round(
      results.productClarity.score * weights.productClarity +
      results.trustSignals.score * weights.trustSignals +
      results.policyCoverage.score * weights.policyCoverage +
      results.faqCoverage.score * weights.faqCoverage +
      results.technicalStructuredData.score * weights.technicalStructuredData
    ),
    0,
    100
  );
}

function readinessBand(score) {
  if (score >= 85) return "excellent";
  if (score >= 70) return "strong";
  if (score >= 50) return "developing";
  return "at-risk";
}

function analyzeStore(payload = {}) {
  const storeProfile = payload.storeProfile || { storeName: "Unnamed Store", category: "general" };
  const desiredRepresentation = payload.desiredRepresentation || {};
  const category = normalizeText(storeProfile.category);
  const benchmark = CATEGORY_BENCHMARKS[category] || CATEGORY_BENCHMARKS.general;

  const productClarity = evaluateProducts(payload.products, benchmark.requiredProductFields);
  const policyCoverage = evaluatePolicies(payload.policies, benchmark.policyTopics);
  const faqCoverage = evaluateFaqs(payload.faqs, benchmark.criticalFaqTopics);
  const trustSignals = evaluateTrustSignals(payload.reviews, payload.trustSignals, benchmark.preferredTrustSignals);
  const technicalStructuredData = evaluateStructuredData(payload.structuredData);

  const results = {
    productClarity,
    policyCoverage,
    faqCoverage,
    trustSignals,
    technicalStructuredData
  };

  const overallScore = overallScoreFrom(results, DEFAULT_WEIGHTS);
  const allIssues = [
    ...productClarity.issues,
    ...policyCoverage.issues,
    ...faqCoverage.issues,
    ...trustSignals.issues,
    ...technicalStructuredData.issues
  ];

  const prioritizedActions = rankActionPlan(allIssues);
  const perception = generatePerceptionSummary(
    { ...results, overallScore },
    storeProfile,
    desiredRepresentation
  );

  return {
    generatedAt: new Date().toISOString(),
    storeProfile,
    overallScore,
    readinessBand: readinessBand(overallScore),
    scoreBreakdown: {
      productClarity: productClarity.score,
      trustSignals: trustSignals.score,
      policyCoverage: policyCoverage.score,
      faqCoverage: faqCoverage.score,
      technicalStructuredData: technicalStructuredData.score
    },
    metrics: {
      product: productClarity.metrics,
      policy: policyCoverage.metrics,
      faq: faqCoverage.metrics,
      trust: trustSignals.metrics,
      structuredData: technicalStructuredData.metrics
    },
    issues: allIssues,
    prioritizedActions,
    perception,
    explanation: {
      scoringWeights: DEFAULT_WEIGHTS,
      methodology:
        "Heuristic scoring combines content completeness, contradiction detection, trust indicators, FAQ intent coverage, and structured-data availability."
    }
  };
}

module.exports = {
  analyzeStore
};
