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
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-gray-900">
        Offer received — Accept or Reject?
      </h3>

      <div className="bg-white rounded-2xl p-5 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-700">
            Alice: ${aliceGain.toLocaleString()} ({alicePct}%)
          </span>
          <span className="text-sm font-semibold text-gray-700">
            Bob: ${bobGain.toLocaleString()} ({bobPct}%)
          </span>
        </div>

        {/* Visual bar */}
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
          <div
            className="bg-slate-800 transition-all"
            style={{ width: `${alicePct}%` }}
          />
          <div
            className="bg-gray-400 transition-all"
            style={{ width: `${bobPct}%` }}
          />
        </div>

        {message && (
          <div className="mt-4 text-sm text-gray-500 italic bg-gray-50 rounded-xl p-3 border-l-3 border-gray-300">
            "{message}"
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onDecide("reject")}
          className="flex-1 py-3 rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50 font-semibold transition"
        >
          Reject
        </button>
        <button
          onClick={() => onDecide("accept")}
          className="flex-1 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
