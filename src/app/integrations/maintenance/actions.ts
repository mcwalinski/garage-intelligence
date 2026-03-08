"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  completeMaintenanceTaskForUser,
  createMaintenanceTaskForUser,
  deleteMaintenanceTaskForUser,
  syncMaintenanceAlertsForUser
} from "@/lib/dashboard";
import { getAuthenticatedUser } from "@/lib/auth";
import { MaintenanceCategory } from "@/lib/types";

const validCategories = new Set<MaintenanceCategory>([
  "engine",
  "tires",
  "brakes",
  "fluids",
  "filters",
  "battery",
  "inspection",
  "general"
]);

function readTrimmed(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function revalidateVehicle(vehicleId: string) {
  revalidatePath("/");
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/api/dashboard");
  revalidatePath("/api/vehicles");
}

export async function createMaintenanceTaskAction(formData: FormData) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  const vehicleId = readTrimmed(formData, "vehicleId");
  const title = readTrimmed(formData, "title");
  const category = readTrimmed(formData, "category") as MaintenanceCategory;
  const dueDate = readTrimmed(formData, "dueDate");
  const providerRecommendation = readTrimmed(formData, "providerRecommendation");
  const notes = readTrimmed(formData, "notes");
  const dueMileageRaw = readTrimmed(formData, "dueMileage");
  const estimatedCostRaw = readTrimmed(formData, "estimatedCostUsd");
  const recurrenceMilesRaw = readTrimmed(formData, "recurrenceMiles");
  const recurrenceDaysRaw = readTrimmed(formData, "recurrenceDays");

  if (!vehicleId || !title || !dueDate || !providerRecommendation || !validCategories.has(category)) {
    redirect(`/vehicles/${vehicleId}?maintenanceError=Missing%20required%20maintenance%20fields`);
  }

  const estimatedCostUsd = Number(estimatedCostRaw || "0");
  const dueMileage = dueMileageRaw ? Number(dueMileageRaw) : null;
  const recurrenceMiles = recurrenceMilesRaw ? Number(recurrenceMilesRaw) : null;
  const recurrenceDays = recurrenceDaysRaw ? Number(recurrenceDaysRaw) : null;

  if (
    Number.isNaN(estimatedCostUsd) ||
    (dueMileageRaw && Number.isNaN(dueMileage ?? Number.NaN)) ||
    (recurrenceMilesRaw && Number.isNaN(recurrenceMiles ?? Number.NaN)) ||
    (recurrenceDaysRaw && Number.isNaN(recurrenceDays ?? Number.NaN))
  ) {
    redirect(`/vehicles/${vehicleId}?maintenanceError=Maintenance%20values%20must%20be%20numeric`);
  }

  await createMaintenanceTaskForUser(user.id, vehicleId, {
    title,
    category,
    dueDate,
    dueMileage,
    estimatedCostUsd,
    providerRecommendation,
    notes,
    recurrenceMiles,
    recurrenceDays
  });
  await syncMaintenanceAlertsForUser(user.id, user.email);

  revalidateVehicle(vehicleId);
  redirect(`/vehicles/${vehicleId}?maintenance=created`);
}

export async function completeMaintenanceTaskAction(formData: FormData) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  const vehicleId = readTrimmed(formData, "vehicleId");
  const taskId = readTrimmed(formData, "taskId");

  if (!vehicleId || !taskId) {
    redirect(`/vehicles/${vehicleId}?maintenanceError=Maintenance%20task%20not%20found`);
  }

  await completeMaintenanceTaskForUser(user.id, vehicleId, taskId);
  await syncMaintenanceAlertsForUser(user.id, user.email);
  revalidateVehicle(vehicleId);
  redirect(`/vehicles/${vehicleId}?maintenance=completed`);
}

export async function deleteMaintenanceTaskAction(formData: FormData) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  const vehicleId = readTrimmed(formData, "vehicleId");
  const taskId = readTrimmed(formData, "taskId");

  if (!vehicleId || !taskId) {
    redirect(`/vehicles/${vehicleId}?maintenanceError=Maintenance%20task%20not%20found`);
  }

  await deleteMaintenanceTaskForUser(user.id, vehicleId, taskId);
  await syncMaintenanceAlertsForUser(user.id, user.email);
  revalidateVehicle(vehicleId);
  redirect(`/vehicles/${vehicleId}?maintenance=deleted`);
}
