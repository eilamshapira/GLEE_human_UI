interface Props {
  onClear: () => void;
  onSend: () => void;
  disabled: boolean;
  validationError: string | null;
}

export default function ActionButtons({
  onClear,
  onSend,
  disabled,
  validationError,
}: Props) {
  return (
    <div>
      {validationError && (
        <p className="text-red-500 text-xs mb-2">{validationError}</p>
      )}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onClear}
          className="px-5 py-2.5 text-gray-500 hover:text-gray-700 font-medium transition"
        >
          Clear
        </button>
        <button
          onClick={onSend}
          disabled={disabled}
          className="px-6 py-2.5 rounded-full bg-slate-800 text-white hover:bg-slate-700 disabled:bg-gray-300 disabled:text-gray-500 font-semibold transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Send offer
        </button>
      </div>
    </div>
  );
}
