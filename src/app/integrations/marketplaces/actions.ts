"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { searchPartsForVehicleForUser } from "@/lib/dashboard";
import { MarketplaceSelection } from "@/lib/marketplaces";

function readTrimmed(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function searchVehiclePartsAction(formData: FormData) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  const vehicleId = readTrimmed(formData, "vehicleId");
  const query = readTrimmed(formData, "query");
  const marketplace = readTrimmed(formData, "marketplace") as MarketplaceSelection;

  if (!vehicleId || !query) {
    redirect(`/vehicles/${vehicleId}?partsError=Search%20query%20is%20required`);
  }

  if (!new Set<MarketplaceSelection>(["all", "amazon", "ebay"]).has(marketplace)) {
    redirect(`/vehicles/${vehicleId}?partsError=Choose%20a%20valid%20marketplace`);
  }

  await searchPartsForVehicleForUser(user.id, vehicleId, query, marketplace);

  revalidatePath("/");
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/api/dashboard");
  revalidatePath("/api/vehicles");
}
