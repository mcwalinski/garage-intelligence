import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getOrCreateGarageIdForUser } from "@/lib/dashboard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  computeExpiryDate,
  exchangeSmartcarCode,
  fetchSmartcarVehicleAttributes,
  fetchSmartcarVehicleIds
} from "@/lib/smartcar";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const error = requestUrl.searchParams.get("error");

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=Sign%20in%20required`);
  }

  if (error) {
    return NextResponse.redirect(`${origin}/?formError=${encodeURIComponent(`Smartcar error: ${error}`)}`);
  }

  if (!code || !state || state !== user.id) {
    return NextResponse.redirect(`${origin}/?formError=Smartcar%20callback%20validation%20failed`);
  }

  try {
    const garageId = await getOrCreateGarageIdForUser(user.id);

    if (!garageId) {
      return NextResponse.redirect(`${origin}/?formError=No%20garage%20available%20for%20Smartcar%20connection`);
    }

    const token = await exchangeSmartcarCode(code);
    const supabase = createSupabaseAdminClient();
    const { data: connection, error: connectionError } = await supabase
      .from("provider_connections")
      .insert({
        garage_id: garageId,
        user_id: user.id,
        provider: "smartcar",
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        scope: (token.scope ?? "").split(" ").filter(Boolean),
        status: "active",
        expires_at: computeExpiryDate(token.expires_in),
        metadata: {
          source: "smartcar-oauth",
          last_sync_status: "connected",
          last_sync_at: new Date().toISOString(),
          last_sync_error: null
        }
      })
      .select("id")
      .single();

    if (connectionError || !connection) {
      throw connectionError ?? new Error("Failed to create Smartcar connection");
    }

    const smartcarVehicleIds = await fetchSmartcarVehicleIds(token.access_token);

    for (const smartcarVehicleId of smartcarVehicleIds) {
      const attributes = await fetchSmartcarVehicleAttributes(token.access_token, smartcarVehicleId);
      await supabase.from("provider_vehicles").upsert(
        {
          provider_connection_id: connection.id,
          smartcar_vehicle_id: smartcarVehicleId,
          make: attributes.make ?? null,
          model: attributes.model ?? null,
          year: attributes.year ?? null
        },
        {
          onConflict: "provider_connection_id,smartcar_vehicle_id"
        }
      );
    }

    return NextResponse.redirect(`${origin}/?smartcar=connected`);
  } catch (callbackError) {
    const message =
      callbackError instanceof Error ? callbackError.message : "Smartcar connection failed";
    return NextResponse.redirect(`${origin}/?formError=${encodeURIComponent(message)}`);
  }
}
