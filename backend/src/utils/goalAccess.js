const { GOAL_TRACKER_MAX_GRADE } = require("../constants/goalConstants");

/**
 * ============================================================
 * Goal Tracker / Task Tracker access by grade
 *
 * Only users of grade 303 and above may use the Goal Tracker and the Task
 * Tracker (same rule for both); Ideas is open to everyone. Grades are stored as text like
 * "303-303": the number before the "-" is the level, and a LOWER number is
 * a MORE senior grade (CFO / HOD 201, Managers 202-204, ...). So "303 and
 * above" = level <= GOAL_TRACKER_MAX_GRADE.
 *
 * Admin always has access (manages the module). A missing or non-numeric
 * grade (e.g. "E1") has no access.
 * ============================================================
 */

// "303-303" -> 303; null when the grade has no leading number.
const gradeLevel = (grade) => {
    const match = /^\s*(\d+)/.exec(String(grade ?? ""));
    return match ? Number(match[1]) : null;
};

const hasGoalTrackerAccess = ({ role, grade } = {}) => {
    if (String(role || "").toUpperCase() === "ADMIN") return true;
    const level = gradeLevel(grade);
    return level !== null && level <= GOAL_TRACKER_MAX_GRADE;
};

// The Task Tracker uses the same grade rule as the Goal Tracker.
const hasTaskTrackerAccess = hasGoalTrackerAccess;

/**
 * The same rule as a SQL condition on a dbo.Users alias, for jobs that pick
 * goal email recipients and for the Task Tracker's employee lists. Admin is not special-cased here: goal reminders
 * never go to Admin.
 */
const goalAccessSql = (alias = "u") => `
    TRY_CAST(LEFT(LTRIM(${alias}.Grade), CHARINDEX('-', LTRIM(${alias}.Grade) + '-') - 1) AS INT) <= ${Number(GOAL_TRACKER_MAX_GRADE)}`;

module.exports = {
    gradeLevel,
    hasGoalTrackerAccess,
    hasTaskTrackerAccess,
    goalAccessSql,
};
