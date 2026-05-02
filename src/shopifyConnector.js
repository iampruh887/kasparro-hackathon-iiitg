const { URL } = require("url");

function normalizeInputUrl(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) {
    throw new Error("A Shopify store or product URL is required.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  return parsed;
}

function originFromUrl(inputUrl) {
  const parsed = normalizeInputUrl(inputUrl);
  return `${parsed.protocol}//${parsed.host}`;
}

function extractProductHandle(inputUrl) {
  try {
    const parsed = normalizeInputUrl(inputUrl);
    const match = parsed.pathname.match(/\/products\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]) : null;
  } catch (error) {
    return null;
  }
}

function textFromHtml(html, selectorPattern) {
  const match = html.match(selectorPattern);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function findMetaContent(html, propertyName) {
  const metaPattern = new RegExp(`<meta[^>]+(?:property|name)=["']${propertyName}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const match = html.match(metaPattern);
  return match ? match[1].trim() : "";
}

function parseJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return blocks
    .map((match) => {
      try {
        return JSON.parse(match[1]);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

function parseProductsFromJson(body) {
  const payload = typeof body === "string" ? JSON.parse(body) : body;
  const products = Array.isArray(payload.products)
    ? payload.products
    : payload.product
      ? [payload.product]
      : [];

  return products.map((product) => ({
    title: product.title,
    description: product.body_html ? product.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : product.body_html || "",
    price: product.variants && product.variants[0] ? product.variants[0].price : product.price,
    ingredients: product.tags || "",
    usage: product.handle ? `View product page for ${product.handle}` : ""
  }));
}

function parseStorePolicies(html) {
  const policies = [];
  const policyCandidates = [
    { type: "shipping", regex: /shipping[^<]{0,120}(<[^>]+>)*([^<]{20,240})/i },
    { type: "returns", regex: /return[^<]{0,120}(<[^>]+>)*([^<]{20,240})/i },
    { type: "privacy", regex: /privacy[^<]{0,120}(<[^>]+>)*([^<]{20,240})/i }
  ];

  policyCandidates.forEach((candidate) => {
    const match = html.match(candidate.regex);
    if (match && match[2]) {
      policies.push({ type: candidate.type, content: match[2].replace(/\s+/g, " ").trim() });
    }
  });

  return policies;
}

function parseFaqCandidates(html) {
  const faqs = [];
  const jsonLdBlocks = parseJsonLd(html);

  jsonLdBlocks.forEach((block) => {
    const blocks = Array.isArray(block) ? block : [block];
    blocks.forEach((item) => {
      if (item && item.mainEntity && Array.isArray(item.mainEntity)) {
        item.mainEntity.forEach((entity) => {
          if (entity && entity.name && entity.acceptedAnswer) {
            faqs.push({
              question: entity.name,
              answer: entity.acceptedAnswer.text || ""
            });
          }
        });
      }
    });
  });

  return faqs;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json,text/plain,*/*"
    }
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.text();
}

async function connectShopifyStore(inputUrl) {
  const parsed = normalizeInputUrl(inputUrl);
  const origin = `${parsed.protocol}//${parsed.host}`;
  const productHandle = extractProductHandle(inputUrl);

  const storeProfile = {
    storeName: textFromHtml(await fetchText(origin).catch(() => ""), /<title[^>]*>([^<]+)<\/title>/i) || parsed.host.replace(/^www\./i, ""),
    category: "general",
    region: "unknown",
    sourceUrl: origin
  };

  const products = [];
  const policies = [];
  const faqs = [];
  const trustSignals = [];
  const reviews = [];
  const structuredData = {
    schemaOrgProduct: false,
    schemaOrgOrganization: false,
    openGraph: false,
    jsonLdBreadcrumbs: false
  };

  const productEndpoints = productHandle
    ? [`${origin}/products/${encodeURIComponent(productHandle)}.js`]
    : [`${origin}/products.json?limit=12`, `${origin}/collections/all/products.json?limit=12`];

  for (const endpoint of productEndpoints) {
    try {
      const json = await fetchJson(endpoint);
      const parsedProducts = parseProductsFromJson(json);
      if (parsedProducts.length > 0) {
        products.push(...parsedProducts);
        break;
      }
    } catch (error) {
      // Try the next public Shopify endpoint.
    }
  }

  try {
    const homepage = await fetchText(origin);
    const title = textFromHtml(homepage, /<title[^>]*>([^<]+)<\/title>/i);
    const description = findMetaContent(homepage, "description");
    const ogTitle = findMetaContent(homepage, "og:title");
    const ogDescription = findMetaContent(homepage, "og:description");

    if (title) {
      storeProfile.storeName = title.replace(/\s*\|.*$/, "").trim();
    }

    if (ogTitle || ogDescription) {
      structuredData.openGraph = true;
    }

    if (description) {
      trustSignals.push(`Homepage description present: ${description.slice(0, 140)}`);
    }

    const jsonLd = parseJsonLd(homepage);
    if (jsonLd.length > 0) {
      structuredData.schemaOrgOrganization = jsonLd.some((entry) => {
        const items = Array.isArray(entry) ? entry : [entry];
        return items.some((item) => item && item["@type"] && String(item["@type"]).toLowerCase().includes("organization"));
      });
      structuredData.schemaOrgProduct = jsonLd.some((entry) => {
        const items = Array.isArray(entry) ? entry : [entry];
        return items.some((item) => item && item["@type"] && String(item["@type"]).toLowerCase().includes("product"));
      });
      structuredData.jsonLdBreadcrumbs = jsonLd.some((entry) => {
        const items = Array.isArray(entry) ? entry : [entry];
        return items.some((item) => item && item["@type"] && String(item["@type"]).toLowerCase().includes("breadcrumb"));
      });
    }

    policies.push(...parseStorePolicies(homepage));
    faqs.push(...parseFaqCandidates(homepage));
  } catch (error) {
    // Keep best-effort output from the fetchable endpoints.
  }

  if (policies.length === 0) {
    policies.push(
      { type: "shipping", content: "Shipping policy could not be read from the public storefront link." },
      { type: "returns", content: "Returns policy could not be read from the public storefront link." },
      { type: "privacy", content: "Privacy policy could not be read from the public storefront link." }
    );
  }

  if (faqs.length === 0) {
    faqs.push(
      { question: "What does this store sell?", answer: "This public storefront link did not expose a FAQ page automatically." },
      { question: "What is the return policy?", answer: "Please review the storefront policies for return terms." }
    );
  }

  if (products.length === 0) {
    products.push({
      title: storeProfile.storeName || "Store Product",
      description: "Public Shopify product data was not available from the shared link.",
      price: "0.00"
    });
  }

  return {
    storeProfile,
    products,
    policies,
    faqs,
    reviews,
    trustSignals,
    structuredData,
    source: {
      inputUrl,
      origin,
      connectionType: productHandle ? "product-url" : "store-url"
    }
  };
}

module.exports = {
  connectShopifyStore
};
