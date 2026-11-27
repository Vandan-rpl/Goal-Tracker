const { poolPromise } = require("../config/db");
const projectModel = require("../models/projectModel");
const { verifyToken } = require("./authMiddleware");
const { requireTaskAccess } = require("./goalAccessMiddleware");
const { errorResponse } = require("../utils/apiResponse");

/**
 * Sets req.user.isProjectCreator: true when Admin put the user on
 * dbo.ProjectCreators. Read from the DB on every request (not the JWT), so
 * adding or removing someone applies straight away.
 * taskService.canCreateProjects reads it.
 */
const loadProjectCreator = async (req, res, next) => {
    try {
        const pool = await poolPromise;
        req.user.isProjectCreator = await projectModel.isProjectCreator(pool, Number(req.user.userId));
        next();
    } catch (error) {
        console.error("Load Project Creator Error:", error);
        return errorResponse(res, 500, "Failed to check project permissions.", [error.message]);
    }
};

// verifyToken, the Task Tracker grade gate (303 and above) and
// loadProjectCreator, for every task route.
const verifyTaskUser = [verifyToken, requireTaskAccess, loadProjectCreator];

module.exports = { loadProjectCreator, verifyTaskUser };
