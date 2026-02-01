interface Props {
  text: string;
  onChange: (text: string) => void;
  onAiWrite: () => void;
  loading: boolean;
  disabled: boolean;
  rivalName: string;
}

export default function MessagePanel({
  text,
  onChange,
  onAiWrite,
  loading,
  disabled,
  rivalName,
}: Props) {
  if (disabled) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-300">
          Message to {rivalName}
        </label>
        <button
          onClick={onAiWrite}
          disabled={loading}
          className="text-xs px-3 py-1 rounded bg-violet-700 hover:bg-violet-600 disabled:bg-gray-700 transition"
        >
          {loading ? "..." : "Let AI write"}
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Write a message to ${rivalName}...`}
        rows={3}
        className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm resize-none focus:outline-none focus:border-indigo-500"
      />
    </div>
  );
}
