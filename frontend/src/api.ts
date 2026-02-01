import type { GameConfig, AISuggestResponse, ToneModifier } from "./types";

const BASE = "";

export async function createGame(config: GameConfig) {
  const res = await fetch(`${BASE}/api/games`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{
    session_id: string;
    game_family: string;
    player_role: string;
    status: string;
  }>;
}

export async function listGames() {
  const res = await fetch(`${BASE}/api/games`);
  return res.json();
}

export async function submitResponse(
  sessionId: string,
  payload: Record<string, unknown>
) {
  const res = await fetch(`${BASE}/api/games/${sessionId}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function aiSuggest(
  sessionId: string,
  suggestType: "split" | "message",
  toneModifiers: ToneModifier[] = [],
  currentMessage: string = ""
): Promise<AISuggestResponse> {
  const res = await fetch(`${BASE}/api/games/${sessionId}/ai-suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      suggest_type: suggestType,
      tone_modifiers: toneModifiers,
      current_message: currentMessage,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
