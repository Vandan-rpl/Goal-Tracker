const { sql } = require('../config/db');
const { getFiscalQuarter } = require('./fiscalQuarter');

/**
 * SMART Goal Validator
 * ============================================================
 * Checks a goal against all five SMART criteria before it's allowed to
 * move to 'Submitted' status. Draft goals are NOT validated here —
 * employees can save incomplete work-in-progress goals; the bar only
 * applies at the moment of actual submission (enforced in
 * goalController.js's createGoal()/updateGoal(), not in this file).
 *
 * Field names below are exactly the dbo.Goals columns used in
 * goalController.js's createGoal() — cross-checked against goalModel.js
 * too. No renaming/guessing:
 *   GoalTitle, GoalDescription, Measurability, MeetPerformance,
 *   ExceedPerformance, Weightage, GoalCategory, Timeline, CreatedDate
 *
 * ------------------------------------------------------------
 * Specific — GoalTitle AND GoalDescription both non-empty, and
 *   GoalDescription at least MIN_DESCRIPTION_LENGTH characters (not just
 *   a placeholder word).
 *
 * Measurable — Measurability must be filled, AND at least one of
 *   MeetPerformance / ExceedPerformance must describe a concrete metric.
 *
 * Achievable — Weightage must be between 5% and 30%, AND the SUM of
 *   Weightage across the employee's other active goals in the same fiscal
 *   quarter (plus this one) must not exceed 100%.
 *
 * Relevant — GoalCategory must be non-empty.
 *   IMPORTANT: there is no enum/allowed-list of GoalCategory values
 *   ANYWHERE in this codebase. I checked constants/ (constants.js,
 *   employeeConstants.js, permissions.js, roles.js, statusCodes.js,
 *   messages.js) — nothing resembling a goal-category list exists.
 *   GoalCategory is a free-text NVarChar column in dbo.Goals, and
 *   AddGoal.jsx's own field for it is a plain <input type="text">, not a
 *   dropdown. So this criterion only checks "is something set" — it does
 *   NOT validate against a fixed list, because there isn't one to
 *   validate against. Tell me the allowed categories and I'll add real
 *   enum validation here and turn the frontend field into a <select>.
 *
 * Time-bound — Timeline must be a valid date, strictly after CreatedDate
 *   (or "now" if CreatedDate isn't available yet, e.g. a brand new goal),
 *   and no more than MAX_YEARS_OUT years past that baseline.
 * ------------------------------------------------------------
 */

const MIN_DESCRIPTION_LENGTH = 20;
const MAX_YEARS_OUT = 2;

/**
 * Sums Weightage across an employee's other active goals in the same
 * fiscal quarter so submissions use the same 100% allocation boundary
 * enforced by goalController.js.
 *
 * @param {object} pool - resolved mssql pool
 * @param {number} userId
 * @param {number|string} [excludeGoalId] - the goal being updated, so it
 *   doesn't get counted against itself
 * @param {string|Date} [timeline] - this goal's Timeline, used to
 *   determine its fiscal quarter
 */
const getExistingWeightageTotal = async (pool, userId, excludeGoalId, timeline) => {
    const request = pool.request().input('UserID', sql.Int, userId);

    let query = `
        SELECT ISNULL(SUM(Weightage), 0) AS TotalWeightage
        FROM dbo.Goals
        WHERE UserID = @UserID
          AND GoalStatus NOT IN ('Rejected', 'Cancelled')
    `;

    if (excludeGoalId) {
        request.input('ExcludeGoalID', sql.BigInt, excludeGoalId);
        query += ` AND GoalID <> @ExcludeGoalID`;
    }

    if (timeline) {
        const timelineDate = new Date(timeline);
        if (!Number.isNaN(timelineDate.getTime())) {
            const { label: quarter } = getFiscalQuarter(timeline);
            request.input('Quarter', sql.VarChar, quarter);
            query += ` AND Quarter = @Quarter`;
        }
    }

    const result = await request.query(query);
    return Number(result.recordset[0]?.TotalWeightage || 0);
};

/**
 * @param {object} goalData
 * @param {string} goalData.GoalTitle
 * @param {string} goalData.GoalDescription
 * @param {string} goalData.Measurability
 * @param {string} [goalData.MeetPerformance]
 * @param {string} [goalData.ExceedPerformance]
 * @param {number|string} goalData.Weightage
 * @param {string} goalData.GoalCategory
 * @param {string|Date} goalData.Timeline
 * @param {string|Date} [goalData.CreatedDate] - omit for a brand-new goal
 *   (defaults the Time-bound baseline to "now")
 *
 * @param {object} [options]
 * @param {object} [options.pool] - resolved mssql pool; required to run
 *   the Achievable cross-goal weightage-sum check. If omitted, that half
 *   of the Achievable check is skipped (only the single-goal 5-30 range
 *   check still runs) — callers should always pass this in practice.
 * @param {number} [options.userId] - required alongside `pool` for the
 *   weightage-sum check
 * @param {number|string} [options.excludeGoalId] - pass the goal's own ID
 *   on update so it isn't double-counted against itself
 *
 * @returns {Promise<{ valid: boolean, errors: Record<string,string> }>}
 */
