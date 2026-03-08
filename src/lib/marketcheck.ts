import { appConfig } from "@/lib/config";

interface MarketCheckHistoryRecord {
  id: string;
  price?: number;
  last_seen_at_date?: string;
  seller_name?: string;
  seller_type?: string;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }

  return Math.round(sorted[middle]);
}

export async function fetchMarketCheckHistoryEstimate(vin: string) {
  const apiKey = appConfig.providers.marketCheckApiKey;
  const normalizedVin = vin.trim().toUpperCase();

  if (!apiKey) {
    throw new Error("MarketCheck is not configured");
  }

  if (!normalizedVin || normalizedVin.length !== 17) {
    throw new Error("MarketCheck history requires a 17-character VIN");
  }

  const url = new URL(`https://api.marketcheck.com/v2/history/car/${encodeURIComponent(normalizedVin)}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("fields", "id,price,last_seen_at_date,seller_name,seller_type,status_date");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    let message = "MarketCheck history request failed";

    try {
      const payload = (await response.json()) as { message?: string };
      message = payload.message || message;
    } catch {
      // ignore parse failure
    }

    throw new Error(message);
  }

  const payload = (await response.json()) as MarketCheckHistoryRecord[];
  const comparableListings = payload
    .filter((record) => typeof record.price === "number" && record.price! > 0)
    .slice(0, 12);

  if (comparableListings.length === 0) {
    throw new Error("MarketCheck returned no priced listing history for this VIN");
  }

  const prices = comparableListings.map((record) => Number(record.price));
  const marketValueUsd = median(prices);
  const lastSeenAt = comparableListings[0]?.last_seen_at_date ?? null;
  const confidence =
    comparableListings.length >= 8 ? "high" : comparableListings.length >= 4 ? "medium" : "low";

  return {
    marketValueUsd,
    source: "marketcheck-history",
    confidence,
    comparableCount: comparableListings.length,
    lastSeenAt
  };
}
