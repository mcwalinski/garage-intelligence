import { Powertrain } from "@/lib/types";

export interface VinDecodeResult {
  vin: string;
  year: number | null;
  make: string;
  model: string;
  trim: string;
  powertrain: Powertrain;
  bodyClass: string;
  manufacturer: string;
  imageUrl: string;
  imageSource: string;
}

interface VpicResponse {
  Results?: Array<Record<string, string | number | null>>;
}

function normalizeText(value: string | number | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function inferPowertrain(result: Record<string, string | number | null>): Powertrain {
  const electrification = normalizeText(result.ElectrificationLevel);
  const fuelPrimary = normalizeText(result.FuelTypePrimary).toLowerCase();
  const fuelSecondary = normalizeText(result.FuelTypeSecondary).toLowerCase();

  if (electrification.toLowerCase().includes("battery") || fuelPrimary.includes("electric")) {
    return "ev";
  }

  if (electrification.toLowerCase().includes("hybrid") || fuelSecondary.includes("electric")) {
    return "hybrid";
  }

  if (fuelPrimary.includes("diesel")) {
    return "diesel";
  }

  return "gas";
}

async function fetchWikipediaVehicleImage(
  searchTerms: string[]
): Promise<{ imageUrl: string; imageSource: string }> {
  const query = searchTerms.filter(Boolean).join(" ").trim();

  if (!query) {
    return {
      imageUrl: "",
      imageSource: ""
    };
  }

  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", "1");
  url.searchParams.set("prop", "pageimages|info");
  url.searchParams.set("piprop", "original");
  url.searchParams.set("inprop", "url");

  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      imageUrl: "",
      imageSource: ""
    };
  }

  const payload = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          fullurl?: string;
          original?: { source?: string };
        }
      >;
    };
  };

  const firstPage = Object.values(payload.query?.pages ?? {})[0];
  const imageUrl = firstPage?.original?.source ?? "";
  const pageUrl = firstPage?.fullurl ?? "";

  return {
    imageUrl,
    imageSource: pageUrl ? `Wikipedia: ${pageUrl}` : ""
  };
}

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const normalizedVin = vin.trim().toUpperCase();

  if (normalizedVin.length < 11 || normalizedVin.length > 17) {
    throw new Error("VIN must be between 11 and 17 characters");
  }

  const response = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(normalizedVin)}?format=json`,
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("VIN lookup failed");
  }

  const payload = (await response.json()) as VpicResponse;
  const row = payload.Results?.[0];

  if (!row) {
    throw new Error("VIN lookup returned no result");
  }

  const errorCode = normalizeText(row.ErrorCode);

  if (errorCode && errorCode !== "0") {
    throw new Error(normalizeText(row.ErrorText) || "VIN lookup could not decode this vehicle");
  }

  const year = Number(normalizeText(row.ModelYear)) || null;
  const make = normalizeText(row.Make);
  const model = normalizeText(row.Model);
  const trim = normalizeText(row.Trim) || normalizeText(row.Series) || normalizeText(row.Series2);
  const image = await fetchWikipediaVehicleImage([String(year || ""), make, model, trim]);

  return {
    vin: normalizedVin,
    year,
    make,
    model,
    trim,
    powertrain: inferPowertrain(row),
    bodyClass: normalizeText(row.BodyClass),
    manufacturer: normalizeText(row.Manufacturer),
    imageUrl: image.imageUrl,
    imageSource: image.imageSource
  };
}
