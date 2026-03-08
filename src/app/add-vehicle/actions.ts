"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createVehicleForUser,
  deleteVehicleForUser,
  deleteVehiclesForUser,
  updateVehicleForUser
} from "@/lib/dashboard";
import { getAuthenticatedUser } from "@/lib/auth";
import { Powertrain, VehicleOwnershipStatus } from "@/lib/types";

const validPowertrains = new Set<Powertrain>(["gas", "diesel", "hybrid", "ev"]);
const validOwnershipStatuses = new Set<VehicleOwnershipStatus>(["own", "owned", "watching"]);

function readTrimmed(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function addVehicleAction(formData: FormData) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  const nickname = readTrimmed(formData, "nickname");
  const yearRaw = readTrimmed(formData, "year");
  const make = readTrimmed(formData, "make");
  const model = readTrimmed(formData, "model");
  const trim = readTrimmed(formData, "trim");
  const vin = readTrimmed(formData, "vin").toUpperCase();
  const image = readTrimmed(formData, "image");
  const powertrain = readTrimmed(formData, "powertrain") as Powertrain;
  const ownershipStatus = readTrimmed(formData, "ownershipStatus") as VehicleOwnershipStatus;
  const year = Number(yearRaw);

  if (!nickname || !make || !model || !trim || !Number.isInteger(year)) {
    redirect("/?formError=Missing%20required%20vehicle%20fields");
  }

  if (year < 1900 || year > new Date().getFullYear() + 1) {
    redirect("/?formError=Vehicle%20year%20is%20out%20of%20range");
  }

  if (!validPowertrains.has(powertrain)) {
    redirect("/?formError=Invalid%20powertrain%20selection");
  }

  if (!validOwnershipStatuses.has(ownershipStatus)) {
    redirect("/?formError=Invalid%20vehicle%20status");
  }

  if (vin && (vin.length < 11 || vin.length > 17)) {
    redirect("/?formError=VIN%20must%20be%20between%2011%20and%2017%20characters");
  }

  const slug = await createVehicleForUser(user.id, {
    nickname,
    year,
    make,
    model,
    trim,
    vin,
    powertrain,
    ownershipStatus,
    image
  });

  revalidatePath("/");
  revalidatePath("/api/dashboard");
  revalidatePath("/api/vehicles");
  redirect(`/vehicles/${slug}`);
}

export async function updateVehicleAction(formData: FormData) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  const vehicleId = readTrimmed(formData, "vehicleId");
  const nickname = readTrimmed(formData, "nickname");
  const yearRaw = readTrimmed(formData, "year");
  const make = readTrimmed(formData, "make");
  const model = readTrimmed(formData, "model");
  const trim = readTrimmed(formData, "trim");
  const vin = readTrimmed(formData, "vin").toUpperCase();
  const image = readTrimmed(formData, "image");
  const powertrain = readTrimmed(formData, "powertrain") as Powertrain;
  const ownershipStatus = readTrimmed(formData, "ownershipStatus") as VehicleOwnershipStatus;
  const year = Number(yearRaw);

  if (!vehicleId || !nickname || !make || !model || !trim || !Number.isInteger(year)) {
    redirect("/?formError=Missing%20required%20vehicle%20fields");
  }

  if (year < 1900 || year > new Date().getFullYear() + 1) {
    redirect("/?formError=Vehicle%20year%20is%20out%20of%20range");
  }

  if (!validPowertrains.has(powertrain)) {
    redirect("/?formError=Invalid%20powertrain%20selection");
  }

  if (!validOwnershipStatuses.has(ownershipStatus)) {
    redirect("/?formError=Invalid%20vehicle%20status");
  }

  if (vin && (vin.length < 11 || vin.length > 17)) {
    redirect("/?formError=VIN%20must%20be%20between%2011%20and%2017%20characters");
  }

  const slug = await updateVehicleForUser(user.id, vehicleId, {
    nickname,
    year,
    make,
    model,
    trim,
    vin,
    powertrain,
    ownershipStatus,
    image
  });

  revalidatePath("/");
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${slug}`);
  revalidatePath("/api/dashboard");
  revalidatePath("/api/vehicles");
  redirect(`/vehicles/${slug}`);
}

export async function deleteVehicleAction(formData: FormData) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  const vehicleId = readTrimmed(formData, "vehicleId");

  if (!vehicleId) {
    redirect("/?formError=Vehicle%20not%20found");
  }

  await deleteVehicleForUser(user.id, vehicleId);

  revalidatePath("/");
  revalidatePath("/api/dashboard");
  revalidatePath("/api/vehicles");
  redirect("/");
}

export async function bulkDeleteVehiclesAction(formData: FormData) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  const vehicleIds = formData
    .getAll("vehicleIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (vehicleIds.length === 0) {
    redirect("/?formError=Select%20at%20least%20one%20vehicle%20to%20delete");
  }

  await deleteVehiclesForUser(user.id, vehicleIds);

  revalidatePath("/");
  revalidatePath("/api/dashboard");
  revalidatePath("/api/vehicles");
  redirect("/");
}
