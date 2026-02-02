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
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          Message to {rivalName}
        </h3>
        <button
          onClick={onAiWrite}
          disabled={loading}
          className="text-xs px-4 py-1.5 rounded-full bg-slate-800 text-white hover:bg-slate-700 disabled:bg-gray-300 disabled:text-gray-500 font-medium transition"
        >
          {loading ? "..." : "Let AI write"}
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Type your message to ${rivalName}...`}
        rows={3}
        className="w-full p-4 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm resize-none focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 placeholder:text-gray-400"
      />
    </div>
  );
}
