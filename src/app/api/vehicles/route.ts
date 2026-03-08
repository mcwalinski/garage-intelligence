import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { listVehicles } from "@/lib/dashboard";

export async function GET() {
  const user = await getAuthenticatedUser();
  return NextResponse.json(await listVehicles(user?.id ?? null));
}
