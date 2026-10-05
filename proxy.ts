import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static files and the cron endpoint (it has its own secret).
    "/((?!_next/static|_next/image|favicon.ico|api/rates|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
