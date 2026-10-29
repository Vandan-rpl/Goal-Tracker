// Row of clickable count boxes above an ideas table. `boxes` is
// [{ key, label, count, tone? }]; the box whose key equals `activeKey` is
// highlighted. `gridClassName` sets the columns (one box per column on
// large screens), e.g. "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7".
export default function IdeaCountBoxes({ boxes, activeKey, loading = false, onSelect, gridClassName }) {
  return (
    <div className={`grid gap-3 ${gridClassName}`}>
      {boxes.map((box) => {
        const active = activeKey === box.key;
        return (
          <button
            key={box.key}
            type="button"
            onClick={() => onSelect(box.key)}
            aria-pressed={active}
            className={`text-left bg-white px-4 py-3 rounded-2xl shadow-sm border transition cursor-pointer ${
              active ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-gray-100 hover:border-indigo-200"
            }`}
          >
            <div className={`text-xl font-bold ${box.tone === "danger" && box.count > 0 ? "text-red-600" : "text-gray-900"}`}>
              {loading ? "–" : box.count}
            </div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-0.5">{box.label}</div>
          </button>
        );
      })}
    </div>
  );
}
