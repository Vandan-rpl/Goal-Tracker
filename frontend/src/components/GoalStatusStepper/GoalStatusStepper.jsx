import React from 'react';

export const WORKFLOW_STEPS = [
  'Created',
  'Submitted',
  'Approval',
  'Active',
  'Completed',
];

const STATUS_TO_STEP = {
  draft: 0,
  submitted: 1,
  'hod approved': 2,
  'manager approved': 2,
  'reviewed by hod': 2,
  'business head approved': 2,
  'review by business head': 2,
  approved: 3,
  running: 3,
  postpone: 3,
  cancelled: 3,
  completed: 4,
  rejected: 2,
};

const EXCEPTIONAL_STATUSES = {
  rejected: { label: 'Rejected', color: 'red' },
  cancelled: { label: 'Cancelled', color: 'red' },
  postpone: { label: 'Postponed', color: 'amber' },
};

export default function GoalStatusStepper({ status, className = '' }) {
  const normalizedStatus = String(status || 'Draft').trim().toLowerCase();
  const activeStep = STATUS_TO_STEP[normalizedStatus] ?? 0;
  const isCompleted = normalizedStatus === 'completed';
  const exceptionalStatus = EXCEPTIONAL_STATUSES[normalizedStatus];
  const statusColor = exceptionalStatus?.color;
  const statusText = exceptionalStatus?.label || status || 'Draft';

  return (
    <section
      className={`w-full ${className}`}
      aria-label={`Goal workflow: ${statusText}`}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Goal workflow
        </span>
        <span
          className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
            statusColor === 'red'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : statusColor === 'amber'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : isCompleted
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-indigo-200 bg-indigo-50 text-indigo-700'
          }`}
        >
          {statusText}
        </span>
      </div>

      <ol className="grid grid-cols-5 items-start" aria-label="Workflow stages">
        {WORKFLOW_STEPS.map((label, index) => {
          const stepIsCurrent = index === activeStep && !isCompleted;
          const stepIsException = stepIsCurrent && Boolean(exceptionalStatus);
          const stepIsCompleted =
            index < activeStep || (isCompleted && index === activeStep);

          const markerColor = stepIsException
            ? statusColor === 'amber'
              ? 'border-amber-500 bg-amber-500 text-white'
              : 'border-rose-500 bg-rose-500 text-white'
            : stepIsCompleted
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : stepIsCurrent
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-400';

          const labelColor = stepIsException
            ? statusColor === 'amber'
              ? 'text-amber-800'
              : 'text-rose-700'
            : stepIsCompleted
              ? 'text-emerald-700'
              : stepIsCurrent
                ? 'text-indigo-700'
                : 'text-slate-400';

          return (
            <li
              key={label}
              className="relative flex min-w-0 flex-col items-center gap-2 text-center"
              aria-current={stepIsCurrent ? 'step' : undefined}
            >
              {index < WORKFLOW_STEPS.length - 1 && (
                <span
                  className={`absolute left-1/2 top-4 z-0 h-0.5 w-full ${
                    index < activeStep || isCompleted
                      ? 'bg-emerald-500'
                      : 'bg-slate-200'
                  }`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${markerColor}`}
                aria-hidden="true"
              >
                {stepIsException
                  ? statusColor === 'amber'
                    ? '!'
                    : '×'
                  : stepIsCompleted
                    ? '✓'
                    : index + 1}
              </span>
              <span className={`text-[11px] font-medium leading-tight ${labelColor}`}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
