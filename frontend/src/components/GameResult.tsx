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
  const isWin =
    playerRole === "alice" ? finalAlice > money / 2 : finalBob > money / 2;

  return (
    <div className="bg-gray-900 rounded-xl p-8 w-full max-w-md shadow-2xl border border-gray-800 text-center">
      <h2 className="text-3xl font-bold mb-2">
        {accepted ? "Deal!" : "No Deal"}
      </h2>

      <p className="text-gray-400 mb-6">
        {accepted
          ? "The offer was accepted."
          : "No agreement was reached — both players get $0."}
      </p>

      {accepted && (
        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
          <div className="flex justify-between text-lg mb-2">
            <span className="text-indigo-300">
              Alice: ${finalAlice.toLocaleString()}
            </span>
            <span className="text-emerald-300">
              Bob: ${finalBob.toLocaleString()}
            </span>
          </div>
          <div className="h-3 rounded-full bg-gray-700 overflow-hidden flex">
            <div
              className="bg-indigo-500"
              style={{
                width: `${money > 0 ? (finalAlice / money) * 100 : 50}%`,
              }}
            />
            <div
              className="bg-emerald-500"
              style={{
                width: `${money > 0 ? (finalBob / money) * 100 : 50}%`,
              }}
            />
          </div>
          <p className="mt-3 text-sm text-gray-400">
            You ({playerRole === "alice" ? "Alice" : "Bob"}) got $
            {(playerRole === "alice" ? finalAlice : finalBob).toLocaleString()}
          </p>
        </div>
      )}

      <button
        onClick={onPlayAgain}
        className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-lg transition"
      >
        Play Again
      </button>
    </div>
  );
}
