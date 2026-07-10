import { NextResponse } from "next/server";
import { getVcaasApiKey } from "@/lib/vcaas";

// Reports whether the Totalum VCaaS API key is configured — WITHOUT ever
// exposing the key itself to the client. The dashboard uses this to show setup
// guidance when the builder hasn't been given a key yet.
export function GET() {
  return NextResponse.json({
    ok: true,
    data: { configured: getVcaasApiKey().trim().length > 0 },
  });
}
