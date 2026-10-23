import { CalendarDays, Plus, X } from "lucide-react";
import {
  MAX_SUB_GOALS,
  getSubGoalWeightageSummary,
} from "../../utils/subGoals";
import {
  createJointAccountability,
  createSubGoal,
  formatDateForDisplay,
  parseDateInput,
  worksheetControlClass,
  worksheetErrorClass,
  worksheetHintClass,
  worksheetLineAddClass,
  worksheetLineClass,
  worksheetLineRemoveClass,
} from "../../utils/goalWorksheet";

const MIN_GOAL_WEIGHTAGE = 5;
const MAX_GOAL_WEIGHTAGE = 100;

const COLUMN_LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
];

const COLUMN_HEADINGS = [
  "Goal No.",
  "Goal Title",
  "Category",
  "Priority",
  "Weightage (%)",
  "Start Date",
  "End Date",
  "Sub-goals (% of this goal)",
  "Joint Accountability",
  "Goal Description",
  "Measurability",
  "Meet Performance Target",
  "Exceed Performance Target",
  "Actions",
];

// The scrolling worksheet grid: column letters, headings and the given
// GoalSheetRow rows.
export const GoalWorksheet = ({ ariaLabel, children }) => (
  <div
    className="max-w-full overflow-x-auto border border-[#aeb9cc] bg-white [scrollbar-color:#aeb9cc_#edf1f7] scrollbar-thin focus-visible:outline-2 focus-visible:outline-[#2c3e82] focus-visible:outline-offset-2"
    role="region"
    aria-label={ariaLabel}
    tabIndex="0"
  >
    <table className="w-full min-w-[2812px] table-fixed border-separate border-spacing-0 text-xs text-[#202522] [&_td]:h-32 [&_td]:border-r [&_td]:border-b [&_td]:border-[#d5dce5] [&_td]:bg-white [&_td]:p-0 [&_td]:align-top [&_td:last-child]:border-r-0">
      <colgroup>
        <col className="w-10.5" />
        <col className="w-22.5" />
        <col className="w-57.5" />
        <col className="w-37.5" />
        <col className="w-31.25" />
        <col className="w-31.25" />
        <col className="w-41.25" />
        <col className="w-41.25" />
        <col className="w-85" />
        <col className="w-90" />
        <col className="w-55" />
        <col className="w-55" />
        <col className="w-57.5" />
        <col className="w-57.5" />
        <col className="w-30" />
      </colgroup>
      <thead>
        <tr>
          <th
            className="sticky left-0 top-0 z-3 h-6.5 border-r border-b border-[#d5dce5] bg-[#edf1f7] text-center text-[11px] font-medium text-slate-600"
            aria-label="Row number"
          />
          {COLUMN_LETTERS.map((letter) => (
            <th
              className="sticky top-0 z-2 h-6.5 border-r border-b border-[#d5dce5] bg-[#edf1f7] text-center text-[11px] font-medium text-slate-600"
              key={letter}
            >
              {letter}
            </th>
          ))}
        </tr>
        <tr>
          <th
            className="sticky left-0 top-6.5 z-4 border-r border-b border-[#d5dce5] bg-[#e5eaf3] px-2.5 py-2 text-center text-[11px] font-bold text-[#30415f]"
            aria-label="Row number"
          >
            #
          </th>
          {COLUMN_HEADINGS.map((heading, index) => (
            <th
              className="sticky top-6.5 z-2 h-10.5 border-r border-b border-[#cbd4e2] bg-[#dce5f2] px-2.5 py-2 text-left text-[11px] font-bold leading-[1.35] text-[#30415f] align-middle"
              key={heading}
            >
              {heading}
              {[0, 1, 3, 4, 5, 6].includes(index) && (
                <span className="text-red-600"> *</span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

const getEmployeeName = (employee) =>
  [employee.FirstName, employee.LastName].filter(Boolean).join(" ");

const subGoalStatusClass = (status) =>
  status === "Completed"
    ? "border-green-200 bg-green-50 text-green-700"
    : "border-amber-200 bg-amber-50 text-amber-700";

// One goal row of the worksheet.
//
// - row: a row from createGoalRow.
// - editableFields: the GOAL_SHEET_FIELDS this row may change. The rest
//   render read-only in the same cells. Goal No. is always read-only.
// - onChange(field, updater): apply `updater(row) => row` to this row and
//   mark `field` as touched.
// - errors: messages to show, keyed by field name.
// - startDateRange: { quarter, min, max } that Start Date must fall in.
// - endDateRange: optional { min, max, hint } that limits the End Date
//   picker. Without it the picker starts at the Start Date.
// - onRemove / removing / removeDisabled: the Actions cell's Remove button,
//   shown only when onRemove is given.
const GoalSheetRow = ({
  row,
  rowNumber,
  goalNumber,
  editableFields,
  onChange,
  errors = {},
  startDateRange,
  endDateRange,
  jointAccountabilityUsers = [],
  jointAccountabilityUsersLoading = false,
  onRemove,
  removing = false,
  removeDisabled = false,
}) => {
  const isEditable = (field) => editableFields.includes(field);
  const subGoalWeightage = getSubGoalWeightageSummary(row.SubGoals);

  const renderCellMessage = (field, hint) => {
    const message = errors[field];
    if (message) return <p className={worksheetErrorClass}>{message}</p>;
    return hint ? <p className={worksheetHintClass}>{hint}</p> : null;
  };

  const handleCellChange = (e) => {
    const { name, value } = e.target;
    onChange(name, (current) => ({ ...current, [name]: value }));
  };

  const handleDatePickerChange = (e) => {
    const { name, value } = e.target;
    onChange(name, (current) => ({
      ...current,
      [name]: formatDateForDisplay(value),
    }));
  };

  // Sub-goal and joint-employee lines are addressed by their own key, and
  // every update copies the row, the list and the changed line, so no two
  // rows ever share a list or a line object.
  const updateSubGoals = (updater) =>
    onChange("SubGoals", (current) => ({
      ...current,
      SubGoals: updater(current.SubGoals),
    }));

  const addSubGoalRow = () =>
    updateSubGoals((subGoals) =>
      subGoals.length >= MAX_SUB_GOALS
        ? subGoals
        : [...subGoals, createSubGoal()],
    );

  const removeSubGoalRow = (lineKey) =>
    updateSubGoals((subGoals) =>
      subGoals.filter((subGoal) => subGoal.key !== lineKey),
    );

  const handleSubGoalChange = (lineKey, e) => {
    const { name, value } = e.target;
    updateSubGoals((subGoals) =>
      subGoals.map((subGoal) =>
        subGoal.key === lineKey ? { ...subGoal, [name]: value } : subGoal,
      ),
    );
  };

  const updateJointAccountabilities = (updater) =>
    onChange("JointAccountabilities", (current) => ({
      ...current,
      JointAccountabilities: updater(current.JointAccountabilities),
    }));

  const addJointAccountabilityRow = () =>
    updateJointAccountabilities((accountabilities) => [
      ...accountabilities,
      createJointAccountability(),
    ]);

  const removeJointAccountabilityRow = (lineKey) =>
    updateJointAccountabilities((accountabilities) =>
      accountabilities.filter(
        (accountability) => accountability.key !== lineKey,
      ),
    );

  const handleJointAccountabilityChange = (lineKey, e) => {
    const { name, value } = e.target;
    updateJointAccountabilities((accountabilities) =>
      accountabilities.map((accountability) =>
        accountability.key === lineKey
          ? { ...accountability, [name]: value }
          : accountability,
      ),
    );
  };

  const getJointEmployeeName = (ja) => {
    if (ja.EmployeeName) return ja.EmployeeName;
    const employee = jointAccountabilityUsers.find(
      (candidate) => String(candidate.UserID) === String(ja.UserID),
    );
    return employee ? getEmployeeName(employee) : "";
  };

  // A plain text, number or textarea cell, read-only unless editable.
  const fieldProps = (field) =>
    isEditable(field)
      ? { name: field, value: row[field], onChange: handleCellChange }
      : { name: field, value: row[field], readOnly: true };

  const renderDateCell = (field, label, pickerMin, pickerMax, hint) =>
    isEditable(field) ? (
      <>
        <div className="relative">
          <input
            className={`${worksheetControlClass} pr-8.5`}
            aria-label={`Goal ${goalNumber} ${label.toLowerCase()} (DD/MM/YYYY)`}
            aria-required="true"
            type="text"
            maxLength={10}
            placeholder="DD/MM/YYYY"
            {...fieldProps(field)}
          />
          <span className="absolute right-2.25 top-3 grid size-4.5 place-items-center text-slate-500">
            <CalendarDays size={16} aria-hidden="true" />
            <input
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              type="date"
              aria-label={`Choose goal ${goalNumber} ${label} from calendar`}
              title={`Choose ${label} from calendar`}
              name={field}
              min={pickerMin}
              max={pickerMax}
              value={parseDateInput(row[field])}
              onChange={handleDatePickerChange}
            />
          </span>
        </div>
        {renderCellMessage(field, hint)}
      </>
    ) : (
      <>
        <input
          className={worksheetControlClass}
          aria-label={`Goal ${goalNumber} ${label.toLowerCase()}`}
          type="text"
          {...fieldProps(field)}
        />
        {renderCellMessage(field)}
      </>
    );

  const renderTextareaCell = (field, label, placeholder) => (
    <td>
      <textarea
        className={`${worksheetControlClass} min-h-31.5 resize-y`}
        aria-label={`Goal ${goalNumber} ${label}`}
        rows="4"
        placeholder={placeholder}
        {...fieldProps(field)}
      />
      {renderCellMessage(field)}
    </td>
  );

  return (
    <tr>
      <th
        className="sticky left-0 z-1 border-r border-b border-[#d5dce5] bg-[#edf1f7] pt-3 text-center font-medium text-slate-600"
        scope="row"
      >
        {rowNumber}
      </th>
      <td>
        <input
          className={worksheetControlClass}
          aria-label={`Goal ${goalNumber} number`}
          type="number"
          name="GoalNumber"
          value={goalNumber}
          readOnly
        />
      </td>
      <td>
        <input
          className={worksheetControlClass}
          aria-label={`Goal ${goalNumber} title`}
          aria-required="true"
          type="text"
          placeholder="Enter goal title"
          {...fieldProps("GoalTitle")}
        />
        {renderCellMessage("GoalTitle")}
      </td>
      <td>
        <input
          className={worksheetControlClass}
          aria-label={`Goal ${goalNumber} category`}
          type="text"
          placeholder="Category"
          {...fieldProps("GoalCategory")}
        />
        {renderCellMessage("GoalCategory")}
      </td>
      <td>
        {isEditable("Priority") ? (
          <select
            className={worksheetControlClass}
            aria-label={`Goal ${goalNumber} priority`}
            name="Priority"
            value={row.Priority}
            onChange={handleCellChange}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        ) : (
          <input
            className={worksheetControlClass}
            aria-label={`Goal ${goalNumber} priority`}
            type="text"
            {...fieldProps("Priority")}
          />
        )}
        {renderCellMessage("Priority")}
      </td>
      <td>
        <input
          className={worksheetControlClass}
          aria-label={`Goal ${goalNumber} weightage percentage`}
          aria-required="true"
          type="number"
          min={MIN_GOAL_WEIGHTAGE}
          max={MAX_GOAL_WEIGHTAGE}
          step="10"
          placeholder="5 - 100"
          {...fieldProps("Weightage")}
        />
        {renderCellMessage("Weightage")}
      </td>
      <td>
        {renderDateCell(
          "StartDate",
          "Start Date",
          startDateRange.min,
          startDateRange.max,
          `Within ${startDateRange.quarter}`,
        )}
      </td>
      <td>
        {renderDateCell(
          "Timeline",
          "End Date",
          endDateRange
            ? endDateRange.min
            : parseDateInput(row.StartDate) || startDateRange.min,
          endDateRange?.max,
          endDateRange?.hint || "DD/MM/YYYY",
        )}
      </td>
      <td>
        {isEditable("SubGoals") ? (
          <>
            {row.SubGoals.map((subGoal, subIndex) => (
              <div className={worksheetLineClass} key={subGoal.key}>
                <span className="w-7 shrink-0 pt-3.5 text-center text-[11px] text-slate-500">
                  {subIndex + 1}
                </span>
                <input
                  className={`${worksheetControlClass} min-w-0 flex-1`}
                  aria-label={`Goal ${goalNumber} sub-goal ${subIndex + 1} title`}
                  type="text"
                  name="SubGoalTitle"
                  placeholder="Sub-goal title"
                  value={subGoal.SubGoalTitle}
                  onChange={(e) => handleSubGoalChange(subGoal.key, e)}
                />
                <div className="relative w-21 shrink-0 border-l border-[#e4e9f0]">
                  <input
                    className={`${worksheetControlClass} pr-6 text-right`}
                    aria-label={`Goal ${goalNumber} sub-goal ${subIndex + 1} weightage (% of this goal)`}
                    type="number"
                    min="0.01"
                    max="100"
                    step="10"
                    name="Weightage"
                    placeholder="0"
                    value={subGoal.Weightage}
                    onChange={(e) => handleSubGoalChange(subGoal.key, e)}
                  />
                  <span
                    className="pointer-events-none absolute right-2.5 top-3.5 text-[11px] text-slate-500"
                    aria-hidden="true"
                  >
                    %
                  </span>
                </div>
                <button
                  type="button"
                  className={worksheetLineRemoveClass}
                  aria-label={`Remove goal ${goalNumber} sub-goal ${subIndex + 1}`}
                  title="Remove sub-goal"
                  onClick={() => removeSubGoalRow(subGoal.key)}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 px-2.5 py-2.5">
              <button
                type="button"
                className={worksheetLineAddClass}
                disabled={row.SubGoals.length >= MAX_SUB_GOALS}
                onClick={addSubGoalRow}
              >
                <Plus size={13} aria-hidden="true" />
                Add sub-goal ({row.SubGoals.length}/{MAX_SUB_GOALS})
              </button>
              <span
                className={`text-[10px] ${row.SubGoals.length > 0 && !subGoalWeightage.isComplete ? "font-semibold text-[#b3403f]" : "text-slate-500"}`}
                aria-live="polite"
              >
                {row.SubGoals.length > 0
                  ? `Allocated ${subGoalWeightage.allocated.toFixed(2)}% · Remaining ${subGoalWeightage.remaining.toFixed(2)}%`
                  : "Optional"}
              </span>
            </div>
          </>
        ) : (
          <>
            {row.SubGoals.map((subGoal, subIndex) => (
              <div className={worksheetLineClass} key={subGoal.key}>
                <span className="w-7 shrink-0 pt-3.5 text-center text-[11px] text-slate-500">
                  {subIndex + 1}
                </span>
                <input
                  className={`${worksheetControlClass} min-w-0 flex-1`}
                  aria-label={`Goal ${goalNumber} sub-goal ${subIndex + 1} title`}
                  type="text"
                  value={subGoal.SubGoalTitle}
                  readOnly
                />
                <div className="relative w-17 shrink-0 border-l border-[#e4e9f0]">
                  <input
                    className={`${worksheetControlClass} pr-6 text-right`}
                    aria-label={`Goal ${goalNumber} sub-goal ${subIndex + 1} weightage (% of this goal)`}
                    type="text"
                    value={subGoal.Weightage}
                    readOnly
                  />
                  <span
                    className="pointer-events-none absolute right-2.5 top-3.5 text-[11px] text-slate-500"
                    aria-hidden="true"
                  >
                    %
                  </span>
                </div>
                <span className="flex w-23 shrink-0 items-center justify-center border-l border-[#e4e9f0] bg-slate-50 px-1.5">
                  <span
                    className={`border px-1.5 py-0.5 text-[10px] font-semibold ${subGoalStatusClass(subGoal.Status)}`}
                    aria-label={`Goal ${goalNumber} sub-goal ${subIndex + 1} status`}
                  >
                    {subGoal.Status || "Pending"}
                  </span>
                </span>
              </div>
            ))}
            {row.SubGoals.length === 0 && (
              <p className="px-2.5 py-2.5 text-[11px] text-slate-500">
                No sub-goals
              </p>
            )}
          </>
        )}
        {renderCellMessage("SubGoals")}
      </td>
      <td>
        {isEditable("JointAccountabilities") ? (
          <>
            {row.JointAccountabilities.map((ja, jaIndex) => (
              <div className={worksheetLineClass} key={ja.key}>
                <select
                  className={`${worksheetControlClass} w-36 shrink-0 truncate px-2`}
                  aria-label={`Goal ${goalNumber} joint employee ${jaIndex + 1}`}
                  name="UserID"
                  value={ja.UserID}
                  disabled={jointAccountabilityUsersLoading}
                  onChange={(e) => handleJointAccountabilityChange(ja.key, e)}
                >
                  <option value="">
                    {jointAccountabilityUsersLoading
                      ? "Loading..."
                      : "Select employee"}
                  </option>
                  {jointAccountabilityUsers.map((employee) => (
                    <option key={employee.UserID} value={employee.UserID}>
                      {getEmployeeName(employee)}
                      {employee.Designation ? ` - ${employee.Designation}` : ""}
                    </option>
                  ))}
                </select>
                <input
                  className={`${worksheetControlClass} min-w-0 flex-1 border-l-[#e4e9f0]`}
                  aria-label={`Goal ${goalNumber} joint employee ${jaIndex + 1} contribution`}
                  type="text"
                  name="ContributionNote"
                  placeholder="Contribution"
                  value={ja.ContributionNote}
                  onChange={(e) => handleJointAccountabilityChange(ja.key, e)}
                />
                <div className="relative w-17 shrink-0 border-l border-[#e4e9f0]">
                  <input
                    className={`${worksheetControlClass} pr-6 text-right`}
                    aria-label={`Goal ${goalNumber} joint employee ${jaIndex + 1} weightage percentage (optional)`}
                    type="number"
                    step="0.01"
                    name="Weightage"
                    placeholder="opt."
                    value={ja.Weightage}
                    onChange={(e) => handleJointAccountabilityChange(ja.key, e)}
                  />
                  <span
                    className="pointer-events-none absolute right-2.5 top-3.5 text-[11px] text-slate-500"
                    aria-hidden="true"
                  >
                    %
                  </span>
                </div>
                <button
                  type="button"
                  className={worksheetLineRemoveClass}
                  aria-label={`Remove goal ${goalNumber} joint employee ${jaIndex + 1}`}
                  title="Remove joint employee"
                  onClick={() => removeJointAccountabilityRow(ja.key)}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 px-2.5 py-2.5">
              <button
                type="button"
                className={worksheetLineAddClass}
                onClick={addJointAccountabilityRow}
              >
                <Plus size={13} aria-hidden="true" />
                Add joint employee
              </button>
              {row.JointAccountabilities.length === 0 && (
                <span className="text-[10px] text-slate-500">Optional</span>
              )}
            </div>
          </>
        ) : (
          <>
            {row.JointAccountabilities.map((ja, jaIndex) => (
              <div className={worksheetLineClass} key={ja.key}>
                <input
                  className={`${worksheetControlClass} w-36 shrink-0 truncate px-2`}
                  aria-label={`Goal ${goalNumber} joint employee ${jaIndex + 1}`}
                  type="text"
                  value={getJointEmployeeName(ja)}
                  readOnly
                />
                <input
                  className={`${worksheetControlClass} min-w-0 flex-1 border-l-[#e4e9f0]`}
                  aria-label={`Goal ${goalNumber} joint employee ${jaIndex + 1} contribution`}
                  type="text"
                  value={ja.ContributionNote}
                  readOnly
                />
                <div className="relative w-17 shrink-0 border-l border-[#e4e9f0]">
                  <input
                    className={`${worksheetControlClass} pr-6 text-right`}
                    aria-label={`Goal ${goalNumber} joint employee ${jaIndex + 1} weightage percentage`}
                    type="text"
                    value={ja.Weightage}
                    readOnly
                  />
                  {ja.Weightage !== "" && (
                    <span
                      className="pointer-events-none absolute right-2.5 top-3.5 text-[11px] text-slate-500"
                      aria-hidden="true"
                    >
                      %
                    </span>
                  )}
                </div>
              </div>
            ))}
            {row.JointAccountabilities.length === 0 && (
              <p className="px-2.5 py-2.5 text-[11px] text-slate-500">
                No joint employees
              </p>
            )}
          </>
        )}
        {renderCellMessage("JointAccountabilities")}
      </td>
      {renderTextareaCell("GoalDescription", "description")}
      {renderTextareaCell(
        "Measurability",
        "measurability",
        "Source of validation",
      )}
      {renderTextareaCell(
        "MeetPerformance",
        "meet performance target",
        "Expected target",
      )}
      {renderTextareaCell(
        "ExceedPerformance",
        "exceed performance target",
        "Exceed target",
      )}
      <td>
        {onRemove && (
          <div className="flex flex-col gap-1.5 p-2">
            <button
              type="button"
              onClick={onRemove}
              disabled={removeDisabled || removing}
              className="cursor-pointer border border-red-200 bg-white px-2 py-1.5 text-left text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {removing ? "Removing..." : "Remove"}
            </button>
          </div>
        )}
        {renderCellMessage("GoalID")}
      </td>
    </tr>
  );
};

export default GoalSheetRow;
