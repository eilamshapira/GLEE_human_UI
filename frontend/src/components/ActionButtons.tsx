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
        <p className="text-red-400 text-xs mb-2">{validationError}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={onClear}
          className="flex-1 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition"
        >
          Clear
        </button>
        <button
          onClick={onSend}
          disabled={disabled}
          className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 font-semibold transition"
        >
          Send offer
        </button>
      </div>
    </div>
  );
}
