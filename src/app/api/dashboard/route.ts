import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/dashboard";

export async function GET() {
  const user = await getAuthenticatedUser();
  return NextResponse.json(await getDashboardSummary(user?.id ?? null));
}
