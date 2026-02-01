interface Props {
  lastOffer: Record<string, unknown> | null;
  moneyToDiv: number;
  onDecide: (decision: "accept" | "reject") => void;
}

export default function DecisionPanel({
  lastOffer,
  moneyToDiv,
  onDecide,
}: Props) {
  const aliceGain = Number(lastOffer?.alice_gain ?? 0);
  const bobGain = Number(lastOffer?.bob_gain ?? 0);
  const message = lastOffer?.message as string | undefined;

  const alicePct =
    moneyToDiv > 0 ? ((aliceGain / moneyToDiv) * 100).toFixed(0) : "0";
  const bobPct =
    moneyToDiv > 0 ? ((bobGain / moneyToDiv) * 100).toFixed(0) : "0";

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-200">
        Offer received — Accept or Reject?
      </h3>

      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-indigo-300">
            Alice: ${aliceGain.toLocaleString()} ({alicePct}%)
          </span>
          <span className="text-emerald-300">
            Bob: ${bobGain.toLocaleString()} ({bobPct}%)
          </span>
        </div>

        {/* Visual bar */}
        <div className="h-3 rounded-full bg-gray-700 overflow-hidden flex">
          <div
            className="bg-indigo-500 transition-all"
            style={{ width: `${alicePct}%` }}
          />
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${bobPct}%` }}
          />
        </div>

        {message && (
          <p className="mt-3 text-sm text-gray-300 italic">"{message}"</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onDecide("reject")}
          className="flex-1 py-3 rounded-lg bg-red-800 hover:bg-red-700 font-semibold transition"
        >
          Reject
        </button>
        <button
          onClick={() => onDecide("accept")}
          className="flex-1 py-3 rounded-lg bg-green-700 hover:bg-green-600 font-semibold transition"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
