const express = require("express");
const path = require("path");
const fs = require("fs");
const { agenticAnalyzeStore } = require("./agenticAnalyzer");
const { connectShopifyStore } = require("./shopifyConnector");
const { generateMerchantAiResponse } = require("./ollama");

const app = express();
const PORT = process.env.PORT || 5177;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get("/api/sample-store", (req, res) => {
  const samplePath = path.join(__dirname, "..", "data", "sampleStore.json");
  try {
    const raw = fs.readFileSync(samplePath, "utf8");
    const json = JSON.parse(raw);
    res.json(json);
  } catch (error) {
    res.status(500).json({
      error: "Could not load sample store",
      details: error.message
    });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    const analysis = await agenticAnalyzeStore(req.body);
    const aiResponse = await generateMerchantAiResponse(analysis);
    res.json({
      ...analysis,
      aiResponse
    });
  } catch (error) {
    res.status(400).json({
      error: "Analysis failed",
      details: error.message
    });
  }
});

app.post("/api/connect-shopify", async (req, res) => {
  try {
    const { url } = req.body || {};
    const connectedStore = await connectShopifyStore(url);
    res.json(connectedStore);
  } catch (error) {
    res.status(400).json({
      error: "Could not connect to Shopify store",
      details: error.message
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`AI Representation Optimizer running on http://localhost:${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && !process.env.PORT) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use, retrying on ${nextPort}...`);
      startServer(nextPort);
      return;
    }

    throw error;
  });
}

startServer(PORT);
