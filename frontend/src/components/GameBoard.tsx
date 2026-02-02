import { useState, useCallback, useEffect } from "react";
import type { GameState } from "../hooks/useGameState";
import type { ToneModifier } from "../types";
import { aiSuggest } from "../api";
import InflationBar from "./InflationBar";
import ChatHistory from "./ChatHistory";
import SplitSlider from "./SplitSlider";
import MessagePanel from "./MessagePanel";
import ToneChips from "./ToneChips";
import ActionButtons from "./ActionButtons";
import DecisionPanel from "./DecisionPanel";

interface Props {
  state: GameState;
  connected: boolean;
  send: (type: string, payload: Record<string, unknown>) => void;
  setSliderPct: (pct: number) => void;
  setMessageText: (text: string) => void;
  toggleTone: (mod: ToneModifier) => void;
  clearForm: () => void;
}

export default function GameBoard({
  state,
  connected,
  send,
  setSliderPct,
  setMessageText,
  toggleTone,
  clearForm,
}: Props) {
  const [aiLoading, setAiLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Clear stale validation errors when user adjusts inputs
  useEffect(() => {
    if (validationError) setValidationError(null);
  }, [state.sliderPct, state.messageText]); // eslint-disable-line react-hooks/exhaustive-deps

  const money = state.gameParams.money_to_divide ?? state.config?.money_to_divide ?? 10000;
  const delta1 = state.gameParams.delta_player_1 ?? state.gameParams.delta_1 ?? state.config?.delta_1 ?? 0.95;
  const delta2 = state.gameParams.delta_player_2 ?? state.gameParams.delta_2 ?? state.config?.delta_2 ?? 0.95;
  const messagesAllowed = state.gameParams.messages_allowed ?? state.config?.messages_allowed ?? true;
  const rivalName = state.playerRole === "alice" ? "Bob" : "Alice";

  const handleAiSplit = useCallback(async () => {
    if (!state.sessionId) return;
    setAiLoading(true);
    try {
      const result = await aiSuggest(
        state.sessionId,
        "split",
        state.toneModifiers,
        state.messageText
      );
      if (result.suggested_split) {
        const alicePct = Math.round(
          (result.suggested_split.alice / money) * 100
        );
        setSliderPct(Math.max(0, Math.min(100, alicePct)));
      }
    } catch (e) {
      console.error("AI split failed:", e);
    } finally {
      setAiLoading(false);
    }
  }, [state.sessionId, state.toneModifiers, state.messageText, money, setSliderPct]);

  const handleAiWrite = useCallback(async () => {
    if (!state.sessionId) return;
    setAiLoading(true);
    try {
      const result = await aiSuggest(
        state.sessionId,
        "message",
        state.toneModifiers,
        state.messageText
      );
      if (result.suggested_message) {
        setMessageText(result.suggested_message);
      }
    } catch (e) {
      console.error("AI write failed:", e);
    } finally {
      setAiLoading(false);
    }
  }, [state.sessionId, state.toneModifiers, state.messageText, setMessageText]);

  const handleSend = useCallback(() => {
    const aliceGain = Math.round((state.sliderPct / 100) * money);
    const bobGain = money - aliceGain;

    // Validate
    if (aliceGain < 0 || bobGain < 0) {
      setValidationError("Both gains must be non-negative");
      return;
    }
    if (aliceGain + bobGain !== money) {
      setValidationError(`Gains must sum to $${money.toLocaleString()}`);
      return;
    }

    setValidationError(null);

    const payload: Record<string, unknown> = {
      alice_gain: aliceGain,
      bob_gain: bobGain,
    };
    if (messagesAllowed && state.messageText.trim()) {
      payload.message = state.messageText.trim();
    }

    send("submit_response", payload);
    clearForm();
  }, [state.sliderPct, state.messageText, money, messagesAllowed, send, clearForm]);

  const handleDecision = useCallback(
    (decision: "accept" | "reject") => {
      send("submit_response", { decision });
    },
    [send]
  );

  const isMyTurn =
    state.turnType === "proposal" || state.turnType === "decision";

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <InflationBar
        delta1={delta1 as number}
        delta2={delta2 as number}
        roundNumber={state.roundNumber}
        playerRole={state.playerRole}
      />

      {/* Connection indicator */}
      {!connected && (
        <div className="bg-amber-900/50 text-amber-300 text-xs text-center py-1">
          Reconnecting...
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat History */}
        <div className="w-1/2 border-r border-gray-800 flex flex-col">
          <ChatHistory
            messages={state.messages}
            turnType={state.turnType}
            playerRole={state.playerRole}
          />
        </div>

        {/* Right: Controls */}
        <div className="w-1/2 flex flex-col p-5 space-y-5 overflow-y-auto">
          {state.turnType === "waiting" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-pulse text-4xl mb-3">...</div>
                <p className="text-gray-500">Waiting for AI to respond</p>
              </div>
            </div>
          )}

          {state.turnType === "proposal" && (
            <>
              <SplitSlider
                pct={state.sliderPct}
                onChange={setSliderPct}
                moneyToDiv={money}
                playerRole={state.playerRole}
                onAiSplit={handleAiSplit}
                loading={aiLoading}
              />

              <MessagePanel
                text={state.messageText}
                onChange={setMessageText}
                onAiWrite={handleAiWrite}
                loading={aiLoading}
                disabled={!messagesAllowed}
                rivalName={rivalName}
              />

              <ToneChips
                active={state.toneModifiers}
                onToggle={toggleTone}
              />

              <ActionButtons
                onClear={clearForm}
                onSend={handleSend}
                disabled={!isMyTurn || !connected}
                validationError={validationError}
              />
            </>
          )}

          {state.turnType === "decision" && (
            <DecisionPanel
              lastOffer={state.lastOffer}
              moneyToDiv={money}
              onDecide={handleDecision}
            />
          )}
        </div>
      </div>
    </div>
  );
}
