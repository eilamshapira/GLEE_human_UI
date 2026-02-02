interface Props {
  delta1: number;
  delta2: number;
  roundNumber: number;
  playerRole: string;
}

export default function InflationBar({
  delta1,
  delta2,
  roundNumber,
  playerRole,
}: Props) {
  const inflation1 = ((1 - delta1) * 100).toFixed(1);
  const inflation2 = ((1 - delta2) * 100).toFixed(1);

  // Current value multiplier (delta^(round-1))
  const multiplier1 = Math.pow(delta1, Math.max(0, roundNumber - 1));
  const multiplier2 = Math.pow(delta2, Math.max(0, roundNumber - 1));

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-gray-700">Round {roundNumber}</span>
      </div>

      <div className="flex items-center gap-3">
        <Badge
          label="Alice"
          inflation={inflation1}
          multiplier={multiplier1}
          isYou={playerRole === "alice"}
          color="indigo"
        />
        <Badge
          label="Bob"
          inflation={inflation2}
          multiplier={multiplier2}
          isYou={playerRole === "bob"}
          color="emerald"
        />
      </div>
    </div>
  );
}

function Badge({
  label,
  inflation,
  multiplier,
  isYou,
  color,
}: {
  label: string;
  inflation: string;
  multiplier: number;
  isYou: boolean;
  color: string;
}) {
  const bg = color === "indigo" ? "bg-indigo-50" : "bg-emerald-50";
  const text = color === "indigo" ? "text-indigo-700" : "text-emerald-700";
  const border =
    color === "indigo" ? "border-indigo-200" : "border-emerald-200";

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${bg} border ${border}`}
    >
      <span className={`text-sm font-medium ${text}`}>
        {label}
        {isYou && " (You)"}
      </span>
      <span className="text-xs text-gray-500">
        {inflation}% inflation
      </span>
      <span className="text-xs text-gray-400">
        ({(multiplier * 100).toFixed(0)}% value)
      </span>
    </div>
  );
}
