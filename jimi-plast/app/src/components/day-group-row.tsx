'use client';

export function DayGroupToggleAll({
  allExpanded,
  onExpandAll,
  onCollapseAll,
  expandLabel,
  collapseLabel,
}: {
  allExpanded: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  expandLabel: string;
  collapseLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={allExpanded ? onCollapseAll : onExpandAll}
      className="rounded border border-line px-3 py-1.5 text-xs text-ink hover:bg-line/30"
    >
      {allExpanded ? collapseLabel : expandLabel}
    </button>
  );
}

export function DayGroupRow({
  label,
  count,
  colSpan,
  expanded,
  onToggle,
}: {
  label: string;
  count: number;
  colSpan: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <tr onClick={onToggle} className="cursor-pointer select-none border-t border-line bg-line/10 hover:bg-line/20">
      <td colSpan={colSpan} className="px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink">
          <span className={`inline-block transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
          <span>{label}</span>
          <span className="text-muted">({count})</span>
        </div>
      </td>
    </tr>
  );
}
