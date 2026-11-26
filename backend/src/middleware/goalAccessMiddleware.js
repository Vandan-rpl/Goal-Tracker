const { poolPromise, sql } = require("../config/db");
const { hasGoalTrackerAccess } = require("../utils/goalAccess");

// Error code the frontend can look for (user is below the Goal Tracker grade).
const GOAL_ACCESS_DENIED = "GOAL_ACCESS_DENIED";

/**
 * Goal Tracker APIs only: 403 unless the user's grade is 303 or above (or
 * they are Admin). Runs after verifyToken. Reads Role and Grade from the DB,
 * not the token, so a grade change by Admin applies at once.
 */
const requireGoalAccess = async (req, res, next) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("UserID", sql.Int, req.user?.userId)
            .query("SELECT Role, Grade FROM dbo.Users WHERE UserID = @UserID AND IsActive = 1");

        const user = result.recordset[0];
        if (!user || !hasGoalTrackerAccess({ role: user.Role, grade: user.Grade })) {
            return res.status(403).json({
                success: false,
                code: GOAL_ACCESS_DENIED,
                message: "Goal Tracker is available only to employees of grade 303 and above.",
            });
        }

        next();
    } catch (error) {
        console.error("Goal access check error:", error);
        return res.status(500).json({ success: false, message: "Internal server error during access check." });
    }
};

module.exports = { requireGoalAccess, GOAL_ACCESS_DENIED };
