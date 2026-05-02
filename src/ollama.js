const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:latest";
const DEFAULT_FALLBACK_MODEL = process.env.OLLAMA_FALLBACK_MODEL || "gemma3:latest";

function buildPrompt(analysis) {
  const payload = {
    storeName: analysis?.storeProfile?.storeName || "Unknown store",
    category: analysis?.storeProfile?.category || "general",
    overallScore: analysis?.overallScore,
    readinessBand: analysis?.readinessBand,
    scoreBreakdown: analysis?.scoreBreakdown,
    topIssues: (analysis?.prioritizedActions || []).slice(0, 5).map((issue) => ({
      title: issue.title,
      area: issue.area,
      severity: issue.severity,
      recommendation: issue.recommendation
    })),
    perception: analysis?.perception,
    desiredRepresentation: analysis?.perception?.desired,
    sourceFacts: analysis?.metrics
  };

  return [
    "You are an expert ecommerce analyst helping a merchant understand how an AI shopping agent would describe their store.",
    "Use only the supplied facts. Do not invent policies, reviews, or product details.",
    "Return strict JSON with these keys: aiNarrative, merchantReply, topRecommendation, trustAssessment, confidenceNotes.",
    "Keep each field concise, concrete, and merchant-facing.",
    `STORE ANALYSIS JSON: ${JSON.stringify(payload)}`
  ].join("\n\n");
}

function extractJsonFromText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new Error("Empty model response.");
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Model response did not contain JSON.");
  }

  const candidate = trimmed.slice(firstBrace, lastBrace + 1);
  return JSON.parse(candidate);
}

async function generateOllamaResponse(analysis) {
  const response = await fetch(`${DEFAULT_OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: DEFAULT_OLLAMA_MODEL,
      stream: false,
      format: "json",
      messages: [
        {
          role: "system",
          content: "You produce compact, structured ecommerce analysis for merchants."
        },
        {
          role: "user",
          content: buildPrompt(analysis)
        }
      ],
      options: {
        temperature: 0.3
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Ollama request failed with status ${response.status}${errorText ? `: ${errorText}` : ""}`);
  }

  const data = await response.json();
  const content = data?.message?.content || "";
  const parsed = extractJsonFromText(content);

  return {
    model: DEFAULT_OLLAMA_MODEL,
    baseUrl: DEFAULT_OLLAMA_BASE_URL,
    rawText: content,
    parsed
  };
}

async function fetchAvailableModels() {
  try {
    const response = await fetch(`${DEFAULT_OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return Array.isArray(data?.models) ? data.models.map((model) => model.name).filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

async function generateWithFallbackModel(analysis) {
  const availableModels = await fetchAvailableModels();
  const fallbackCandidates = [DEFAULT_FALLBACK_MODEL, ...availableModels].filter(
    (model, index, list) => model && list.indexOf(model) === index && model !== DEFAULT_OLLAMA_MODEL
  );

  for (const model of fallbackCandidates) {
    try {
      const response = await fetch(`${DEFAULT_OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          stream: false,
          format: "json",
          messages: [
            {
              role: "system",
              content: "You produce compact, structured ecommerce analysis for merchants."
            },
            {
              role: "user",
              content: buildPrompt(analysis)
            }
          ],
          options: {
            temperature: 0.3
          }
        })
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const content = data?.message?.content || "";
      const parsed = extractJsonFromText(content);

      return {
        model,
        baseUrl: DEFAULT_OLLAMA_BASE_URL,
        rawText: content,
        parsed,
        fallbackFrom: DEFAULT_OLLAMA_MODEL
      };
    } catch (error) {
      // Try the next local model.
    }
  }

  throw new Error(`No usable Ollama model was available after trying ${DEFAULT_OLLAMA_MODEL} and fallbacks.`);
}

function fallbackOllamaResponse(analysis, error) {
  return {
    model: DEFAULT_OLLAMA_MODEL,
    baseUrl: DEFAULT_OLLAMA_BASE_URL,
    error: error.message,
    parsed: {
      aiNarrative: `${analysis?.storeProfile?.storeName || "This store"} is currently presented with limited certainty by shopping agents.`,
      merchantReply: "Improve the highest-ranked content gaps to make the store easier for AI systems to recommend.",
      topRecommendation: (analysis?.prioritizedActions || [])[0]?.recommendation || "Fix the most visible content gap first.",
      trustAssessment: "Trust is being judged from the available public signals and may be constrained by missing or conflicting details.",
      confidenceNotes: "Local Ollama was unavailable or returned non-JSON output, so this is a deterministic fallback."
    }
  };
}

async function generateMerchantAiResponse(analysis) {
  try {
    return await generateOllamaResponse(analysis);
  } catch (error) {
    if (/memory|load|ollama/i.test(error.message)) {
      try {
        return await generateWithFallbackModel(analysis);
      } catch (fallbackError) {
        return fallbackOllamaResponse(analysis, fallbackError);
      }
    }

    return fallbackOllamaResponse(analysis, error);
  }
}

module.exports = {
  generateMerchantAiResponse
};
