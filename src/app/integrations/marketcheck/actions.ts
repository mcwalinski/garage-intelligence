"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { refreshGarageValuationsForUser, refreshVehicleValuationForUser } from "@/lib/dashboard";

function readTrimmed(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function refreshGarageValuationsAction() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  try {
    await refreshGarageValuationsForUser(user.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Valuation refresh failed";
    redirect(`/?formError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/");
  revalidatePath("/api/dashboard");
  revalidatePath("/api/vehicles");
  redirect("/?valuations=refreshed");
}

export async function refreshVehicleValuationAction(formData: FormData) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  const vehicleId = readTrimmed(formData, "vehicleId");

  if (!vehicleId) {
    redirect("/?formError=Vehicle%20not%20found");
  }

  try {
    await refreshVehicleValuationForUser(user.id, vehicleId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Valuation refresh failed";
    redirect(`/vehicles/${vehicleId}?valuationError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/");
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/api/dashboard");
  revalidatePath("/api/vehicles");
  redirect(`/vehicles/${vehicleId}?valuation=refreshed`);
}
