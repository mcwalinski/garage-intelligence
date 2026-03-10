import { createHmac } from "node:crypto";

interface SmartcarTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

interface SmartcarVehicleIdsResponse {
  vehicles: string[];
}

interface SmartcarVehicleAttributes {
  id: string;
  make?: string;
  model?: string;
  year?: number;
}

interface SmartcarOdometerResponse {
  distance?: number;
}

interface SmartcarLocationResponse {
  latitude?: number;
  longitude?: number;
}

interface SmartcarBatteryResponse {
  percentRemaining?: number;
}

interface SmartcarFuelResponse {
  percentRemaining?: number;
}

const smartcarScopes = [
  "read_vehicle_info",
  "read_odometer",
  "read_location",
  "read_fuel",
  "read_battery",
  "read_tires"
];

function getSmartcarConfig() {
  const clientId = process.env.SMARTCAR_CLIENT_ID;
  const clientSecret = process.env.SMARTCAR_CLIENT_SECRET;
  const redirectUri = process.env.SMARTCAR_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Smartcar configuration is incomplete");
  }

  return {
    clientId,
    clientSecret,
    redirectUri
  };
}

export function getSmartcarAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = getSmartcarConfig();
  const url = new URL("https://connect.smartcar.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", smartcarScopes.join(" "));
  url.searchParams.set("mode", "live");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeSmartcarCode(code: string) {
  const { clientId, clientSecret, redirectUri } = getSmartcarConfig();
  const response = await fetch("https://auth.smartcar.com/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to exchange Smartcar authorization code");
  }

  return (await response.json()) as SmartcarTokenResponse;
}

export async function fetchSmartcarVehicleIds(accessToken: string) {
  const response = await fetch("https://api.smartcar.com/v2.0/vehicles", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Smartcar vehicles");
  }

  return ((await response.json()) as SmartcarVehicleIdsResponse).vehicles;
}

export async function fetchSmartcarVehicleAttributes(accessToken: string, vehicleId: string) {
  const response = await fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Smartcar vehicle attributes for ${vehicleId}`);
  }

  return (await response.json()) as SmartcarVehicleAttributes;
}

async function fetchSmartcarSignal<T>(accessToken: string, vehicleId: string, path: string): Promise<T> {
  const response = await fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed Smartcar ${path} fetch for ${vehicleId}`);
  }

  return (await response.json()) as T;
}

export async function fetchSmartcarOdometer(accessToken: string, vehicleId: string) {
  return fetchSmartcarSignal<SmartcarOdometerResponse>(accessToken, vehicleId, "odometer");
}

export async function fetchSmartcarLocation(accessToken: string, vehicleId: string) {
  return fetchSmartcarSignal<SmartcarLocationResponse>(accessToken, vehicleId, "location");
}

export async function fetchSmartcarBattery(accessToken: string, vehicleId: string) {
  return fetchSmartcarSignal<SmartcarBatteryResponse>(accessToken, vehicleId, "battery");
}

export async function fetchSmartcarFuel(accessToken: string, vehicleId: string) {
  return fetchSmartcarSignal<SmartcarFuelResponse>(accessToken, vehicleId, "fuel");
}

export function computeExpiryDate(expiresInSeconds?: number) {
  if (!expiresInSeconds) {
    return null;
  }

  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

function getSmartcarManagementToken() {
  return process.env.SMARTCAR_MANAGEMENT_TOKEN || process.env.SMARTCAR_WEBHOOK_SECRET || "";
}

export function verifySmartcarWebhookSignature(payload: string, signature: string | null) {
  const managementToken = getSmartcarManagementToken();
  if (!managementToken || !signature) {
    return false;
  }

  const digest = createHmac("sha256", managementToken).update(payload).digest("base64");
  return digest === signature;
}

export function buildSmartcarVerifyChallenge(challenge: string) {
  const managementToken = getSmartcarManagementToken();
  if (!managementToken) {
    throw new Error("Smartcar management token is not configured");
  }

  return createHmac("sha256", managementToken).update(challenge).digest("hex");
}
