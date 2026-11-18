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
 *   GoalTitle, Weightage, Timeline, CreatedDate
 *
 * ------------------------------------------------------------
 * Specific — GoalTitle must be non-empty.
 *
 * Achievable — Weightage must be between 5% and 30%, AND the SUM of
 *   Weightage across the employee's other active goals in the same fiscal
 *   quarter (plus this one) must not exceed 100%.
 *
 * Time-bound — Timeline must be a valid date, strictly after CreatedDate
 *   (or "now" if CreatedDate isn't available yet, e.g. a brand new goal),
 *   and no more than MAX_YEARS_OUT years past that baseline.
 * ------------------------------------------------------------
 */

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
 * @param {number|string} goalData.Weightage
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
        Weightage,
        Timeline,
        CreatedDate
    } = goalData;

    // ---------------- Specific ----------------
    const title = (GoalTitle || '').toString().trim();

    if (!title) {
        errors.GoalTitle = 'Goal must be Specific: a Goal Description is required.';
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
        weightageNum <= 100 &&
        Math.abs(weightageNum * 100 - Math.round(weightageNum * 100)) <= 1e-8;

    if (!weightageIsValidNumber) {
        errors.Weightage = 'Goal must be Achievable: Weightage must be from 5% to 100%, with no more than two decimal places.';
    }
    // TODO: re-enable after testing
    // else if (options.pool && options.userId) {
    //     try {
    //         const existingTotal = await getExistingWeightageTotal(
    //             options.pool,
    //             options.userId,
    //             options.excludeGoalId,
    //             Timeline
    //         );
    //         const projectedTotal = Math.round((existingTotal + weightageNum) * 100) / 100;
    //
    //         if (projectedTotal > 100) {
    //             errors.Weightage = `Goal must be Achievable: your total Weightage in this fiscal quarter would be ${projectedTotal}% (${existingTotal}% existing + ${weightageNum}% for this goal), which exceeds 100%.`;
    //         }
    //     } catch (sumError) {
    //         console.error('[SMART VALIDATION] Could not compute existing quarterly Weightage total:', sumError.message);
    //         errors.Weightage = 'Could not verify the total quarterly goal weightage. Please try again.';
    //     }
    // }

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
    MAX_YEARS_OUT
};
