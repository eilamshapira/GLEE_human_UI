export type GameFamily = "bargaining" | "negotiation" | "persuasion";
export type PlayerRole = "alice" | "bob";
export type TurnType = "proposal" | "decision" | "waiting" | "finished";

export type ToneModifier =
  | "more_credible"
  | "less_credible"
  | "more_logical"
  | "less_logical"
  | "more_aggressive"
  | "less_aggressive"
  | "more_emotional"
  | "less_emotional";

export interface GameConfig {
  game_family: GameFamily;
  player_role: PlayerRole;
  ai_server_url: string;
  money_to_divide: number;
  max_rounds: number;
  delta_1: number;
  delta_2: number;
  complete_information: boolean;
  messages_allowed: boolean;
}

export interface GameParams {
  money_to_divide?: number;
  max_rounds?: number;
  delta_1?: number;
  delta_2?: number;
  delta?: number;
  delta_player_1?: number;
  delta_player_2?: number;
  complete_information?: boolean;
  messages_allowed?: boolean;
  public_name?: string;
  player_id?: number;
  rules?: string;
  req_offer_text?: string;
  req_decision_text?: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface GameStateMsg {
  type: "game_state";
  session_id: string;
  turn_type: TurnType;
  round_number: number;
  messages: ChatMessage[];
  game_params: GameParams;
  player_role: string;
  last_offer: Record<string, unknown> | null;
}

export interface GameFinishedMsg {
  type: "game_finished";
  session_id: string;
  outcome: string;
  final_alice?: number;
  final_bob?: number;
  stdout?: string;
  stderr?: string;
}

export type WSMessage = GameStateMsg | GameFinishedMsg;

export interface AISuggestResponse {
  suggested_split?: { alice: number; bob: number };
  suggested_message?: string;
}
