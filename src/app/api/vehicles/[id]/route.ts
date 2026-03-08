import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getVehicle } from "@/lib/dashboard";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  const vehicle = await getVehicle(id, user?.id ?? null);

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  return NextResponse.json(vehicle);
}
