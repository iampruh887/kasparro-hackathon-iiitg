const payloadInput = document.getElementById("payloadInput");
const storeUrlInput = document.getElementById("storeUrlInput");
const statusEl = document.getElementById("status");
const analyzeBtn = document.getElementById("analyzeBtn");
const connectBtn = document.getElementById("connectBtn");
const emptyState = document.getElementById("emptyState");
const resultsWrapper = document.getElementById("results");
const dashboardSubtitle = document.getElementById("dashboardSubtitle");
const sourcePill = document.getElementById("sourcePill");

const overallScoreEl = document.getElementById("overallScore");
const readinessBandEl = document.getElementById("readinessBand");
const issueCountStatEl = document.getElementById("issueCountStat");
const criticalIssueStatEl = document.getElementById("criticalIssueStat");
const topActionStatEl = document.getElementById("topActionStat");
const aiModelStatEl = document.getElementById("aiModelStat");
const aiConfidenceStatEl = document.getElementById("aiConfidenceStat");
const executionSpeedStatEl = document.getElementById("executionSpeedStat");
const executionStabilityStatEl = document.getElementById("executionStabilityStat");
const scoreProductEl = document.getElementById("scoreProduct");
const scoreTrustEl = document.getElementById("scoreTrust");
const scorePolicyEl = document.getElementById("scorePolicy");
const scoreFaqEl = document.getElementById("scoreFaq");
const scoreStructuredEl = document.getElementById("scoreStructured");
const barProductEl = document.getElementById("barProduct");
const barTrustEl = document.getElementById("barTrust");
const barPolicyEl = document.getElementById("barPolicy");
const barFaqEl = document.getElementById("barFaq");
const barStructuredEl = document.getElementById("barStructured");
const issueListEl = document.getElementById("issueList");
const actionTableBody = document.getElementById("actionTableBody");
const currentNarrativeEl = document.getElementById("currentNarrative");
const desiredNarrativeEl = document.getElementById("desiredNarrative");
const representationGapsEl = document.getElementById("representationGaps");
const aiNarrativeEl = document.getElementById("aiNarrative");
const merchantReplyEl = document.getElementById("merchantReply");
const topRecommendationEl = document.getElementById("topRecommendation");
const trustAssessmentEl = document.getElementById("trustAssessment");
const confidenceNotesEl = document.getElementById("confidenceNotes");
const objectiveGridEl = document.getElementById("objectiveGrid");
const archModeEl = document.getElementById("archMode");
const runtimeMsEl = document.getElementById("runtimeMs");
const consistencyBandEl = document.getElementById("consistencyBand");
const executionSummaryEl = document.getElementById("executionSummary");

let analyzeController = null;
let connectController = null;

