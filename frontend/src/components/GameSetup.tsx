import { useState } from "react";
import type { GameConfig, GameFamily, PlayerRole } from "../types";

interface Props {
  onStart: (config: GameConfig) => void;
  isCreating?: boolean;
}

export default function GameSetup({ onStart, isCreating = false }: Props) {
  const [family, setFamily] = useState<GameFamily>("bargaining");
  const [role, setRole] = useState<PlayerRole>("alice");
  const [aiUrl, setAiUrl] = useState("http://localhost:5001");
  const [money, setMoney] = useState(10000);
  const [maxRounds, setMaxRounds] = useState(12);
  const [delta1, setDelta1] = useState(0.95);
  const [delta2, setDelta2] = useState(0.95);
  const [completeInfo, setCompleteInfo] = useState(true);
  const [messagesAllowed, setMessagesAllowed] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onStart({
        game_family: family,
        player_role: role,
        ai_server_url: aiUrl,
        money_to_divide: money,
        max_rounds: maxRounds,
        delta_1: delta1,
        delta_2: delta2,
        complete_information: completeInfo,
        messages_allowed: messagesAllowed,
      });
    } catch (e) {
      alert(`Failed to start game: ${e}`);
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl p-8 w-full max-w-lg shadow-2xl border border-gray-800">
      <h1 className="text-2xl font-bold mb-6 text-center">
        GLEE — Economic Game Arena
      </h1>

      {/* Game Family */}
      <label className="block mb-1 text-sm text-gray-400">Game Family</label>
      <select
        value={family}
        onChange={(e) => setFamily(e.target.value as GameFamily)}
        className="w-full mb-4 p-2 rounded bg-gray-800 border border-gray-700 text-gray-100"
      >
        <option value="bargaining">Bargaining</option>
        <option value="negotiation" disabled>
          Negotiation (coming soon)
        </option>
        <option value="persuasion" disabled>
          Persuasion (coming soon)
        </option>
      </select>

      {/* Player Role */}
      <label className="block mb-1 text-sm text-gray-400">Play as</label>
      <div className="flex gap-3 mb-4">
        {(["alice", "bob"] as PlayerRole[]).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`flex-1 py-2 rounded font-medium transition ${
              role === r
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {r === "alice" ? "Alice (proposes first)" : "Bob (responds first)"}
          </button>
        ))}
      </div>

      {/* Money to divide */}
      <label className="block mb-1 text-sm text-gray-400">
        Money to divide
      </label>
      <select
        value={money}
        onChange={(e) => setMoney(Number(e.target.value))}
        className="w-full mb-4 p-2 rounded bg-gray-800 border border-gray-700 text-gray-100"
      >
        <option value={100}>$100</option>
        <option value={10000}>$10,000</option>
        <option value={1000000}>$1,000,000</option>
      </select>

      {/* Max Rounds */}
      <label className="block mb-1 text-sm text-gray-400">Max rounds</label>
      <select
        value={maxRounds}
        onChange={(e) => setMaxRounds(Number(e.target.value))}
        className="w-full mb-4 p-2 rounded bg-gray-800 border border-gray-700 text-gray-100"
      >
        <option value={6}>6</option>
        <option value={12}>12</option>
        <option value={99}>99 (unlimited)</option>
      </select>

      {/* Deltas */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block mb-1 text-sm text-gray-400">
            Alice delta
          </label>
          <select
            value={delta1}
            onChange={(e) => setDelta1(Number(e.target.value))}
            className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-gray-100"
          >
            {[0.8, 0.9, 0.95, 1.0].map((d) => (
              <option key={d} value={d}>
                {d} ({((1 - d) * 100).toFixed(0)}% inflation)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 text-sm text-gray-400">Bob delta</label>
          <select
            value={delta2}
            onChange={(e) => setDelta2(Number(e.target.value))}
            className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-gray-100"
          >
            {[0.8, 0.9, 0.95, 1.0].map((d) => (
              <option key={d} value={d}>
                {d} ({((1 - d) * 100).toFixed(0)}% inflation)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Toggles */}
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={completeInfo}
            onChange={(e) => setCompleteInfo(e.target.checked)}
            className="rounded"
          />
          Complete information
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={messagesAllowed}
            onChange={(e) => setMessagesAllowed(e.target.checked)}
            className="rounded"
          />
          Messages allowed
        </label>
      </div>

      {/* AI Server */}
      <label className="block mb-1 text-sm text-gray-400">
        AI server URL
      </label>
      <input
        type="text"
        value={aiUrl}
        onChange={(e) => setAiUrl(e.target.value)}
        className="w-full mb-6 p-2 rounded bg-gray-800 border border-gray-700 text-gray-100 font-mono text-sm"
      />

      {/* Start */}
      <button
        onClick={handleSubmit}
        disabled={loading || isCreating}
        className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 font-semibold text-lg transition"
      >
        {loading || isCreating ? "Starting..." : "Start Game"}
      </button>
    </div>
  );
}
