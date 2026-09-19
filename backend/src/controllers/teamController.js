const { poolPromise, sql } = require("../config/db");
const { notifyUser } = require("../services/notifyService");

const getTeamMembers = async (req, res) => {
  try {
    const loggedInId = req.user?.UserID || req.user?.userId;
    const loggedInRole = (req.user?.Role || req.user?.role || "").toUpperCase();

    // If a :userId param is passed, we're expanding a specific row in the
    // tree (e.g. Business Head clicked on a Manager) — fetch that person's
    // direct reports instead of the logged-in user's own.
    // Otherwise, default to the logged-in user's own direct reports (top level).
    const managerId = req.params.userId
      ? Number(req.params.userId)
      : loggedInId;

    // Only apply the special "Business Head root" query when we're looking
    // at the actual logged-in Business Head's own top-level view. Once
    // expanding further down the tree (e.g. that Manager's own reports),
    // it's a normal Manager/HOD lookup regardless of the logged-in user's role.
    const isBusinessHeadRootView =
      loggedInRole === "BUSINESSHEAD" && managerId === loggedInId;

    const pool = await poolPromise;
    const request = pool.request();
    request.input("ManagerID", sql.Int, managerId);

    let query = "";
    if (isBusinessHeadRootView) {
      query = `
                SELECT u.UserID, u.FirstName, u.LastName, u.Designation, u.Role,
                (SELECT COUNT(*) FROM dbo.Goals g WHERE g.UserID = u.UserID AND g.GoalStatus <> 'Draft') AS TotalGoals,
                CASE WHEN EXISTS (
                    SELECT 1 FROM dbo.Users sub
                    WHERE sub.ReportingManagerID = u.UserID OR sub.HODID = u.UserID
                ) THEN 1 ELSE 0 END AS HasDirectReports
                FROM dbo.Users u
                WHERE u.BusinessHeadID = @ManagerID
                  AND u.UserID <> @ManagerID
                  AND (
                      (u.ReportingManagerID IS NULL AND u.HODID IS NULL)
                      OR u.ReportingManagerID = @ManagerID
                      OR u.HODID = @ManagerID
                  )
            `;
    } else {
      query = `
                SELECT u.UserID, u.FirstName, u.LastName, u.Designation, u.Role,
                (SELECT COUNT(*) FROM dbo.Goals g WHERE g.UserID = u.UserID AND g.GoalStatus <> 'Draft') AS TotalGoals,
                CASE WHEN EXISTS (
                    SELECT 1 FROM dbo.Users sub
                    WHERE sub.ReportingManagerID = u.UserID OR sub.HODID = u.UserID
                ) THEN 1 ELSE 0 END AS HasDirectReports
                FROM dbo.Users u
                WHERE (u.ReportingManagerID = @ManagerID OR u.HODID = @ManagerID) AND u.UserID <> @ManagerID
            `;
    }

    const result = await request.query(query);
    return res.status(200).json({ success: true, data: result.recordset });
  } catch (error) {
    console.error("Get Team Members Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

const getUserGoals = async (req, res) => {
  try {
    const { userId } = req.params;
    const pool = await poolPromise;
    const request = pool.request();
    request.input("UserID", sql.Int, userId);

    const result = await request.query(`
            SELECT * FROM dbo.Goals 
            WHERE UserID = @UserID AND GoalStatus <> 'Draft' 
            ORDER BY CreatedDate DESC
        `);

    return res.status(200).json({ success: true, data: result.recordset });
  } catch (error) {
    console.error("Get User Goals Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { goalId } = req.params;
    const { goalStatus } = req.body;
    const performedBy = req.user?.UserID || req.user?.userId;

    const pool = await poolPromise;

    // Need the goal's owner + title before updating, so we know who to notify.
    const goalInfoResult = await pool
      .request()
      .input("GoalID", sql.BigInt, goalId)
      .query("SELECT UserID, GoalTitle FROM dbo.Goals WHERE GoalID = @GoalID");

    if (goalInfoResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Goal not found." });
    }
    const { UserID: goalOwnerId, GoalTitle: goalTitle } =
      goalInfoResult.recordset[0];

    const request = pool.request();
    request.input("GoalID", sql.BigInt, goalId);
    request.input("GoalStatus", sql.VarChar, goalStatus);

    const performedByRole = (
      req.user?.Role ||
      req.user?.role ||
      ""
    ).toUpperCase();

    if (performedByRole === "BUSINESSHEAD") {
      const allowedIds = await getScopedUserIds(
        pool,
        performedBy,
        "BusinessHead",
        { forApproval: true },
      );
      if (allowedIds !== null && !allowedIds.includes(goalOwnerId)) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to approve/reject this goal.",
        });
      }
    }

    await request.query(`
            UPDATE dbo.Goals 
            SET GoalStatus = @GoalStatus, 
                ModifiedDate = GETDATE(),
                ApprovedDate = CASE WHEN @GoalStatus IN ('HOD Approved', 'Business Head Approved', 'Approved') THEN GETDATE() ELSE ApprovedDate END
            WHERE GoalID = @GoalID
        `);

    // Notify the employee whose goal this is when it's Approved or Rejected.
    // Isolated in its own try/catch so a notification failure never turns
    // an otherwise-successful status update into an error response.
    if (
      goalStatus &&
      (goalStatus.includes("Approved") || goalStatus.includes("Rejected"))
    ) {
      try {
        const empResult = await pool
          .request()
          .input("UserID", sql.Int, goalOwnerId)
          .query(
            "SELECT UserID, FirstName, LastName, Email FROM dbo.Users WHERE UserID = @UserID",
          );
        const employee = empResult.recordset[0];

        if (employee) {
          const isApproved = goalStatus.includes("Approved");
          const employeeName = `${employee.FirstName} ${employee.LastName}`;
          const goalLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/goals/view/${goalId}`;

          await notifyUser(pool, {
            userId: employee.UserID,
            title: isApproved ? "Goal Approved" : "Goal Rejected",
            message: isApproved
              ? `Your goal "${goalTitle}" has been approved (status: ${goalStatus}).`
              : `Your goal "${goalTitle}" has been rejected (status: ${goalStatus}).`,
            type: isApproved ? "GOAL_APPROVED" : "GOAL_REJECTED",
            referenceId: Number(goalId),
            referenceType: "Goal",
            createdBy: performedBy,
            emailTo: employee.Email || undefined,
            emailSubject: isApproved
              ? `Your Goal Was Approved - ${employeeName}`
              : `Your Goal Was Rejected - ${employeeName}`,
            emailHtml: `
                            <h3>Hello ${employee.FirstName || "there"},</h3>
                            <p>Your goal titled <strong>"${goalTitle}"</strong> has been <strong>${isApproved ? "approved" : "rejected"}</strong>.</p>
                            <p>New status: <strong>${goalStatus}</strong></p>
                            <a href="${goalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Goal</a>
                        `,
          });
        }
      } catch (notifyErr) {
        console.error(
          `[NOTIF FAILED] teamController.updateStatus notify step. goalId=${goalId} userId=${goalOwnerId}:`,
          notifyErr,
        );
      }
    }

    return res
      .status(200)
      .json({ success: true, message: "Status updated successfully" });
  } catch (error) {
    console.error("Update Status Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports = { getTeamMembers, getUserGoals, updateStatus };
