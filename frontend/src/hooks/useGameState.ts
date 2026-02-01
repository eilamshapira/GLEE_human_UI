import { useState, useEffect, useCallback } from "react";
import type {
  GameConfig,
  GameParams,
  ChatMessage,
  TurnType,
  ToneModifier,
  WSMessage,
  GameStateMsg,
  GameFinishedMsg,
} from "../types";

export interface GameState {
  sessionId: string | null;
  config: GameConfig | null;
  turnType: TurnType;
  roundNumber: number;
  messages: ChatMessage[];
  gameParams: GameParams;
  playerRole: string;
  lastOffer: Record<string, unknown> | null;
  finished: boolean;
  outcome: string;
  // Form state
  sliderPct: number;
  messageText: string;
  toneModifiers: ToneModifier[];
}

const initialState: GameState = {
  sessionId: null,
  config: null,
  turnType: "waiting",
  roundNumber: 0,
  messages: [],
  gameParams: {},
  playerRole: "alice",
  lastOffer: null,
  finished: false,
  outcome: "",
  sliderPct: 60,
  messageText: "",
  toneModifiers: [],
};

export function useGameState(lastMessage: WSMessage | null) {
  const [state, setState] = useState<GameState>(initialState);

  // Process WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "game_state") {
      const msg = lastMessage as GameStateMsg;
      setState((prev) => ({
        ...prev,
        turnType: msg.turn_type,
        roundNumber: msg.round_number,
        messages: msg.messages,
        gameParams: msg.game_params,
        playerRole: msg.player_role,
        lastOffer: msg.last_offer,
      }));
    } else if (lastMessage.type === "game_finished") {
      const msg = lastMessage as GameFinishedMsg;
      setState((prev) => ({
        ...prev,
        finished: true,
        outcome: msg.outcome,
        turnType: "finished",
      }));
    }
  }, [lastMessage]);

  const setSessionId = useCallback((id: string) => {
    setState((prev) => ({ ...prev, sessionId: id }));
  }, []);

  const setConfig = useCallback((config: GameConfig) => {
    setState((prev) => ({ ...prev, config }));
  }, []);

  const setSliderPct = useCallback((pct: number) => {
    setState((prev) => ({ ...prev, sliderPct: pct }));
  }, []);

  const setMessageText = useCallback((text: string) => {
    setState((prev) => ({ ...prev, messageText: text }));
  }, []);

  const toggleTone = useCallback((mod: ToneModifier) => {
    setState((prev) => {
      const existing = prev.toneModifiers.includes(mod);
      return {
        ...prev,
        toneModifiers: existing
          ? prev.toneModifiers.filter((m) => m !== mod)
          : [...prev.toneModifiers, mod],
      };
    });
  }, []);

  const clearForm = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sliderPct: 60,
      messageText: "",
      toneModifiers: [],
    }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    state,
    setSessionId,
    setConfig,
    setSliderPct,
    setMessageText,
    toggleTone,
    clearForm,
    reset,
  };
}
