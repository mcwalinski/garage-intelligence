"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  sendNotificationDigestForUser,
  syncMaintenanceAlertsForUser,
  updateNotificationPreferencesForUser
} from "@/lib/dashboard";
import { getAuthenticatedUser } from "@/lib/auth";

function readTrimmed(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readChecked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function revalidateDashboard() {
  revalidatePath("/");
  revalidatePath("/api/dashboard");
  revalidatePath("/api/vehicles");
}

export async function updateNotificationPreferencesAction(formData: FormData) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  await updateNotificationPreferencesForUser(user.id, {
    deliveryEmail: readTrimmed(formData, "deliveryEmail"),
    phoneNumber: readTrimmed(formData, "phoneNumber"),
    emailEnabled: readChecked(formData, "emailEnabled"),
    smsEnabled: readChecked(formData, "smsEnabled"),
    pushEnabled: readChecked(formData, "pushEnabled"),
    maintenanceDueEnabled: readChecked(formData, "maintenanceDueEnabled"),
    maintenanceDueSoonEnabled: readChecked(formData, "maintenanceDueSoonEnabled"),
    weeklyDigestEnabled: readChecked(formData, "weeklyDigestEnabled")
  });

  await syncMaintenanceAlertsForUser(user.id, user.email);
  revalidateDashboard();
  redirect("/");
}

export async function refreshNotificationAlertsAction() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  await syncMaintenanceAlertsForUser(user.id, user.email);
  revalidateDashboard();
  redirect("/");
}

export async function sendNotificationDigestAction() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  const result = await sendNotificationDigestForUser(user.id, user.email);
  revalidateDashboard();
  if (result.status === "failed") {
    redirect(`/?formError=${encodeURIComponent(result.message)}`);
  }

  redirect("/");
}
