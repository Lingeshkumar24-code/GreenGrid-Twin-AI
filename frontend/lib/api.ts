import type { AssistantResponse, Campus } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function apiGet<T>(path: string): Promise<T> {
  let res: Response;
  try { res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" }); }
  catch { throw new Error(`Could not reach the API at ${API_BASE_URL}. Is the backend running?`); }
  if (!res.ok) throw new Error(`Request to ${path} failed with status ${res.status}`);
  return res.json() as Promise<T>;
}

export function fetchCampus(): Promise<Campus> { return apiGet<Campus>("/api/v1/campus"); }

export async function askAssistant(message: string): Promise<AssistantResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  } catch { throw new Error("Could not reach the AI assistant service."); }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Assistant request failed with status ${res.status}`);
  }
  return res.json() as Promise<AssistantResponse>;
}
