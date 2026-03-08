import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSmartcarAuthorizationUrl } from "@/lib/smartcar";

export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=Sign%20in%20required", "http://localhost:3000"));
  }

  return NextResponse.redirect(getSmartcarAuthorizationUrl(user.id));
}
