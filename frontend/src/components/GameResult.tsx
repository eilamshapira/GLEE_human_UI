import type { GameParams } from "../types";

interface Props {
  outcome: string;
  finalAlice: number;
  finalBob: number;
  gameParams: GameParams;
  playerRole: string;
  onPlayAgain: () => void;
}

export default function GameResult({
  outcome,
  finalAlice,
  finalBob,
  gameParams,
  playerRole,
  onPlayAgain,
}: Props) {
  const accepted = outcome === "deal";

  const money = gameParams.money_to_divide ?? 10000;

  return (
    <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg border border-gray-200 text-center">
      <h2 className="text-3xl font-bold mb-2 text-gray-900">
        {accepted ? "Deal!" : "No Deal"}
      </h2>

      <p className="text-gray-500 mb-6">
        {accepted
          ? "The offer was accepted."
          : "No agreement was reached — both players get $0."}
      </p>

      {accepted && (
        <div className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-200">
          <div className="flex justify-between text-lg mb-3">
            <span className="font-semibold text-gray-700">
              Alice: ${finalAlice.toLocaleString()}
            </span>
            <span className="font-semibold text-gray-700">
              Bob: ${finalBob.toLocaleString()}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden flex">
            <div
              className="bg-slate-800"
              style={{
                width: `${money > 0 ? (finalAlice / money) * 100 : 50}%`,
              }}
            />
            <div
              className="bg-gray-400"
              style={{
                width: `${money > 0 ? (finalBob / money) * 100 : 50}%`,
              }}
            />
          </div>
          <p className="mt-3 text-sm text-gray-500">
            You ({playerRole === "alice" ? "Alice" : "Bob"}) got $
            {(playerRole === "alice" ? finalAlice : finalBob).toLocaleString()}
          </p>
        </div>
      )}

      <button
        onClick={onPlayAgain}
        className="w-full py-3 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-semibold text-lg transition"
      >
        Play Again
      </button>
    </div>
  );
}
