// Page frame for the Task Tracker sheets, in the Add Goal workbook style:
// grey-blue page, navy title bar, white sheet panel with square corners.

// Filter inputs / selects inside the frame.
export const taskFilterControlClass =
  "w-full border border-[#c6cedc] bg-white px-3 py-2 text-sm text-[#202522] focus:border-[#2c3e82] focus:outline-none focus:ring-1 focus:ring-[#2c3e82]";

export const taskFilterLabelClass = "mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#30415f]";

// Secondary button (outlined navy), as on Add Goal.
export const taskSecondaryButtonClass =
  "inline-flex cursor-pointer items-center gap-1.5 border border-blue-200 bg-white px-3.5 py-2 text-sm font-semibold text-[#2c3e82] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Props:
 *   barLabel     small caps text in the navy bar (e.g. "TASK WORKBOOK")
 *   barSubtitle  text after the divider in the bar
 *   badge        small outlined label above the title
 *   title, description
 *   actions      controls on the right of the title
 *   filters      filter controls, shown in a light panel under the title
 *   footer       note under the sheet
 *   children     the sheet
 */
export default function TaskWorkbookFrame({
  barLabel = "TASK WORKBOOK",
  barSubtitle,
  badge,
  title,
  description,
  actions = null,
  filters = null,
  footer = null,
  children,
}) {
  return (
    <div className="flex-1 min-h-screen overflow-y-auto bg-[#edf1f7] p-4 text-[#202522] font-[Segoe_UI,Arial,sans-serif] sm:p-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="overflow-hidden border border-[#c6cedc] bg-white shadow-[0_4px_18px_rgba(37,55,80,0.1)]">
          <div className="flex min-h-12 items-center gap-3 bg-[#2c3e82] px-3 py-2 text-xs font-bold tracking-[0.08em] text-white sm:px-5.5">
            <div className="grid size-7 place-items-center border border-white/45" aria-hidden="true">
              <svg className="size-4.5 stroke-current stroke-[1.5]" viewBox="0 0 24 24" fill="none">
                <path d="M4 3.5h16v17H4z" />
                <path d="M4 8.5h16M4 14h16M10 3.5v17M15 3.5v17" />
              </svg>
            </div>
            <span>{barLabel}</span>
            {barSubtitle && (
              <>
                <span className="h-5 w-px bg-white/40" aria-hidden="true" />
                <span className="text-[13px] font-normal tracking-normal">{barSubtitle}</span>
              </>
            )}
          </div>

          <div className="px-3 pt-5 pb-6 sm:px-8 sm:pt-7">
            <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
              <div>
                {badge && (
                  <span className="mb-2 inline-flex items-center gap-1.5 border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-[#2c3e82]">
                    {badge}
                  </span>
                )}
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
                {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
              </div>
              {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
            </div>

            {filters && (
              <div className="mb-5 grid grid-cols-1 gap-4 border border-[#cbd4e2] bg-[#f4f6fa] p-4 sm:grid-cols-2 lg:grid-cols-5">
                {filters}
              </div>
            )}

            {children}

            {footer && (
              <p className="mt-3 border border-[#cbd4e2] bg-blue-50/50 px-3 py-2.5 text-xs leading-relaxed text-[#2c3e82]">
                {footer}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
