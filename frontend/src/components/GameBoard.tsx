import { useState, useCallback, useEffect } from "react";
import type { GameState } from "../hooks/useGameState";
import type { EventTracker } from "../hooks/useEventTracker";
import type { ToneModifier, ChatMessage } from "../types";
import { aiSuggest } from "../api";
import InflationBar from "./InflationBar";
import ChatHistory from "./ChatHistory";
import SplitSlider from "./SplitSlider";
import MessagePanel from "./MessagePanel";

import ActionButtons from "./ActionButtons";
import DecisionPanel from "./DecisionPanel";

interface Props {
  state: GameState;
  connected: boolean;
  send: (type: string, payload: Record<string, unknown>) => void;
  setSliderPct: (pct: number) => void;
  setMessageText: (text: string) => void;
  appendMessage: (msg: ChatMessage) => void;
  clearForm: () => void;
  tracker: EventTracker;
}

export default function GameBoard({
  state,
  connected,
  send,
  setSliderPct,
  setMessageText,
  appendMessage,
  clearForm,
  tracker,
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
  const aiEnabled = state.config?.assist_mode === "ai_assisted";
  const pasteBlocked = state.config?.assist_mode === "no_copypaste";

  const wrappedSetSliderPct = useCallback(
    (pct: number) => {
      setSliderPct(pct);
      tracker.trackSlider(pct);
    },
    [setSliderPct, tracker],
  );

  const wrappedSetMessageText = useCallback(
    (text: string) => {
      setMessageText(text);
      tracker.trackTyping(text);
    },
    [setMessageText, tracker],
  );

  const wrappedClearForm = useCallback(() => {
    tracker.trackClick("clear");
    clearForm();
  }, [clearForm, tracker]);

  const handlePasteAttempt = useCallback(
    (blocked: boolean) => {
      tracker.trackPaste(blocked);
    },
    [tracker],
  );

  const handleAiSplit = useCallback(async () => {
    if (!state.sessionId) return;
    if (state.config?.assist_mode !== "ai_assisted") return;
    tracker.trackClick("ai_split");
    setAiLoading(true);
    try {
      const result = await aiSuggest(
        state.sessionId,
        "split",
        [],
        state.messageText
      );
      if (result.suggested_split) {
        const alicePct = Math.round(
          (result.suggested_split.alice / money) * 100
        );
        setSliderPct(Math.max(0, Math.min(100, alicePct)));
        tracker.trackEvent("ai_suggest_result", { type: "split", ...result.suggested_split });
      }
    } catch (e) {
      console.error("AI split failed:", e);
    } finally {
      setAiLoading(false);
    }
  }, [state.sessionId, state.messageText, money, setSliderPct, tracker]);

  const handleAiWrite = useCallback(async () => {
    if (!state.sessionId) return;
    if (state.config?.assist_mode !== "ai_assisted") return;
    tracker.trackClick("ai_write");
    setAiLoading(true);
    try {
      const aliceGain = Math.round((state.sliderPct / 100) * money);
      const bobGain = money - aliceGain;
      const result = await aiSuggest(
        state.sessionId,
        "message",
        [],
        state.messageText,
        { alice: aliceGain, bob: bobGain }
      );
      if (result.suggested_message) {
        setMessageText(result.suggested_message);
        tracker.trackEvent("ai_suggest_result", { type: "message", length: result.suggested_message.length });
      }
    } catch (e) {
      console.error("AI write failed:", e);
    } finally {
      setAiLoading(false);
    }
  }, [state.sessionId, state.messageText, state.sliderPct, money, setMessageText, tracker]);

  const handleToneRewrite = useCallback(async (mod: ToneModifier) => {
    if (!state.sessionId) return;
    if (state.config?.assist_mode !== "ai_assisted") return;
    tracker.trackClick("tone_chip", { modifier: mod });
    setAiLoading(true);
    try {
      const aliceGain = Math.round((state.sliderPct / 100) * money);
      const bobGain = money - aliceGain;
      const result = await aiSuggest(
        state.sessionId,
        "tone_rewrite",
        [mod],
        state.messageText,
        { alice: aliceGain, bob: bobGain }
      );
      if (result.suggested_message) {
        setMessageText(result.suggested_message);
        tracker.trackEvent("ai_suggest_result", { type: "message", modifier: mod, length: result.suggested_message.length });
      }
    } catch (e) {
      console.error("AI tone rewrite failed:", e);
    } finally {
      setAiLoading(false);
    }
  }, [state.sessionId, state.messageText, state.sliderPct, money, setMessageText, tracker]);

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
    tracker.trackClick("send", { alice_gain: aliceGain, bob_gain: bobGain, message_length: state.messageText.length });

    const payload: Record<string, unknown> = {
      alice_gain: aliceGain,
      bob_gain: bobGain,
    };
    if (messagesAllowed && state.messageText.trim()) {
      payload.message = state.messageText.trim();
    }

    // Optimistic UI: show the proposal in chat immediately
    appendMessage({
      role: "assistant",
      content: JSON.stringify(payload),
    });

    send("submit_response", payload);
    clearForm();
  }, [state.sliderPct, state.messageText, money, messagesAllowed, send, appendMessage, clearForm, tracker]);

  const handleDecision = useCallback(
    (decision: "accept" | "reject") => {
      tracker.trackClick(decision);

      // Optimistic UI: show the decision in chat immediately
      appendMessage({
        role: "assistant",
        content: JSON.stringify({ decision }),
      });

      send("submit_response", { decision });
    },
    [send, appendMessage, tracker]
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
        <div className="bg-amber-50 text-amber-700 text-xs text-center py-1 border-b border-amber-200">
          Reconnecting...
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Controls */}
        <div className="w-1/2 flex flex-col p-6 space-y-5 overflow-y-auto bg-gray-50 border-r border-gray-200">
          {state.turnType === "waiting" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-pulse text-4xl mb-3 text-gray-300">...</div>
                <p className="text-gray-400">Waiting for AI to respond</p>
              </div>
            </div>
          )}

          {state.turnType === "proposal" && (
            <>
              <SplitSlider
                pct={state.sliderPct}
                onChange={wrappedSetSliderPct}
                moneyToDiv={money}
                playerRole={state.playerRole}
                onAiSplit={handleAiSplit}
                loading={aiLoading}
                aiEnabled={aiEnabled}
              />

              <MessagePanel
                text={state.messageText}
                onChange={wrappedSetMessageText}
                onAiWrite={handleAiWrite}
                onToneRewrite={handleToneRewrite}
                loading={aiLoading}
                disabled={!messagesAllowed}
                rivalName={rivalName}
                aiEnabled={aiEnabled}
                pasteBlocked={pasteBlocked}
                onPasteAttempt={handlePasteAttempt}
              />

              <ActionButtons
                onClear={wrappedClearForm}
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
              playerRole={state.playerRole}
              onDecide={handleDecision}
            />
          )}
        </div>

        {/* Right: Chat History */}
        <div className="w-1/2 flex flex-col bg-white">
          <ChatHistory
            messages={state.messages}
            turnType={state.turnType}
            playerRole={state.playerRole}
          />
        </div>
      </div>
    </div>
  );
}
