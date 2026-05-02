const { analyzeStore } = require("./analyzer");

const MAX_VERIFICATION_LOOPS = Number(process.env.AGENTIC_MAX_LOOPS || 3);

function nowMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}

function createRunMeta() {
  return {
    runId: `run_${Date.now().toString(36)}`,
    startedAt: new Date().toISOString(),
    totalDurationMs: 0,
    stageTimingsMs: {},
    architecture: {
      mode: "agentic-verified-loop",
      stages: [
        "intake-agent",
        "signal-extraction-agent",
        "risk-scoring-agent",
        "verification-agent",
        "refinement-agent",
        "prioritization-agent",
        "consistency-agent",
        "synthesis-agent"
      ],
      maxVerificationLoops: MAX_VERIFICATION_LOOPS
    }
  };
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function runIntakeAgent(payload) {
  const safe = payload && typeof payload === "object" ? payload : {};

  return {
    storeProfile: safe.storeProfile || { storeName: "Unnamed Store", category: "general" },
    desiredRepresentation: safe.desiredRepresentation || {},
    products: Array.isArray(safe.products) ? safe.products : [],
    policies: Array.isArray(safe.policies) ? safe.policies : [],
    faqs: Array.isArray(safe.faqs) ? safe.faqs : [],
    reviews: Array.isArray(safe.reviews) ? safe.reviews : [],
    trustSignals: Array.isArray(safe.trustSignals) ? safe.trustSignals : [],
    structuredData: safe.structuredData || {}
  };
}

function runSignalExtractionAgent(normalizedPayload) {
  const productCount = normalizedPayload.products.length;
  const policyCount = normalizedPayload.policies.length;
  const faqCount = normalizedPayload.faqs.length;
  const reviewCount = normalizedPayload.reviews.length;
  const trustSignalCount = normalizedPayload.trustSignals.length;

  const structuredFlags = Object.values(normalizedPayload.structuredData || {}).filter(Boolean).length;

  const completenessVector = {
    catalog: productCount > 0 ? "present" : "missing",
    policy: policyCount > 0 ? "present" : "missing",
    faq: faqCount > 0 ? "present" : "missing",
    socialProof: reviewCount > 0 ? "present" : "missing",
    machineReadable: structuredFlags > 0 ? "present" : "missing"
  };

  return {
    productCount,
    policyCount,
    faqCount,
    reviewCount,
    trustSignalCount,
    structuredFlags,
    completenessVector
  };
}

function runPrioritizationAgent(prioritizedActions) {
  const quickWins = [];
  const strategicBets = [];

  prioritizedActions.forEach((action) => {
    const bucket = action.effort <= 25 ? quickWins : strategicBets;
    if (bucket.length < 3) {
      bucket.push({
        title: action.title,
        recommendation: action.recommendation,
        priorityScore: action.priorityScore,
        effort: action.effort
      });
    }
  });

  return {
    quickWins,
    strategicBets
  };
}

function runVerificationAgent(analysis, extractedSignals) {
  const checks = [];
  const failures = [];

  const overallScoreValid = Number.isFinite(analysis.overallScore) && analysis.overallScore >= 0 && analysis.overallScore <= 100;
  checks.push({ name: "overall-score-range", passed: overallScoreValid });
  if (!overallScoreValid) {
    failures.push("overallScore is out of bounds");
  }

  const breakdown = analysis.scoreBreakdown || {};
  const breakdownKeys = ["productClarity", "trustSignals", "policyCoverage", "faqCoverage", "technicalStructuredData"];
  const breakdownValid = breakdownKeys.every((key) => Number.isFinite(breakdown[key]) && breakdown[key] >= 0 && breakdown[key] <= 100);
  checks.push({ name: "score-breakdown-range", passed: breakdownValid });
  if (!breakdownValid) {
    failures.push("scoreBreakdown contains invalid values");
  }

  const issues = Array.isArray(analysis.issues) ? analysis.issues : [];
  const actions = Array.isArray(analysis.prioritizedActions) ? analysis.prioritizedActions : [];

  const hasActionCoverage = issues.length === 0 || actions.length > 0;
  checks.push({ name: "issue-action-coverage", passed: hasActionCoverage });
  if (!hasActionCoverage) {
    failures.push("issues were detected but no prioritized actions were generated");
  }

  const actionOrderValid = actions.every((item, index, list) => index === 0 || (Number(item.priorityScore) || 0) <= (Number(list[index - 1].priorityScore) || 0));
  checks.push({ name: "action-ordering", passed: actionOrderValid });
  if (!actionOrderValid) {
    failures.push("prioritizedActions are not ordered by priorityScore descending");
  }

  const contradictionCount = analysis.metrics?.policy?.contradictionCount || 0;
  const contradictionSignalValid = contradictionCount === 0 || extractedSignals.policyCount > 0;
  checks.push({ name: "contradiction-context", passed: contradictionSignalValid });
  if (!contradictionSignalValid) {
    failures.push("policy contradiction was detected without policy context");
  }

  const passCount = checks.filter((check) => check.passed).length;
  const qualityScore = Math.round((passCount / checks.length) * 100);

  return {
    passed: failures.length === 0,
    qualityScore,
    checks,
    failures
  };
}

function derivePriorityScore(issue) {
  const severityWeight = {
    critical: 1.35,
    high: 1.15,
    medium: 1,
    low: 0.85
  };
  const weightedImpact = (Number(issue.impact) || 0) * (severityWeight[issue.severity] || 1);
  const effortPenalty = (Number(issue.effort) || 0) * 0.45;
  return Number((weightedImpact - effortPenalty).toFixed(1));
}

function buildDefaultRecommendation(area) {
  switch (area) {
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

function runRefinementAgent(analysis) {
  const sanitizedIssues = (Array.isArray(analysis.issues) ? analysis.issues : []).map((issue) => ({
    severity: issue?.severity || "medium",
    area: issue?.area || "general",
    title: issue?.title || "Unspecified issue",
    detail: issue?.detail || "No detail provided.",
    impact: clamp(Number(issue?.impact) || 0, 0, 100),
    effort: clamp(Number(issue?.effort) || 0, 0, 100)
  }));

  const reprioritizedActions = sanitizedIssues
    .map((issue, index) => {
      const priorityScore = derivePriorityScore(issue);
      return {
        id: `A-${index + 1}`,
        ...issue,
        priorityScore,
        recommendation: issue.recommendation || buildDefaultRecommendation(issue.area)
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((action, index) => ({
      ...action,
      rank: index + 1
    }));

  const scoreBreakdown = {
    productClarity: clamp(Math.round(Number(analysis.scoreBreakdown?.productClarity) || 0), 0, 100),
    trustSignals: clamp(Math.round(Number(analysis.scoreBreakdown?.trustSignals) || 0), 0, 100),
    policyCoverage: clamp(Math.round(Number(analysis.scoreBreakdown?.policyCoverage) || 0), 0, 100),
    faqCoverage: clamp(Math.round(Number(analysis.scoreBreakdown?.faqCoverage) || 0), 0, 100),
    technicalStructuredData: clamp(Math.round(Number(analysis.scoreBreakdown?.technicalStructuredData) || 0), 0, 100)
  };

  const weights = {
    productClarity: 0.28,
    trustSignals: 0.24,
    policyCoverage: 0.2,
    faqCoverage: 0.13,
    technicalStructuredData: 0.15
  };

  const refinedOverallScore = clamp(
    Math.round(
      scoreBreakdown.productClarity * weights.productClarity +
      scoreBreakdown.trustSignals * weights.trustSignals +
      scoreBreakdown.policyCoverage * weights.policyCoverage +
      scoreBreakdown.faqCoverage * weights.faqCoverage +
      scoreBreakdown.technicalStructuredData * weights.technicalStructuredData
    ),
    0,
    100
  );

  const refinedBand = refinedOverallScore >= 85
    ? "excellent"
    : refinedOverallScore >= 70
      ? "strong"
      : refinedOverallScore >= 50
        ? "developing"
        : "at-risk";

  return {
    ...analysis,
    overallScore: refinedOverallScore,
    readinessBand: refinedBand,
    issues: sanitizedIssues,
    prioritizedActions: reprioritizedActions,
    scoreBreakdown,
    explanation: {
      ...(analysis.explanation || {}),
      verificationRefined: true
    }
  };
}

function runConsistencyAgent(analysis) {
  const criticalCount = analysis.issues.filter((issue) => issue.severity === "critical").length;
  const highCount = analysis.issues.filter((issue) => issue.severity === "high").length;
  const contradictionCount = analysis.metrics?.policy?.contradictionCount || 0;

  const confidence = Math.max(
    0,
    Math.min(
      100,
      92 - criticalCount * 12 - highCount * 4 - contradictionCount * 9
    )
  );

  return {
    confidence,
    confidenceBand: confidence >= 75 ? "high" : confidence >= 50 ? "medium" : "low",
    riskSummary: {
      criticalCount,
      highCount,
      contradictionCount
    }
  };
}

function runSynthesisAgent(analysis, extractedSignals, strategy, consistency) {
  const topAction = analysis.prioritizedActions[0];
  const narrative = [
    `${analysis.storeProfile.storeName} is in the ${analysis.readinessBand} readiness band at ${analysis.overallScore}/100.`,
    `Coverage snapshot: ${extractedSignals.productCount} products, ${extractedSignals.policyCount} policies, ${extractedSignals.faqCount} FAQs, ${extractedSignals.reviewCount} reviews.`,
    topAction ? `Highest-priority action: ${topAction.title}.` : "No high-priority actions were detected."
  ].join(" ");

  return {
    executiveSummary: narrative,
    strategy,
    consistency
  };
}

function deriveAnalysisObjectives(analysis, extractedSignals, consistency) {
  const objectives = [
    {
      id: "OBJ-COVERAGE",
      title: "Catalog and policy coverage",
      objective: "Ensure core merchant data is sufficiently complete for agent retrieval.",
      score: Math.round((analysis.scoreBreakdown.productClarity + analysis.scoreBreakdown.policyCoverage + analysis.scoreBreakdown.faqCoverage) / 3)
    },
    {
      id: "OBJ-TRUST",
      title: "Trust signal reliability",
      objective: "Improve trust evidence quality for recommendation confidence.",
      score: Math.round(analysis.scoreBreakdown.trustSignals)
    },
    {
      id: "OBJ-TECHNICAL",
      title: "Machine-readability",
      objective: "Strengthen structured data and machine parse quality.",
      score: Math.round(analysis.scoreBreakdown.technicalStructuredData)
    },
    {
      id: "OBJ-CONSISTENCY",
      title: "Decision stability",
      objective: "Reduce contradictory or high-risk signals that destabilize agent output.",
      score: Math.round(consistency.confidence)
    }
  ];

  return objectives.map((item) => ({
    ...item,
    status: item.score >= 75 ? "on-track" : item.score >= 55 ? "watch" : "off-track",
    context: `${extractedSignals.productCount} products · ${extractedSignals.policyCount} policies · ${extractedSignals.faqCount} FAQs`
  }));
}

async function agenticAnalyzeStore(payload) {
  const run = createRunMeta();
  const start = nowMs();

  const t0 = nowMs();
  const normalizedPayload = runIntakeAgent(payload);
  run.stageTimingsMs.intakeAgent = nowMs() - t0;

  const signalStart = nowMs();
  const scoringStart = nowMs();

  const [extractedSignals, initialAnalysis] = await Promise.all([
    Promise.resolve(runSignalExtractionAgent(normalizedPayload)).finally(() => {
      run.stageTimingsMs.signalExtractionAgent = nowMs() - signalStart;
    }),
    Promise.resolve(analyzeStore(normalizedPayload)).finally(() => {
      run.stageTimingsMs.riskScoringAgent = nowMs() - scoringStart;
    })
  ]);

  const verificationStart = nowMs();
  const refinementStart = nowMs();
  let verificationLoops = 0;
  let analysis = initialAnalysis;
  let verification = runVerificationAgent(analysis, extractedSignals);
  const loopTrace = [];

  while (!verification.passed && verificationLoops < MAX_VERIFICATION_LOOPS) {
    verificationLoops += 1;
    loopTrace.push({
      iteration: verificationLoops,
      status: "failed",
      qualityScore: verification.qualityScore,
      failures: verification.failures
    });

    analysis = runRefinementAgent(analysis);
    verification = runVerificationAgent(analysis, extractedSignals);
  }

  if (verification.passed) {
    loopTrace.push({
      iteration: verificationLoops + 1,
      status: "passed",
      qualityScore: verification.qualityScore,
      failures: []
    });
  }

  run.stageTimingsMs.verificationAgent = nowMs() - verificationStart;
  run.stageTimingsMs.refinementAgent = verificationLoops > 0 ? nowMs() - refinementStart : 0;

  const t2 = nowMs();
  const strategy = runPrioritizationAgent(analysis.prioritizedActions || []);
  run.stageTimingsMs.prioritizationAgent = nowMs() - t2;

  const t3 = nowMs();
  const consistency = runConsistencyAgent(analysis);
  run.stageTimingsMs.consistencyAgent = nowMs() - t3;

  const t4 = nowMs();
  const synthesis = runSynthesisAgent(analysis, extractedSignals, strategy, consistency);
  run.stageTimingsMs.synthesisAgent = nowMs() - t4;

  const objectives = deriveAnalysisObjectives(analysis, extractedSignals, consistency);

  run.totalDurationMs = nowMs() - start;

  return {
    ...analysis,
    agentic: {
      run,
      extractedSignals,
      synthesis,
      objectives,
      verification: {
        passed: verification.passed,
        qualityScore: verification.qualityScore,
        loopCount: verificationLoops,
        checks: verification.checks,
        loopTrace
      },
      runtime: {
        throughput: run.totalDurationMs <= 35 ? "fast" : run.totalDurationMs <= 80 ? "balanced" : "heavy",
        browserStabilityHint:
          consistency.confidenceBand === "high"
            ? "Stable for iterative runs"
            : consistency.confidenceBand === "medium"
              ? "Stable with moderate variability"
              : "High variance risk due to critical/high issues"
      }
    }
  };
}

module.exports = {
  agenticAnalyzeStore
};
