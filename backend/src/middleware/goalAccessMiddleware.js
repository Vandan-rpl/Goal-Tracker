const { poolPromise, sql } = require("../config/db");
const { hasGoalTrackerAccess, hasTaskTrackerAccess } = require("../utils/goalAccess");

// Error codes the frontend can look for (user is below the module's grade).
const GOAL_ACCESS_DENIED = "GOAL_ACCESS_DENIED";
const TASK_ACCESS_DENIED = "TASK_ACCESS_DENIED";

/**
 * Builds a middleware that 403s unless the user's grade is 303 or above (or
 * they are Admin). Runs after verifyToken. Reads Role and Grade from the DB,
 * not the token, so a grade change by Admin applies at once.
 */
const requireModuleAccess = ({ hasAccess, code, message, label }) => async (req, res, next) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("UserID", sql.Int, req.user?.userId)
            .query("SELECT Role, Grade FROM dbo.Users WHERE UserID = @UserID AND IsActive = 1");

        const user = result.recordset[0];
        if (!user || !hasAccess({ role: user.Role, grade: user.Grade })) {
            return res.status(403).json({ success: false, code, message });
        }

        next();
    } catch (error) {
        console.error(`${label} access check error:`, error);
        return res.status(500).json({ success: false, message: "Internal server error during access check." });
    }
};

// Goal Tracker APIs.
const requireGoalAccess = requireModuleAccess({
    hasAccess: hasGoalTrackerAccess,
    code: GOAL_ACCESS_DENIED,
    message: "Goal Tracker is available only to employees of grade 303 and above.",
    label: "Goal",
});

// Task Tracker APIs.
const requireTaskAccess = requireModuleAccess({
    hasAccess: hasTaskTrackerAccess,
    code: TASK_ACCESS_DENIED,
    message: "Task Tracker is available only to employees of grade 303 and above.",
    label: "Task",
});

module.exports = { requireGoalAccess, requireTaskAccess, GOAL_ACCESS_DENIED, TASK_ACCESS_DENIED };
