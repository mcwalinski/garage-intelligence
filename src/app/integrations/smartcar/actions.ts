"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { linkSmartcarVehicleForUser, syncSmartcarConnectionForUser } from "@/lib/dashboard";

function readTrimmed(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function linkSmartcarVehicleAction(formData: FormData) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  const providerVehicleId = readTrimmed(formData, "providerVehicleId");
  const garageVehicleId = readTrimmed(formData, "garageVehicleId");

  if (!providerVehicleId || !garageVehicleId) {
    redirect("/?formError=Select%20both%20a%20Smartcar%20vehicle%20and%20garage%20vehicle");
  }

  await linkSmartcarVehicleForUser(user.id, providerVehicleId, garageVehicleId);

  revalidatePath("/");
  revalidatePath("/api/dashboard");
  revalidatePath("/api/vehicles");
  redirect("/?smartcar=linked");
}

export async function syncSmartcarConnectionAction(formData: FormData) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  const connectionId = readTrimmed(formData, "connectionId");

  if (!connectionId) {
    redirect("/?formError=Smartcar%20connection%20not%20found");
  }

  await syncSmartcarConnectionForUser(user.id, connectionId);

  revalidatePath("/");
  revalidatePath("/api/dashboard");
  revalidatePath("/api/vehicles");
  redirect("/?smartcar=synced");
}