const validateSmartGoal = async (goalData = {}, options = {}) => {
    const errors = {};

    const {
        GoalTitle,
        GoalDescription,
        Measurability,
        MeetPerformance,
        ExceedPerformance,
        Weightage,
        GoalCategory,
        Timeline,
        CreatedDate
    } = goalData;

    // ---------------- Specific ----------------
    const title = (GoalTitle || '').toString().trim();
    const description = (GoalDescription || '').toString().trim();

    if (!title) {
        errors.GoalTitle = 'Goal must be Specific: a Goal Title is required.';
    }

    if (!description) {
        errors.GoalDescription = 'Goal must be Specific: a Goal Description is required.';
    } else if (description.length < MIN_DESCRIPTION_LENGTH) {
        errors.GoalDescription = `Goal must be Specific: description must be at least ${MIN_DESCRIPTION_LENGTH} characters long (not just a placeholder word).`;
    }

    // ---------------- Measurable ----------------
    const measurability = (Measurability || '').toString().trim();
    const meet = (MeetPerformance || '').toString().trim();
    const exceed = (ExceedPerformance || '').toString().trim();

    if (!measurability) {
        errors.Measurability = 'Goal must be Measurable: fill in the Measurability field describing how success will be measured.';
    }

    if (!meet && !exceed) {
        // Attach to MeetPerformance so the frontend has a single field to
        // anchor this message to; it's really an either/or requirement.
        errors.MeetPerformance = 'Goal must be Measurable: describe a concrete metric in either Meet Performance or Exceed Performance.';
    }

    // ---------------- Achievable ----------------
    const weightageNum = Number(Weightage);
    const weightageIsValidNumber =
        Weightage !== undefined &&
        Weightage !== null &&
        Weightage !== '' &&
        !Number.isNaN(weightageNum) &&
        Number.isFinite(weightageNum) &&
        weightageNum >= 5 &&
        weightageNum <= 30 &&
        Math.abs(weightageNum * 100 - Math.round(weightageNum * 100)) <= 1e-8;

    if (!weightageIsValidNumber) {
        errors.Weightage = 'Goal must be Achievable: Weightage must be from 5% to 30%, with no more than two decimal places.';
    } else if (options.pool && options.userId) {
        try {
            const existingTotal = await getExistingWeightageTotal(
                options.pool,
                options.userId,
                options.excludeGoalId,
                Timeline
            );
            const projectedTotal = Math.round((existingTotal + weightageNum) * 100) / 100;

            if (projectedTotal > 100) {
                errors.Weightage = `Goal must be Achievable: your total Weightage in this fiscal quarter would be ${projectedTotal}% (${existingTotal}% existing + ${weightageNum}% for this goal), which exceeds 100%.`;
            }
        } catch (sumError) {
            console.error('[SMART VALIDATION] Could not compute existing quarterly Weightage total:', sumError.message);
            errors.Weightage = 'Could not verify the total quarterly goal weightage. Please try again.';
        }
    }

    // ---------------- Relevant ----------------
    // See the big comment at the top of this file: no enum list exists
    // anywhere to validate against, so this is a non-empty check only.
    const category = (GoalCategory || '').toString().trim();
    if (!category) {
        errors.GoalCategory = 'Goal must be Relevant: a Goal Category must be set.';
    }

    // ---------------- Time-bound ----------------
    if (!Timeline) {
        errors.Timeline = 'Goal must be Time-bound: a Timeline (deadline) date is required.';
    } else {
        const timelineDate = new Date(Timeline);

        if (Number.isNaN(timelineDate.getTime())) {
            errors.Timeline = 'Goal must be Time-bound: Timeline is not a valid date.';
        } else {
            const parsedCreatedDate = CreatedDate ? new Date(CreatedDate) : null;
            const baseline = (parsedCreatedDate && !Number.isNaN(parsedCreatedDate.getTime()))
                ? parsedCreatedDate
                : new Date();

            if (timelineDate <= baseline) {
                errors.Timeline = 'Goal must be Time-bound: Timeline must be a future date relative to when the goal was created.';
            } else {
                const maxDate = new Date(baseline);
                maxDate.setFullYear(maxDate.getFullYear() + MAX_YEARS_OUT);

                if (timelineDate > maxDate) {
                    errors.Timeline = `Goal must be Time-bound: Timeline must be within ${MAX_YEARS_OUT} years of the goal's creation date.`;
                }
            }
        }
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
};

module.exports = {
    validateSmartGoal,
    getExistingWeightageTotal,
    MIN_DESCRIPTION_LENGTH,
    MAX_YEARS_OUT
};
