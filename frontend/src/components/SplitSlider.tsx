interface Props {
  pct: number;
  onChange: (pct: number) => void;
  moneyToDiv: number;
  playerRole: string;
  onAiSplit: () => void;
  loading: boolean;
}

export default function SplitSlider({
  pct,
  onChange,
  moneyToDiv,
  playerRole,
  onAiSplit,
  loading,
}: Props) {
  const aliceAmt = Math.round((pct / 100) * moneyToDiv);
  const bobAmt = moneyToDiv - aliceAmt;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-300">Split</label>
        <button
          onClick={onAiSplit}
          disabled={loading}
          className="text-xs px-3 py-1 rounded bg-violet-700 hover:bg-violet-600 disabled:bg-gray-700 transition"
        >
          {loading ? "..." : "Let AI split"}
        </button>
      </div>

      <div className="flex items-center gap-3 mb-1">
        <span className={`text-sm w-24 ${playerRole === "alice" ? "text-indigo-300 font-medium" : "text-gray-400"}`}>
          Alice {pct}%
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-indigo-500"
        />
        <span className={`text-sm w-24 text-right ${playerRole === "bob" ? "text-emerald-300 font-medium" : "text-gray-400"}`}>
          Bob {100 - pct}%
        </span>
      </div>

      <div className="flex justify-between text-xs text-gray-500">
        <span>${aliceAmt.toLocaleString()}</span>
        <span>${bobAmt.toLocaleString()}</span>
      </div>
    </div>
  );
}
