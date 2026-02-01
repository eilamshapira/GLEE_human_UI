import type { ToneModifier } from "../types";

interface Props {
  active: ToneModifier[];
  onToggle: (mod: ToneModifier) => void;
}

const TONE_PAIRS: [ToneModifier, ToneModifier, string][] = [
  ["more_credible", "less_credible", "Credibility"],
  ["more_logical", "less_logical", "Logical"],
  ["more_aggressive", "less_aggressive", "Aggressive"],
  ["more_emotional", "less_emotional", "Emotional"],
];

export default function ToneChips({ active, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {TONE_PAIRS.map(([more, less, label]) => (
        <div key={label} className="flex items-center gap-1">
          <Chip
            label={`+${label.slice(0, 4).toLowerCase()}`}
            active={active.includes(more)}
            onClick={() => onToggle(more)}
          />
          <Chip
            label={`-${label.slice(0, 4).toLowerCase()}`}
            active={active.includes(less)}
            onClick={() => onToggle(less)}
          />
        </div>
      ))}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-xs font-mono transition ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300"
      }`}
    >
      {label}
    </button>
  );
}
