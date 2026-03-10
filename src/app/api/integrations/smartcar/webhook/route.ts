import { NextResponse } from "next/server";
import { markSmartcarVehicleWebhookError, syncSmartcarVehicleFromWebhook } from "@/lib/dashboard";
import { buildSmartcarVerifyChallenge, verifySmartcarWebhookSignature } from "@/lib/smartcar";

type SmartcarWebhookEvent =
  | {
      type: "VERIFY";
      payload?: {
        challenge?: string;
      };
    }
  | {
      type: "VEHICLE_STATE";
      payload?: {
        id?: string;
        vehicleId?: string;
      };
    }
  | {
      type: "VEHICLE_ERROR";
      payload?: {
        id?: string;
        vehicleId?: string;
        message?: string;
        code?: string;
      };
    }
  | {
      type?: string;
      payload?: Record<string, unknown>;
    };

function getWebhookVehicleId(event: SmartcarWebhookEvent) {
  const payload = event.payload as { id?: string; vehicleId?: string } | undefined;
  return payload?.vehicleId || payload?.id || null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("SC-Signature");

  if (!verifySmartcarWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid Smartcar signature" }, { status: 401 });
  }

  let event: SmartcarWebhookEvent;
  try {
    event = JSON.parse(rawBody) as SmartcarWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (event.type === "VERIFY") {
    const challenge = typeof event.payload?.challenge === "string" ? event.payload.challenge : null;
    if (!challenge) {
      return NextResponse.json({ error: "Missing challenge" }, { status: 400 });
    }

    return NextResponse.json({ challenge: buildSmartcarVerifyChallenge(challenge) });
  }

  const smartcarVehicleId = getWebhookVehicleId(event);

  if (!smartcarVehicleId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (event.type === "VEHICLE_STATE") {
    await syncSmartcarVehicleFromWebhook(smartcarVehicleId);
    return NextResponse.json({ ok: true, synced: smartcarVehicleId });
  }

  if (event.type === "VEHICLE_ERROR") {
    const payload = event.payload as { message?: string; code?: string } | undefined;
    const errorMessage = [payload?.code, payload?.message].filter(Boolean).join(": ") || "Smartcar vehicle error";
    await markSmartcarVehicleWebhookError(smartcarVehicleId, errorMessage);
    return NextResponse.json({ ok: true, marked_error: smartcarVehicleId });
  }

  return NextResponse.json({ ok: true, ignored: true, type: event.type ?? "unknown" });
}
