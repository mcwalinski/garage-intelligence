import { NextResponse } from "next/server";
import { decodeVin } from "@/lib/vin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vin = searchParams.get("vin");

  if (!vin) {
    return NextResponse.json({ error: "VIN is required" }, { status: 400 });
  }

  try {
    const result = await decodeVin(vin);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "VIN lookup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
