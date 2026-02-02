import type { ToneModifier } from "../types";

const MIN_TONE_CHARS = 8;

const TONE_PAIRS: [ToneModifier, ToneModifier, string][] = [
  ["more_credible", "less_credible", "Credible"],
  ["more_logical", "less_logical", "Logical"],
  ["more_aggressive", "less_aggressive", "Aggressive"],
  ["more_emotional", "less_emotional", "Emotional"],
];

interface Props {
  text: string;
  onChange: (text: string) => void;
  onAiWrite: () => void;
  onToneRewrite: (mod: ToneModifier) => void;
  loading: boolean;
  disabled: boolean;
  rivalName: string;
  aiEnabled: boolean;
  pasteBlocked: boolean;
  onPasteAttempt?: (blocked: boolean) => void;
}

export default function MessagePanel({
  text,
  onChange,
  onAiWrite,
  onToneRewrite,
  loading,
  disabled,
  rivalName,
  aiEnabled,
  pasteBlocked,
  onPasteAttempt,
}: Props) {
  if (disabled) return null;

  const toneDisabled = loading || text.length < MIN_TONE_CHARS;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          Message to {rivalName}
        </h3>
        {aiEnabled && (
          <button
            onClick={onAiWrite}
            disabled={loading}
            className="text-xs px-4 py-1.5 rounded-full bg-slate-800 text-white hover:bg-slate-700 disabled:bg-gray-300 disabled:text-gray-500 font-medium transition"
          >
            {loading ? "..." : "Let AI write"}
          </button>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          if (pasteBlocked) {
            e.preventDefault();
            onPasteAttempt?.(true);
          } else {
            onPasteAttempt?.(false);
          }
        }}
        onDrop={(e) => {
          if (pasteBlocked) {
            e.preventDefault();
            onPasteAttempt?.(true);
          }
        }}
        placeholder={`Type your message to ${rivalName}...`}
        rows={5}
        className="w-full p-4 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm resize-none focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 placeholder:text-gray-400"
      />
      {/* Tone chips */}
      {aiEnabled && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Adjust tone
          </h4>
          <div className="grid grid-cols-4 gap-2">
            {TONE_PAIRS.map(([more, less, label]) => (
              <div key={label} className="flex flex-col gap-1.5">
                <ToneChip
                  label={`More ${label.toLowerCase()}`}
                  onClick={() => onToneRewrite(more)}
                  disabled={toneDisabled}
                />
                <ToneChip
                  label={`Less ${label.toLowerCase()}`}
                  onClick={() => onToneRewrite(less)}
                  disabled={toneDisabled}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToneChip({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-2 py-1.5 rounded-full text-xs font-medium transition ${
        disabled
          ? "bg-gray-100 text-gray-300 cursor-not-allowed"
          : "bg-gray-100 text-gray-600 hover:bg-slate-800 hover:text-white border border-gray-200"
      }`}
    >
      {label}
    </button>
  );
}
