// Row state and styling shared by the goal worksheet pages (Add Goal and
// Bring Forward Goal). The row markup is components/GoalWorksheet.

export const worksheetControlClass =
  "block w-full min-h-[42px] px-[10px] border border-transparent bg-transparent text-xs text-[#202522] shadow-none placeholder:text-[#9aa39b] read-only:bg-slate-50 read-only:text-slate-500 focus:relative focus:z-[1] focus:border-2 focus:border-[#2c3e82] focus:bg-white focus:outline-none";
export const worksheetErrorClass =
  "m-0 px-[9px] pb-2 text-[10px] leading-[1.35] text-[#b3403f]";
export const worksheetHintClass =
  "m-0 px-2.25 pb-2 text-[10px] leading-[1.35] text-slate-500";
// A line inside a stacked cell (one sub-goal or joint employee). Its inputs
// use worksheetControlClass; the line only adds the divider between lines.
export const worksheetLineClass = "flex items-stretch border-b border-[#e4e9f0]";
export const worksheetLineRemoveClass =
  "grid w-8 shrink-0 cursor-pointer place-items-center text-slate-400 transition hover:bg-red-50 hover:text-red-600";
export const worksheetLineAddClass =
  "inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-[#2c3e82] hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline";

// Every goal field a worksheet row can edit. Pass a subset as a row's
// editableFields to show the rest read-only.
export const GOAL_SHEET_FIELDS = [
  "GoalTitle",
  "GoalCategory",
  "Priority",
  "Weightage",
  "StartDate",
  "Timeline",
  "SubGoals",
  "JointAccountabilities",
  "GoalDescription",
  "Measurability",
  "MeetPerformance",
  "ExceedPerformance",
];

// 'DD/MM/YYYY' -> 'YYYY-MM-DD', or "" when it is not a real date.
export const parseDateInput = (value) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return "";

  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return "";
  }

  return `${year}-${month}-${day}`;
};

// 'YYYY-MM-DD' -> 'DD/MM/YYYY'
export const formatDateForDisplay = (value) =>
  value ? value.split("-").reverse().join("/") : "";

const toInputValue = (value) =>
  value === null || value === undefined ? "" : String(value);

let lastRowKey = 0;
const createRowKey = () => `goal-row-${++lastRowKey}`;

// React keys for the lines inside a row's sub-goal and joint-employee cells,
// so removing a line does not shift the inputs of the lines after it.
let lastLineKey = 0;
const createLineKey = () => `line-${++lastLineKey}`;

// Status is shown only in a read-only sub-goal cell; it is never edited or
// saved from the worksheet.
export const createSubGoal = (subGoal = {}) => ({
  key: createLineKey(),
  SubGoalID: subGoal.SubGoalID,
  SubGoalTitle: toInputValue(subGoal.SubGoalTitle),
  Weightage: toInputValue(subGoal.Weightage),
  Status: toInputValue(subGoal.Status),
});

// EmployeeName is shown only in a read-only joint-employee cell, from a
// saved goal's joint accountability rows (which carry the employee's name).
export const createJointAccountability = (accountability = {}) => ({
  key: createLineKey(),
  UserID: toInputValue(accountability.UserID),
  ContributionNote: toInputValue(accountability.ContributionNote),
  Weightage: toInputValue(accountability.Weightage),
  EmployeeName: [accountability.FirstName, accountability.LastName]
    .filter(Boolean)
    .join(" "),
});

// One sheet row. `goal` is a saved goal (dates as 'YYYY-MM-DD'), or omitted
// for a new, unsaved row.
export const createGoalRow = (goal = {}) => ({
  key: createRowKey(),
  GoalID: goal.GoalID ?? null,
  GoalTitle: toInputValue(goal.GoalTitle),
  GoalCategory: toInputValue(goal.GoalCategory),
  Priority: goal.Priority || "Medium",
  Weightage: toInputValue(goal.Weightage),
  StartDate: formatDateForDisplay(goal.StartDate || ""),
  Timeline: formatDateForDisplay(goal.Timeline || ""),
  GoalDescription: toInputValue(goal.GoalDescription),
  Measurability: toInputValue(goal.Measurability),
  MeetPerformance: toInputValue(goal.MeetPerformance),
  ExceedPerformance: toInputValue(goal.ExceedPerformance),
  ValidationSource: toInputValue(goal.ValidationSource),
  CrossFunctionalGoal: Boolean(goal.CrossFunctionalGoal),
  SubGoals: (goal.SubGoals || []).map(createSubGoal),
  JointAccountabilities: (goal.JointAccountabilities || []).map(
    createJointAccountability,
  ),
  touched: {},
});