function setStatus(message, kind = "neutral") {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`;
}

function listToHtml(items) {
  return items.map((item) => `<li>${item}</li>`).join("");
}

function setBarWidth(element, value) {
  element.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
}

function severityCount(issues, severity) {
  return issues.filter((issue) => issue.severity === severity).length;
}

function objectiveCardHtml(objective) {
  return `
    <article class="objective-card">
      <p class="objective-head">${objective.title}</p>
      <p class="objective-desc">${objective.objective}</p>
      <p class="objective-meta">${objective.context || ""}</p>
      <div class="objective-foot">
        <span class="objective-status objective-status-${objective.status}">${objective.status.replace("-", " ")}</span>
        <span class="objective-score">${objective.score}</span>
      </div>
    </article>
  `;
}

function renderResults(data) {
  emptyState.classList.add("hidden");
  resultsWrapper.classList.remove("hidden");

  const storeName = data.storeProfile?.storeName || "Merchant Dashboard";
  const storeCategory = data.storeProfile?.category || "general";
  dashboardSubtitle.textContent = `${storeName} · ${storeCategory} · updated ${new Date(data.generatedAt).toLocaleString()}`;
  sourcePill.textContent = data.storeProfile?.sourceUrl ? `Connected: ${data.storeProfile.sourceUrl}` : "Manual JSON";

  overallScoreEl.textContent = data.overallScore;
  readinessBandEl.textContent = data.readinessBand;
  readinessBandEl.className = `chip chip-${data.readinessBand}`;

  issueCountStatEl.textContent = data.issues.length;
  criticalIssueStatEl.textContent = `${severityCount(data.issues, "critical")} critical · ${severityCount(data.issues, "high")} high`;
  topActionStatEl.textContent = data.prioritizedActions[0]?.title || "No actions detected";
  aiModelStatEl.textContent = data.aiResponse?.model || "No model returned";
  aiConfidenceStatEl.textContent = data.aiResponse?.parsed?.confidenceNotes || "";
  executionSpeedStatEl.textContent = `${data.agentic?.run?.totalDurationMs ?? 0} ms`;
  executionStabilityStatEl.textContent = data.agentic?.runtime?.browserStabilityHint || "No stability hint";

  scoreProductEl.textContent = data.scoreBreakdown.productClarity;
  scoreTrustEl.textContent = data.scoreBreakdown.trustSignals;
  scorePolicyEl.textContent = data.scoreBreakdown.policyCoverage;
  scoreFaqEl.textContent = data.scoreBreakdown.faqCoverage;
  scoreStructuredEl.textContent = data.scoreBreakdown.technicalStructuredData;

  setBarWidth(barProductEl, data.scoreBreakdown.productClarity);
  setBarWidth(barTrustEl, data.scoreBreakdown.trustSignals);
  setBarWidth(barPolicyEl, data.scoreBreakdown.policyCoverage);
  setBarWidth(barFaqEl, data.scoreBreakdown.faqCoverage);
  setBarWidth(barStructuredEl, data.scoreBreakdown.technicalStructuredData);

  issueListEl.innerHTML = data.issues
    .map((issue) => {
      return `
        <li class="issue-item">
          <p class="issue-head"><span class="sev sev-${issue.severity}">${issue.severity}</span> ${issue.title}</p>
          <p class="issue-detail">${issue.detail}</p>
        </li>
      `;
    })
    .join("");

  actionTableBody.innerHTML = data.prioritizedActions
    .slice(0, 7)
    .map((action) => {
      return `
        <tr>
          <td>${action.rank}</td>
          <td>${action.title}</td>
          <td>${action.priorityScore}</td>
          <td>${action.recommendation}</td>
        </tr>
      `;
    })
    .join("");

  const currentLines = [
    data.perception.current.valueProp,
    data.perception.current.trust,
    data.perception.current.reliability,
    data.perception.current.likelyAgentNarrative
  ];
  currentNarrativeEl.innerHTML = listToHtml(currentLines);

  const desiredLines = [
    data.perception.desired.merchantDesiredNarrative,
    `Target audience: ${data.perception.desired.targetAudience}`,
    `Primary goal: ${data.perception.desired.primaryConversionGoal}`,
    `Required trust cues: ${(data.perception.desired.requiredTrustSignals || []).join(", ") || "None provided"}`
  ];
  desiredNarrativeEl.innerHTML = listToHtml(desiredLines);
  representationGapsEl.innerHTML = listToHtml(data.perception.representationGaps);

  const aiResponse = data.aiResponse?.parsed || {};
  aiNarrativeEl.textContent = aiResponse.aiNarrative || "No AI narrative returned.";
  merchantReplyEl.textContent = aiResponse.merchantReply || "No merchant reply returned.";
  topRecommendationEl.textContent = aiResponse.topRecommendation || "No top recommendation returned.";
  trustAssessmentEl.textContent = aiResponse.trustAssessment || "No trust assessment returned.";
  confidenceNotesEl.textContent = aiResponse.confidenceNotes || "No confidence notes returned.";

  const objectives = Array.isArray(data.agentic?.objectives) ? data.agentic.objectives : [];
  objectiveGridEl.innerHTML = objectives.length > 0
    ? objectives.map((objective) => objectiveCardHtml(objective)).join("")
    : "<p class=\"panel-copy\">No objective data available.</p>";

  archModeEl.textContent = data.agentic?.run?.architecture?.mode || "--";
  runtimeMsEl.textContent = `${data.agentic?.run?.totalDurationMs ?? 0} ms`;
  consistencyBandEl.textContent = data.agentic?.synthesis?.consistency?.confidenceBand || "--";
  executionSummaryEl.textContent = data.agentic?.synthesis?.executiveSummary || "No execution summary available.";
}

async function analyze() {
  let payload;
  try {
    payload = JSON.parse(payloadInput.value);
  } catch (error) {
    setStatus("Input is not valid JSON.", "error");
    return;
  }

  setStatus("Analyzing store representation...", "neutral");
  analyzeBtn.disabled = true;
  connectBtn.disabled = true;

  if (analyzeController) {
    analyzeController.abort();
  }
  analyzeController = new AbortController();

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: analyzeController.signal
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    const data = await response.json();
    renderResults(data);
    setStatus("Analysis complete.", "success");
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("Previous analysis cancelled.", "neutral");
    } else {
      setStatus(`Analysis failed: ${error.message}`, "error");
    }
  } finally {
    analyzeBtn.disabled = false;
    connectBtn.disabled = false;
  }
}

function initializeDashboard() {
  payloadInput.value = "";
  dashboardSubtitle.textContent = "Connect a Shopify store or paste merchant JSON to populate the dashboard.";
  sourcePill.textContent = "No store connected";
}

async function connectStore() {
  const url = storeUrlInput.value.trim();
  if (!url) {
    setStatus("Enter a Shopify store or product URL first.", "error");
    return;
  }

  connectBtn.disabled = true;
  analyzeBtn.disabled = true;
  setStatus("Connecting to Shopify store...", "neutral");

  if (connectController) {
    connectController.abort();
  }
  connectController = new AbortController();

  try {
    const response = await fetch("/api/connect-shopify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: connectController.signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details || `Request failed with ${response.status}`);
    }

    const connectedStore = await response.json();
    payloadInput.value = JSON.stringify(connectedStore, null, 2);
    setStatus("Store connected. Review the payload or run analysis.", "success");
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("Previous connection cancelled.", "neutral");
    } else {
      setStatus(`Connection failed: ${error.message}`, "error");
    }
  } finally {
    connectBtn.disabled = false;
    analyzeBtn.disabled = false;
  }
}

analyzeBtn.addEventListener("click", analyze);
connectBtn.addEventListener("click", connectStore);

initializeDashboard();
