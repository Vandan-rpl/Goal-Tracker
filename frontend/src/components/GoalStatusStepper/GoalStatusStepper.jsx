import React from 'react';

/**
 * ============================================================
 * GoalStatusStepper
 * ============================================================
 * Visual progress indicator for the goal workflow:
 *   Create → HOD Approval → Activated → Quarterly Update →
 *   HOD Review → Continuation → Final Evaluation → Reports
 *
 * This is purely presentational — it renders a step based on the
 * `status` string already coming back from the API. It does not fetch
 * or change any data, so dropping it into a page doesn't touch that
 * page's existing API calls or business logic.
 *
 * IMPORTANT ASSUMPTION (please verify against your real data):
 * The actual `GoalStatus` values that exist in the codebase today are:
 *   Draft, Submitted, HOD Approved, Reviewed By HOD,
 *   Business Head Approved, Approved, Rejected
 * There is no GoalStatus value in the current backend for "Activated",
 * "Continuation", or "Final Evaluation" — those three steps of your
 * 8-step spec don't appear to have a corresponding status string yet
 * (Quarterly Update / Final Evaluation look like separate pages/flows
 * rather than distinct GoalStatus values). The mapping below is my best
 * good-faith guess at slotting the real statuses into your 8 named
 * steps; please double check STATUS_TO_STEP against how your backend
 * actually distinguishes "Activated" vs "Continuation" before relying on
 * this for anything besides a visual approximation. Any status that
 * doesn't match a known one below safely falls back to step 0 (Create)
 * rather than crashing.
 * ============================================================
 */

export const WORKFLOW_STEPS = [
  'Create',
  'HOD Approval',
  'Activated',
  'Quarterly Update',
  'HOD Review',
  'Continuation',
  'Final Evaluation',
  'Reports',
];

// Best-effort mapping from real GoalStatus strings to a step index.
// Adjust freely — this is the one place that needs to change if your
// backend's status vocabulary differs from this guess.
const STATUS_TO_STEP = {
  Draft: 0,
  Submitted: 1,
  'HOD Approved': 2,
  Approved: 2,
  'Business Head Approved': 2,
  'Reviewed By HOD': 4,
  Rejected: 1, // rejected during the approval step; rendered in red, not green
};

const REJECTED_STATUSES = ['Rejected'];

export default function GoalStatusStepper({ status, className = '' }) {
  const isRejected = REJECTED_STATUSES.includes(status);
  const activeStep = STATUS_TO_STEP[status] ?? 0;

  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <div className="flex items-center min-w-max">
        {WORKFLOW_STEPS.map((label, index) => {
          const isCompleted = index < activeStep && !isRejected;
          const isCurrent = index === activeStep;
          const isCurrentRejected = isCurrent && isRejected;

          let circleClasses = 'bg-gray-100 text-gray-400 border-gray-200';
          if (isCompleted) {
            circleClasses = 'bg-emerald-500 text-white border-emerald-500';
          } else if (isCurrentRejected) {
            circleClasses = 'bg-red-500 text-white border-red-500';
          } else if (isCurrent) {
            circleClasses = 'bg-indigo-600 text-white border-indigo-600';
          }

          const labelClasses = isCurrent
            ? isCurrentRejected
              ? 'text-red-700 font-semibold'
              : 'text-indigo-700 font-semibold'
            : isCompleted
              ? 'text-emerald-700 font-medium'
              : 'text-gray-400';

          return (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-1.5 px-1" style={{ minWidth: 84 }}>
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${circleClasses}`}
                  title={label}
                >
                  {isCompleted ? '✓' : isCurrentRejected ? '✕' : index + 1}
                </div>
                <span className={`text-[11px] text-center leading-tight ${labelClasses}`}>
                  {label}
                </span>
              </div>
              {index < WORKFLOW_STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mt-[-18px] ${
                    index < activeStep && !isRejected ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}
                  style={{ minWidth: 20 }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
