import "server-only";

const VCAAS_BASE_URL = "https://api-accounts.totalum.app/api/v1/vcaas";

export function getVcaasApiKey(): string {
  return process.env.VCAAS_API_KEY || "";
}

export async function vcaasRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${VCAAS_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "api-key": getVcaasApiKey(),
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}
