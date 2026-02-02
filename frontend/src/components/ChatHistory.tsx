import { useEffect, useRef } from "react";
import type { ChatMessage, TurnType } from "../types";

interface Props {
  messages: ChatMessage[];
  turnType: TurnType;
  playerRole: string;
}

interface ParsedAction {
  type: "proposal" | "decision" | "system" | "text";
  player?: string;
  aliceGain?: number;
  bobGain?: number;
  message?: string;
  decision?: string;
  /** If true, the opponent rejected the previous offer before making this proposal */
  rejectedFirst?: boolean;
  raw: string;
}

function parseMessage(msg: ChatMessage): ParsedAction {
  const content = msg.content;

  // Try to extract JSON
  const jsonMatch = content.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[0].replace(/(?<=\d),(?=\d{3})/g, ""));
      if ("decision" in data) {
        return {
          type: "decision",
          decision: data.decision,
          raw: content,
        };
      }
      if ("alice_gain" in data || "bob_gain" in data) {
        return {
          type: "proposal",
          aliceGain: data.alice_gain,
          bobGain: data.bob_gain,
          message: data.message,
          raw: content,
        };
      }
    } catch {
      // Not valid JSON
    }
  }

  // Try GLEE's text format: "# Alice gain: 3500\n# Bob gain: 6500"
  const aliceMatch = content.match(/#\s*Alice\s+gain:\s*([\d,]+)/i);
  const bobMatch = content.match(/#\s*Bob\s+gain:\s*([\d,]+)/i);
  if (aliceMatch && bobMatch) {
    const msgMatch = content.match(/#\s*\w+'s message:\s*(.+)/);
    // Check if this message also contains a rejection of the previous offer
    const hasRejection = /rejected\s+(your|.*'s)\s+offer/i.test(content);
    return {
      type: "proposal",
      aliceGain: parseInt(aliceMatch[1].replace(/,/g, ""), 10),
      bobGain: parseInt(bobMatch[1].replace(/,/g, ""), 10),
      message: msgMatch ? msgMatch[1].trim() : undefined,
      rejectedFirst: hasRejection,
      raw: content,
    };
  }

  if (msg.role === "system") {
    return { type: "system", raw: content };
  }

  return { type: "text", raw: content };
}

export default function ChatHistory({ messages, turnType, playerRole }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Filter out system messages for display (they're long prompts)
  const displayMessages = messages.filter((m) => m.role !== "system");

  const statusText =
    turnType === "proposal"
      ? "Your turn to propose"
      : turnType === "decision"
        ? "Your turn to decide"
        : turnType === "waiting"
          ? "Waiting for AI..."
          : "Game over";

  const statusColor =
    turnType === "proposal" || turnType === "decision"
      ? "bg-blue-100 text-blue-700"
      : turnType === "waiting"
        ? "bg-amber-100 text-amber-700"
        : "bg-gray-100 text-gray-600";

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {displayMessages.length === 0 && (
          <p className="text-gray-400 text-sm text-center mt-8">
            Waiting for the game to start...
          </p>
        )}

        {(() => {
          // Track sequential round number by counting proposals.
          // GLEE numbers rounds per-player, so we compute our own.
          let roundCounter = 0;
          return displayMessages.map((msg, i) => {
            const parsed = parseMessage(msg);
            const isAssistant = msg.role === "assistant";

            if (parsed.type === "proposal") {
              // If opponent rejected before counter-proposing, show both
              if (parsed.rejectedFirst && !isAssistant) {
                roundCounter++;
                return (
                  <div key={i} className="space-y-3">
                    <DecisionCard decision="reject" isOwn={false} playerRole={playerRole} />
                    <div className="text-xs text-gray-400 italic px-2">
                      Round {roundCounter}
                    </div>
                    <ProposalCard
                      aliceGain={parsed.aliceGain ?? 0}
                      bobGain={parsed.bobGain ?? 0}
                      message={parsed.message}
                      isOwn={false}
                      playerRole={playerRole}
                    />
                  </div>
                );
              }
              roundCounter++;
              return (
                <div key={i} className="space-y-3">
                  <div className="text-xs text-gray-400 italic px-2">
                    Round {roundCounter}
                  </div>
                  <ProposalCard
                    aliceGain={parsed.aliceGain ?? 0}
                    bobGain={parsed.bobGain ?? 0}
                    message={parsed.message}
                    isOwn={isAssistant}
                    playerRole={playerRole}
                  />
                </div>
              );
            }

            if (parsed.type === "decision") {
              return (
                <DecisionCard
                  key={i}
                  decision={parsed.decision ?? ""}
                  isOwn={isAssistant}
                  playerRole={playerRole}
                />
              );
            }

            // Game engine messages (user role = instructions from GLEE)
            if (msg.role === "user") {
              const short = content_summary(msg.content);
              if (!short) return null;
              return (
                <div key={i} className="text-xs text-gray-400 italic px-2">
                  {short}
                </div>
              );
            }

            return (
              <div key={i} className="text-sm text-gray-600 px-2">
                {msg.content.slice(0, 200)}
              </div>
            );
          });
        })()}
        <div ref={endRef} />
      </div>

      {/* Status badge — pinned to bottom */}
      <div className="px-4 py-2.5 border-t border-gray-200">
        <span
          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}
        >
          {statusText}
        </span>
      </div>
    </div>
  );
}

function content_summary(text: string): string {
  // Round labels are handled by the render loop (sequential counter),
  // so this function never outputs round info.

  // If message contains an offer (GLEE text format), don't summarize — parseMessage handles it
  if (/#\s*Alice\s+gain:/i.test(text) && /#\s*Bob\s+gain:/i.test(text))
    return "";

  if (text.includes("accepted") && !text.includes("gain"))
    return "Offer was accepted.";
  if (text.includes("rejected") && !text.includes("gain"))
    return "Offer was rejected.";

  if (text.includes("Send your offer")) return "";
  if (text.includes("accept or reject") || text.includes("Do you accept"))
    return "";

  // Collapse GLEE's long game-rules prompts
  if (
    text.includes("Let's play a game") ||
    text.includes("You are playing") ||
    text.includes("The rules are")
  )
    return "Game rules";

  // Shorten long game engine messages
  if (text.length > 100) return text.slice(0, 80) + "...";
  return text;
}

function ProposalCard({
  aliceGain,
  bobGain,
  message,
  isOwn,
  playerRole,
}: {
  aliceGain: number;
  bobGain: number;
  message?: string;
  isOwn: boolean;
  playerRole: string;
}) {
  const border = isOwn ? "border-indigo-200" : "border-emerald-200";
  const bg = isOwn ? "bg-indigo-50" : "bg-emerald-50";
  const label = isOwn
    ? playerRole === "alice"
      ? "Alice (You)"
      : "Bob (You)"
    : playerRole === "alice"
      ? "Bob (AI)"
      : "Alice (AI)";

  return (
    <div className={`rounded-xl border ${border} ${bg} p-3`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className="text-xs text-gray-400">Proposal</span>
      </div>
      <div className="flex items-center gap-3 mb-1">
        <span className="text-sm text-gray-700">
          Alice: {aliceGain.toLocaleString()}
        </span>
        <span className="text-gray-300">|</span>
        <span className="text-sm text-gray-700">
          Bob: {bobGain.toLocaleString()}
        </span>
      </div>
      {message && (
        <p className="text-sm text-gray-500 mt-1 italic">"{message}"</p>
      )}
    </div>
  );
}

function DecisionCard({
  decision,
  isOwn,
  playerRole,
}: {
  decision: string;
  isOwn: boolean;
  playerRole: string;
}) {
  const accepted = decision.toLowerCase() === "accept";
  const color = accepted ? "text-emerald-600" : "text-red-500";
  const label = isOwn
    ? playerRole === "alice"
      ? "Alice (You)"
      : "Bob (You)"
    : playerRole === "alice"
      ? "Bob (AI)"
      : "Alice (AI)";

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <span className="text-xs text-gray-500">{label}: </span>
      <span className={`font-semibold ${color}`}>
        {accepted ? "Accepted" : "Rejected"}
      </span>
    </div>
  );
}
