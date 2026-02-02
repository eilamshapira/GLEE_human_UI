import { useState, useEffect } from "react";

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
  const alicePct = moneyToDiv > 0 ? Math.round((aliceAmt / moneyToDiv) * 100) : 0;
  const bobPct = 100 - alicePct;

  // Local editing state for the dollar inputs
  const [aliceEdit, setAliceEdit] = useState<string>("");
  const [bobEdit, setBobEdit] = useState<string>("");
  const [editingField, setEditingField] = useState<"alice" | "bob" | null>(null);

  // Sync display when not editing
  useEffect(() => {
    if (editingField !== "alice") setAliceEdit(aliceAmt.toLocaleString());
    if (editingField !== "bob") setBobEdit(bobAmt.toLocaleString());
  }, [aliceAmt, bobAmt, editingField]);

  const parseAmount = (val: string): number => {
    const num = parseInt(val.replace(/[^0-9]/g, ""), 10);
    return isNaN(num) ? 0 : num;
  };

  const handleAliceAmtChange = (val: string) => {
    setAliceEdit(val);
    const amt = Math.min(parseAmount(val), moneyToDiv);
    const newPct = moneyToDiv > 0 ? Math.round((amt / moneyToDiv) * 100) : 0;
    onChange(Math.max(0, Math.min(100, newPct)));
  };

  const handleBobAmtChange = (val: string) => {
    setBobEdit(val);
    const amt = Math.min(parseAmount(val), moneyToDiv);
    const alicePctNew = moneyToDiv > 0 ? Math.round(((moneyToDiv - amt) / moneyToDiv) * 100) : 0;
    onChange(Math.max(0, Math.min(100, alicePctNew)));
  };

  const handleBlur = () => {
    setEditingField(null);
    // Re-sync to clean up formatting
    setAliceEdit(aliceAmt.toLocaleString());
    setBobEdit(bobAmt.toLocaleString());
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-gray-900">Split</h3>
        <button
          onClick={onAiSplit}
          disabled={loading}
          className="text-xs px-4 py-1.5 rounded-full bg-slate-800 text-white hover:bg-slate-700 disabled:bg-gray-300 disabled:text-gray-500 font-medium transition"
        >
          {loading ? "..." : "Let AI split"}
        </button>
      </div>

      {/* Dollar amounts — editable, prominent */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col items-start">
          <span className={`text-sm font-medium mb-1 ${playerRole === "alice" ? "text-gray-900" : "text-gray-500"}`}>
            Alice
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-gray-400 text-lg">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={editingField === "alice" ? aliceEdit : aliceAmt.toLocaleString()}
              onFocus={() => { setEditingField("alice"); setAliceEdit(String(aliceAmt)); }}
              onChange={(e) => handleAliceAmtChange(e.target.value)}
              onBlur={handleBlur}
              className="text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-gray-200 focus:border-slate-800 outline-none w-28 transition"
            />
          </div>
          <span className="text-xs text-gray-400 mt-1">{alicePct}%</span>
        </div>

        <span className="text-gray-300 font-bold text-xl">&middot;</span>

        <div className="flex flex-col items-end">
          <span className={`text-sm font-medium mb-1 ${playerRole === "bob" ? "text-gray-900" : "text-gray-500"}`}>
            Bob
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-gray-400 text-lg">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={editingField === "bob" ? bobEdit : bobAmt.toLocaleString()}
              onFocus={() => { setEditingField("bob"); setBobEdit(String(bobAmt)); }}
              onChange={(e) => handleBobAmtChange(e.target.value)}
              onBlur={handleBlur}
              className="text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-gray-200 focus:border-slate-800 outline-none w-28 text-right transition"
            />
          </div>
          <span className="text-xs text-gray-400 mt-1">{bobPct}%</span>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
