import { appConfig, hasProviderConfig } from "@/lib/config";
import { Vehicle } from "@/lib/types";

interface MarketplaceResult {
  externalId: string;
  query: string;
  title: string;
  marketplace: string;
  priceUsd: number;
  primeEligible: boolean;
  fitmentConfidence: "low" | "medium" | "high";
  url: string;
}

export type MarketplaceSelection = "all" | "amazon" | "ebay";

interface EbayTokenResponse {
  access_token: string;
}

function normalizeSearchQuery(vehicle: Pick<Vehicle, "year" | "make" | "model" | "trim">, query: string) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim} ${query}`.replace(/\s+/g, " ").trim();
}

function makeMarketplaceId(marketplace: string, seed: string) {
  return `${marketplace.toLowerCase()}-${Buffer.from(seed).toString("base64url").slice(0, 24)}`;
}

function inferFitmentConfidence(title: string, vehicle: Pick<Vehicle, "year" | "make" | "model">) {
  const text = title.toLowerCase();
  const year = String(vehicle.year);
  const make = vehicle.make.toLowerCase();
  const model = vehicle.model.toLowerCase();

  if (text.includes(year) && text.includes(make) && text.includes(model)) {
    return "high" as const;
  }

  if (text.includes(make) || text.includes(model)) {
    return "medium" as const;
  }

  return "low" as const;
}

function buildAmazonSearchUrl(query: string) {
  const url = new URL("https://www.amazon.com/s");
  url.searchParams.set("k", query);
  return url.toString();
}

function buildEbaySearchUrl(query: string) {
  const url = new URL("https://www.ebay.com/sch/i.html");
  url.searchParams.set("_nkw", query);
  return url.toString();
}

async function fetchEbayAppToken() {
  const clientId = appConfig.providers.ebayClientId;
  const clientSecret = appConfig.providers.ebayClientSecret;

  if (!clientId || !clientSecret) {
    return null;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope"
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as EbayTokenResponse;
  return payload.access_token;
}

async function searchEbayListings(
  vehicle: Pick<Vehicle, "year" | "make" | "model" | "trim">,
  query: string
): Promise<MarketplaceResult[]> {
  const normalizedQuery = normalizeSearchQuery(vehicle, query);

  if (!hasProviderConfig("ebay")) {
    return [
      {
        externalId: makeMarketplaceId("ebay", normalizedQuery),
        query,
        title: `Search eBay for ${normalizedQuery}`,
        marketplace: "eBay",
        priceUsd: 0,
        primeEligible: false,
        fitmentConfidence: "medium",
        url: buildEbaySearchUrl(normalizedQuery)
      }
    ];
  }

  const token = await fetchEbayAppToken();

  if (!token) {
    return [
      {
        externalId: makeMarketplaceId("ebay", `${normalizedQuery}-fallback`),
        query,
        title: `Search eBay for ${normalizedQuery}`,
        marketplace: "eBay",
        priceUsd: 0,
        primeEligible: false,
        fitmentConfidence: "medium",
        url: buildEbaySearchUrl(normalizedQuery)
      }
    ];
  }

  const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  url.searchParams.set("q", normalizedQuery);
  url.searchParams.set("limit", "6");
  url.searchParams.set("auto_correct", "KEYWORD");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
    }
  });

  if (!response.ok) {
    return [
      {
        externalId: makeMarketplaceId("ebay", `${normalizedQuery}-error`),
        query,
        title: `Search eBay for ${normalizedQuery}`,
        marketplace: "eBay",
        priceUsd: 0,
        primeEligible: false,
        fitmentConfidence: "medium",
        url: buildEbaySearchUrl(normalizedQuery)
      }
    ];
  }

  const payload = await response.json();
  const itemSummaries = Array.isArray(payload.itemSummaries) ? payload.itemSummaries : [];

  return itemSummaries.map((item: any, index: number) => ({
    externalId: item.itemId ?? makeMarketplaceId("ebay", `${normalizedQuery}-${index}`),
    query,
    title: item.title ?? `eBay result for ${normalizedQuery}`,
    marketplace: "eBay",
    priceUsd: Number(item.price?.value ?? 0),
    primeEligible: false,
    fitmentConfidence: inferFitmentConfidence(item.title ?? "", vehicle),
    url: item.itemAffiliateWebUrl ?? item.itemWebUrl ?? buildEbaySearchUrl(normalizedQuery)
  }));
}

async function searchAmazonListings(
  vehicle: Pick<Vehicle, "year" | "make" | "model" | "trim">,
  query: string
): Promise<MarketplaceResult[]> {
  const normalizedQuery = normalizeSearchQuery(vehicle, query);

  return [
    {
      externalId: makeMarketplaceId("amazon", normalizedQuery),
      query,
      title: `Search Amazon for ${normalizedQuery}`,
      marketplace: "Amazon",
      priceUsd: 0,
      primeEligible: true,
      fitmentConfidence: "medium",
      url: buildAmazonSearchUrl(normalizedQuery)
    },
    {
      externalId: makeMarketplaceId("amazon", `${vehicle.make} ${vehicle.model} accessories ${query}`),
      query,
      title: `Browse Amazon accessories for ${vehicle.make} ${vehicle.model}`,
      marketplace: "Amazon",
      priceUsd: 0,
      primeEligible: true,
      fitmentConfidence: "low",
      url: buildAmazonSearchUrl(`${vehicle.make} ${vehicle.model} accessories ${query}`.trim())
    }
  ];
}

export async function searchMarketplaceListings(
  vehicle: Pick<Vehicle, "year" | "make" | "model" | "trim">,
  query: string,
  marketplace: MarketplaceSelection
) {
  if (marketplace === "amazon") {
    return searchAmazonListings(vehicle, query);
  }

  if (marketplace === "ebay") {
    return searchEbayListings(vehicle, query);
  }

  const [amazonResults, ebayResults] = await Promise.all([
    searchAmazonListings(vehicle, query),
    searchEbayListings(vehicle, query)
  ]);

  return [...amazonResults, ...ebayResults];
}
