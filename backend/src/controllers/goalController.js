const { poolPromise, sql } = require("../config/db");
const crypto = require("crypto");
const goalModel = require("../models/goalModel");
const jointAccountabilityModel = require("../models/jointAccountabilityModel");
const { notifyUser } = require("../services/notifyService");
const { validateSmartGoal } = require("../utils/smartGoalValidator");
const { calculateGoalProgress } = require("../utils/goalProgress");
const {
  calculateQuarterAllocationAndAchievement,
} = require("../utils/quarterPerformance");
const {
  getFiscalQuarter,
  getFiscalQuarterBounds,
  getFiscalQuarterBoundsFromLabel,
  toDateKey,
  getQuarterStartDate,
  getGoalCreationWindow,
  getManagerHodApprovalWindow,
  getCfoApprovalWindow,
  isWithinCarryForwardWindow,
} = require("../utils/fiscalQuarter");

// These statuses are set only by the completion request/approve endpoints.
const COMPLETION_STATUSES = ["Completion Submitted", "Completed"];
const COMPLETION_STATUS_MESSAGE =
  "Goal completion must be requested and approved through the completion workflow.";

// Goals in these statuses can never be carried forward.
const CARRY_FORWARD_BLOCKED_STATUSES = [
  "Completion Submitted",
  "Completed",
  "Draft",
  "Rejected",
  "Cancelled",
];

const MAX_GOALS_PER_QUARTER = 8;
const MIN_GOAL_WEIGHTAGE = 5;
const MAX_GOAL_WEIGHTAGE = 30;

const getQuarterGoalAllocation = async (
  transaction,
  userId,
  quarter,
  excludeGoalId = null,
) => {
  const request = new sql.Request(transaction)
    .input("UserID", sql.Int, userId)
    .input("Quarter", sql.VarChar, quarter);
  let query = `
    SELECT COUNT(*) AS GoalCount, ISNULL(SUM(Weightage), 0) AS TotalWeightage
    FROM dbo.Goals WITH (UPDLOCK, HOLDLOCK)
    WHERE UserID = @UserID
      AND Quarter = @Quarter
      AND GoalStatus NOT IN ('Rejected', 'Cancelled')
  `;

  if (excludeGoalId) {
    request.input("ExcludeGoalID", sql.BigInt, excludeGoalId);
    query += " AND GoalID <> @ExcludeGoalID";
  }

  const result = await request.query(query);
  const allocation = result.recordset[0];
  return {
    goalCount: Number(allocation?.GoalCount || 0),
    totalWeightageHundredths: Math.round(
      Number(allocation?.TotalWeightage || 0) * 100,
    ),
  };
};

const getGoalWeightageError = (weightage) => {
  const numericWeightage = Number(weightage);
  if (
    weightage === undefined ||
    weightage === null ||
    weightage === "" ||
    !Number.isFinite(numericWeightage) ||
    numericWeightage < MIN_GOAL_WEIGHTAGE ||
    numericWeightage > MAX_GOAL_WEIGHTAGE ||
    Math.abs(numericWeightage * 100 - Math.round(numericWeightage * 100)) >
      1e-8
  ) {
    return `Each goal must have a weightage from ${MIN_GOAL_WEIGHTAGE}% to ${MAX_GOAL_WEIGHTAGE}%, with no more than two decimal places.`;
  }
  return null;
};

const getQuarterAllocationError = (allocation, weightage) => {
  if (allocation.goalCount >= MAX_GOALS_PER_QUARTER) {
    return {
      field: "GoalCount",
      message: `A maximum of ${MAX_GOALS_PER_QUARTER} goals can be added per quarter.`,
    };
  }

  // TODO: re-enable after testing
  // const weightageHundredths = Math.round(Number(weightage) * 100);
  // const projectedTotalHundredths =
  //   allocation.totalWeightageHundredths + weightageHundredths;
  // if (projectedTotalHundredths > 10000) {
  //   return {
  //     field: "Weightage",
  //     message: `Quarterly goal weightage cannot exceed 100%. There is ${Math.max(0, 10000 - allocation.totalWeightageHundredths) / 100}% remaining.`,
  //   };
  // }
  return null;
};

const normalizeForDiff = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") return value.trim();
  return value;
};

const valuesEqual = (a, b) => {
  const na = normalizeForDiff(a);
  const nb = normalizeForDiff(b);
  if (typeof na === "number" || typeof nb === "number") {
    return Number(na) === Number(nb);
  }
  return String(na) === String(nb);
};

const buildGoalDiff = (oldRow, newValuesMap) => {
  const oldValues = {};
  const newValues = {};
  for (const [field, newVal] of Object.entries(newValuesMap)) {
    const oldVal = oldRow[field];
    if (!valuesEqual(oldVal, newVal)) {
      oldValues[field] = normalizeForDiff(oldVal);
      newValues[field] = normalizeForDiff(newVal);
    }
  }
  return { oldValues, newValues };
};

const hasJointAssignment = async (goalId, userId, transaction) => {
  const pool = transaction ? null : await poolPromise;
  const request = transaction
    ? new sql.Request(transaction)
    : pool.request();
  const result = await request
    .input("GoalID", sql.BigInt, goalId)
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT TOP 1 1 AS IsAssigned
      FROM dbo.GoalJointAccountability
      WHERE GoalID = @GoalID AND UserID = @UserID
    `);
  return result.recordset.length > 0;
};

//For the goal history
const TRACKED_GOAL_FIELDS = [
  "GoalNumber",
  "GoalTitle",
  "GoalDescription",
  "Measurability",
  "JointAccountability",
  "Weightage",
  "Priority",
  "Timeline",
  "MeetPerformance",
  "ExceedPerformance",
  "ValidationSource",
  "CrossFunctionalGoal",
  "GoalCategory",
];
 
// Parse a JSON diff string and keep only tracked fields.
// Returns null for plain-text values (e.g. "Approved"), which are status
// events rather than content changes.
const pickTrackedFields = (json) => {
  if (!json) return null;
  try {
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    return Object.fromEntries(
      TRACKED_GOAL_FIELDS.filter((field) => field in obj).map((field) => [
        field,
        obj[field],
      ]),
    );
  } catch {
    return null;
  }
};

// Helper function to log goal history using the values allowed by GoalHistory.Action.
const logGoalHistory = async (
  transaction,
  goalId,
  action,
  oldValue,
  newValue,
  remarks,
  performedBy,
) => {
  try {
    if (action !== "CREATE") {
      const oldTracked = pickTrackedFields(oldValue) || {};
      const newTracked = pickTrackedFields(newValue) || {};
      const changedFields = [
        ...new Set([...Object.keys(oldTracked), ...Object.keys(newTracked)]),
      ];
 
      // Status-only events (approve, reject, review, resubmit) are not logged
      if (changedFields.length === 0) return;
 
      oldValue = JSON.stringify(oldTracked);
      newValue = JSON.stringify(newTracked);
 
      // Rebuild the auto-generated remark so it no longer lists GoalStatus;
      // keep any custom remark a caller passed in
      if (!remarks || remarks.startsWith("Updated:")) {
        remarks = `Updated: ${changedFields.join(", ")}`;
      }
    }
 
    const req = new sql.Request(transaction);
    await req
      .input("GoalID", sql.BigInt, goalId)
      .input("Action", sql.VarChar, action === "CREATE" ? "Created" : "Updated")
      .input("OldValue", sql.NVarChar, oldValue || null)
      .input("NewValue", sql.NVarChar, newValue || null)
      .input("Remarks", sql.NVarChar, remarks || null)
      .input("PerformedBy", sql.Int, performedBy || null).query(`
        INSERT INTO dbo.GoalHistory (GoalID, Action, OldValue, NewValue, Remarks, PerformedBy, PerformedDate)
        VALUES (@GoalID, @Action, @OldValue, @NewValue, @Remarks, @PerformedBy, GETDATE())
      `);
  } catch (err) {
    console.error("Goal History Logging Error:", err);
  }
};

// Helper: fetch a user's basic contact/hierarchy info in one place.
// Reused by the notification call sites below so we don't repeat the same
// Users lookup query four different ways.
const getUserContact = async (pool, userId) => {
  const result = await pool.request().input("UserID", sql.Int, userId).query(`
            SELECT UserID, FirstName, LastName, Email, ReportingManagerID, HODID, BusinessHeadID
            FROM dbo.Users
            WHERE UserID = @UserID
        `);
  return result.recordset[0] || null;
};

// Notify the relevant hierarchy above the employee that a goal was submitted/updated for review.
const notifyGoalHierarchy = async (
  userId,
  newGoalID,
  GoalTitle,
  goalStatus,
) => {
  if (goalStatus !== "Submitted") return [];

  const pool = await poolPromise;
  const employee = await getUserContact(pool, userId);

  if (!employee) return [];

  const employeeName =
    `${employee.FirstName || ""} ${employee.LastName || ""}`.trim() ||
    "Employee";
  const approvalLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/goals/view/${newGoalID}`;

  const directApproverIds = [];

  if (
    employee.ReportingManagerID !== null &&
    employee.ReportingManagerID !== undefined &&
    employee.ReportingManagerID !== ""
  ) {
    directApproverIds.push(Number(employee.ReportingManagerID));
  }

  if (
    employee.HODID !== null &&
    employee.HODID !== undefined &&
    employee.HODID !== ""
  ) {
    directApproverIds.push(Number(employee.HODID));
  }

  if (
    employee.BusinessHeadID !== null &&
    employee.BusinessHeadID !== undefined &&
    employee.BusinessHeadID !== "" &&
    (!employee.ReportingManagerID || employee.ReportingManagerID === "") &&
    (!employee.HODID || employee.HODID === "")
  ) {
    directApproverIds.push(Number(employee.BusinessHeadID));
  }

  const superiorIds = directApproverIds
    .filter((id) => !Number.isNaN(id) && id !== userId)
    .filter((id, index, arr) => arr.indexOf(id) === index);

  if (superiorIds.length === 0) return [];

  const notifiedEmails = [];

  for (const superiorId of superiorIds) {
    const superior = await getUserContact(pool, superiorId);

    if (!superior || !superior.Email) continue;

    const superiorName =
      `${superior.FirstName || ""} ${superior.LastName || ""}`.trim() ||
      "Manager";
    const recipientEmail = superior.Email.trim();

    await notifyUser(pool, {
      userId: superiorId,
      title: "Goal Submitted / Updated",
      message: `Goal submitted by ${employeeName} awaiting your approval.`,
      type: "GOAL_SUBMITTED",
      referenceId: Number(newGoalID),
      referenceType: "Goal",
      createdBy: userId,
      emailTo: recipientEmail,
      emailSubject: `Goal Submitted for Approval - ${employeeName}`,
      emailHtml: `
                <h3>Hello ${superiorName},</h3>
                <p><strong>${employeeName}</strong> has submitted/updated a performance goal titled: <strong>"${GoalTitle}"</strong> for your review.</p>
                <p>Please click the link below to review this goal:</p>
                <a href="${approvalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Click Here to Review Goal</a>
            `,
    });

    notifiedEmails.push(recipientEmail);
  }

  return notifiedEmails;
};

// 1. Get All Goals
const getEmployeeDashboardSummary = (
  goals,
  carryForwardHistory,
  now = new Date(),
) => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const parseDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? null
      : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  };
  const firstCarryForwardByGoal = new Map();
  for (const entry of carryForwardHistory) {
    if (!firstCarryForwardByGoal.has(String(entry.GoalID))) {
      firstCarryForwardByGoal.set(String(entry.GoalID), entry);
    }
  }
  const originalQuarterOf = (goal) => {
    const createdDate = parseDate(goal.CreatedDate);
    return (
      firstCarryForwardByGoal.get(String(goal.GoalID))?.FromQuarter ||
      goal.Quarter ||
      (createdDate ? getFiscalQuarter(createdDate).label : "")
    );
  };
  const dayDifference = (date) =>
    Math.round((date.getTime() - today.getTime()) / 86400000);
  const statusOf = (goal) => String(goal.GoalStatus || "").trim().toLowerCase();

  const currentQuarter = getFiscalQuarter(now);
  const currentQuarterGoals = goals.filter(
    (goal) => originalQuarterOf(goal) === currentQuarter.label,
  );
  const allocatedGoals = currentQuarterGoals.filter(
    (goal) => !["rejected", "cancelled"].includes(statusOf(goal)),
  );
  const currentQuarterPerformance =
    calculateQuarterAllocationAndAchievement(allocatedGoals);
  const { allocatedPercentage, achievedPercentage, performancePercentage } =
    currentQuarterPerformance;

  const statusGroups = {
    Draft: ["draft"],
    "Pending approval": [
      "submitted",
      "manager approved",
      "hod approved",
      "reviewed by hod",
      "review by business head",
    ],
    Approved: ["approved", "business head approved", "running"],
    "Pending completion": ["completion submitted"],
    Rejected: ["rejected"],
    Completed: ["completed"],
  };
  const goalStatusCounts = Object.fromEntries(
    Object.entries(statusGroups).map(([label, statuses]) => [
      label,
      goals.filter((goal) => statuses.includes(statusOf(goal))).length,
    ]),
  );

  const quarterPeriods = [];
  let period = currentQuarter;
  for (let index = 0; index < 4; index += 1) {
    quarterPeriods.unshift(period);
    const quarterStart = getQuarterStartDate(period.quarterEndDate);
    quarterStart.setDate(quarterStart.getDate() - 1);
    period = getFiscalQuarter(quarterStart);
  }
  const includedQuarterLabels = new Set(
    quarterPeriods.map((quarter) => quarter.label),
  );
  for (const goal of goals) {
    const quarterMatch = /^Q([1-4])-(\d{4})$/.exec(originalQuarterOf(goal));
    if (!quarterMatch) continue;

    const quarterNumber = Number(quarterMatch[1]);
    const fiscalYear = Number(quarterMatch[2]);
    const quarterEndMonth = [5, 8, 11, 2][quarterNumber - 1];
    const quarterEndYear = fiscalYear - (quarterNumber < 4 ? 1 : 0);
    const goalQuarter = getFiscalQuarter(
      new Date(quarterEndYear, quarterEndMonth, 1),
    );
    if (
      goalQuarter.quarterEndDate > currentQuarter.quarterEndDate &&
      !includedQuarterLabels.has(goalQuarter.label)
    ) {
      includedQuarterLabels.add(goalQuarter.label);
      quarterPeriods.push(goalQuarter);
    }
  }
  quarterPeriods.sort(
    (left, right) => left.quarterEndDate - right.quarterEndDate,
  );
  const quarterHistory = quarterPeriods.map((quarter) => {
    const quarterGoals = goals.filter(
      (goal) => originalQuarterOf(goal) === quarter.label,
    );
    const quarterProgressGoals = quarterGoals.map((goal) => {
      const firstCarryForward = firstCarryForwardByGoal.get(
        String(goal.GoalID),
      );
      return firstCarryForward
        ? {
            ...goal,
            SubGoalCompletionPercentage:
              firstCarryForward.ProgressAtCarryForward,
          }
        : goal;
    });
    const allocated = quarterGoals.filter(
      (goal) => !["rejected", "cancelled"].includes(statusOf(goal)),
    );
    const allocatedIds = new Set(
      allocated.map((goal) => String(goal.GoalID)),
    );
    const performance = calculateQuarterAllocationAndAchievement(
      quarterProgressGoals.filter((goal) =>
        allocatedIds.has(String(goal.GoalID)),
      ),
    );
    return {
      quarter: quarter.label,
      ...performance,
      completedGoals: quarterGoals.filter(
        (goal) => statusOf(goal) === "completed",
      ).length,
      carriedForwardGoals: quarterGoals.filter((goal) =>
        firstCarryForwardByGoal.has(String(goal.GoalID)),
      ).length,
    };
  });

  const rejectedGoals = goals
    .filter((goal) => statusOf(goal) === "rejected")
    .map((goal) => ({ ...goal, AttentionReason: "Rejected" }));
  const overdueGoals = goals
    .filter((goal) => {
      const timeline = parseDate(goal.Timeline);
      return (
        statusOf(goal) !== "rejected" &&
        !["completed", "cancelled"].includes(statusOf(goal)) &&
        timeline &&
        timeline < today
      );
    })
    .map((goal) => ({ ...goal, AttentionReason: "Overdue" }));
  const draftGoals = goals
    .filter((goal) => {
      const timeline = parseDate(goal.Timeline);
      return (
        statusOf(goal) === "draft" &&
        (!timeline || timeline >= today)
      );
    })
    .map((goal) => ({ ...goal, AttentionReason: "Draft" }));
  const needsAttention = [
    ...rejectedGoals,
    ...overdueGoals,
    ...draftGoals,
  ].slice(0, 5);

  const upcomingDeadlines = goals
    .map((goal) => {
      const timeline = parseDate(goal.Timeline);
      return timeline
        ? { goal, daysUntilDeadline: dayDifference(timeline) }
        : null;
    })
    .filter(
      (entry) =>
        entry &&
        entry.daysUntilDeadline >= 0 &&
        entry.daysUntilDeadline <= 14 &&
        !["completed", "cancelled"].includes(statusOf(entry.goal)),
    )
    .sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline)
    .slice(0, 5)
    .map(({ goal, daysUntilDeadline }) => ({
      ...goal,
      DaysUntilDeadline: daysUntilDeadline,
    }));

  const currentQuarterStart = getQuarterStartDate(
    currentQuarter.quarterEndDate,
  );
  const previousQuarterEnd = new Date(currentQuarterStart);
  previousQuarterEnd.setDate(previousQuarterEnd.getDate() - 1);
  const carryForwardWindowOpen = [
    currentQuarter.quarterEndDate,
    previousQuarterEnd,
  ].some(isWithinCarryForwardWindow);
  const carryForwardStatuses = [
    "hod approved",
    "manager approved",
    "business head approved",
    "reviewed by hod",
    "review by business head",
    "approved",
  ];
  const eligibleCarryForwardGoals = carryForwardWindowOpen
    ? goals.filter((goal) => {
        const quarterEnd = parseDate(goal.QuarterEndDate);
        const timeline = parseDate(goal.Timeline);
        return (
          carryForwardStatuses.includes(statusOf(goal)) &&
          Number(goal.CarryForwardCount || 0) === 0 &&
          timeline &&
          timeline < today &&
          quarterEnd &&
          isWithinCarryForwardWindow(quarterEnd)
        );
      }).length
    : 0;

  return {
    currentQuarterWeightage: {
      quarter: currentQuarter.label,
      goalCount: allocatedGoals.length,
      quarterGoalCount: allocatedGoals.length,
      allocated: allocatedPercentage,
      achieved: achievedPercentage,
      performancePercentage,
      unallocated: Math.max(0, 100 - allocatedPercentage),
      allocatedPercentage,
      achievedPercentage,
      unallocatedPercentage: Math.max(0, 100 - allocatedPercentage),
    },
    goalStatusCounts,
    subGoalStatusCounts: {
      completed: currentQuarterGoals.reduce(
        (total, goal) => total + Number(goal.CompletedSubGoalCount || 0),
        0,
      ),
      inProgress: currentQuarterGoals.reduce(
        (total, goal) => total + Number(goal.InProgressSubGoalCount || 0),
        0,
      ),
      pending: currentQuarterGoals.reduce(
        (total, goal) => total + Number(goal.PendingSubGoalCount || 0),
        0,
      ),
    },
    needsAttention,
    upcomingDeadlines,
    quarterHistory,
    carryForward: {
      windowOpen: carryForwardWindowOpen,
      eligibleGoalCount: eligibleCarryForwardGoals,
    },
  };
};

const getGoals = async (req, res) => {
  const userId = req.user?.UserID || req.user?.userId;
  const { quarter, status } = req.query;

  try {
    const pool = await poolPromise;
    let query = `
              SELECT g.*, u.Username, u.FirstName, u.LastName,
                CAST(CASE WHEN g.UserID = @UserID THEN 1 ELSE 0 END AS BIT) AS IsGoalOwner,
                progress.SubGoalCompletionPercentage,
                progress.CompletedSubGoalCount,
                progress.InProgressSubGoalCount,
                progress.PendingSubGoalCount,
                progress.TotalSubGoalCount,
                timelineForDashboard.DashboardTimeline
            FROM dbo.Goals g
            JOIN dbo.Users u ON g.UserID = u.UserID
            OUTER APPLY (
              SELECT TOP 1
                TRY_CONVERT(
                  date,
                  CASE WHEN ISJSON(h.OldValue) = 1
                    THEN JSON_VALUE(h.OldValue, '$.Timeline')
                  END
                ) AS PreviousTimeline
              FROM dbo.GoalHistory h
              WHERE h.GoalID = g.GoalID
                AND h.Action = 'Updated'
                AND TRY_CONVERT(
                  date,
                  CASE WHEN ISJSON(h.NewValue) = 1
                    THEN JSON_VALUE(h.NewValue, '$.Timeline')
                  END
                ) = g.Timeline
              ORDER BY h.PerformedDate DESC, h.GoalHistoryID DESC
            ) pendingTimeline
            OUTER APPLY (
              SELECT ISNULL(
                SUM(CASE WHEN sg.Status = 'Completed' THEN sg.Weightage ELSE 0 END),
                0
              ) AS SubGoalCompletionPercentage,
                SUM(CASE WHEN sg.Status = 'Completed' THEN 1 ELSE 0 END) AS CompletedSubGoalCount,
                COUNT(sg.SubGoalID) AS TotalSubGoalCount,
                SUM(CASE WHEN sg.Status = 'In Progress' THEN 1 ELSE 0 END) AS InProgressSubGoalCount,
                SUM(CASE WHEN sg.Status = 'Pending' THEN 1 ELSE 0 END) AS PendingSubGoalCount
              FROM dbo.GoalSubGoals sg
              WHERE sg.GoalID = g.GoalID
            ) progress
            CROSS APPLY (
              SELECT CASE
                WHEN ISNULL(g.CarryForwardCount, 0) > 0
                  AND g.GoalStatus NOT IN ('Approved', 'Completed', 'Cancelled')
                  THEN ISNULL(pendingTimeline.PreviousTimeline, g.Timeline)
                ELSE g.Timeline
              END AS DashboardTimeline
            ) timelineForDashboard
            WHERE g.UserID = @UserID
    `;

    const request = pool.request();
    request.input("UserID", sql.Int, userId);

    if (quarter) {
      query += ` AND g.Quarter = @Quarter`;
      request.input("Quarter", sql.VarChar, quarter);
    }

    if (status) {
      query += ` AND g.GoalStatus = @Status`;
      request.input("Status", sql.VarChar, status);
    }

    query += ` ORDER BY g.CreatedDate DESC`;

    const result = await request.query(query);
    const carryForwardResult = await pool
      .request()
      .input("UserID", sql.Int, userId)
      .query(`
        SELECT history.GoalID, history.FromQuarter,
               history.ProgressAtCarryForward,
               history.CarriedForwardDate, history.HistoryID
        FROM dbo.GoalCarryForwardHistory history
        INNER JOIN dbo.Goals goal ON goal.GoalID = history.GoalID
        WHERE goal.UserID = @UserID
        ORDER BY history.CarriedForwardDate, history.HistoryID
      `);

    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      data: result.recordset,
      summary: getEmployeeDashboardSummary(
        result.recordset,
        carryForwardResult.recordset,
      ),
    });
  } catch (error) {
    console.error("Get Goals Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching goals.",
      errors: error.message,
    });
  }
};

const getJointAccountabilityUsers = async (req, res) => {
  const userId = req.user?.UserID || req.user?.userId;

  try {
    const pool = await poolPromise;
    const result = await pool.request().input("UserID", sql.Int, userId).query(`
        SELECT colleague.UserID, colleague.FirstName, colleague.LastName,
               colleague.Designation
        FROM dbo.Users owner
        INNER JOIN dbo.Users colleague
          ON colleague.DepartmentID = owner.DepartmentID
        WHERE owner.UserID = @UserID
          AND colleague.UserID <> @UserID
          AND colleague.IsActive = 1
        ORDER BY colleague.FirstName, colleague.LastName
      `);

    return res.status(200).json({ success: true, data: result.recordset });
  } catch (error) {
    console.error("Get Joint Accountability Users Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load department users.",
      errors: error.message,
    });
  }
};

const getAllEmployeeGoals = async (req, res) => {
  try {
    const role = (req.user?.Role || req.user?.role || "").toUpperCase();

    if (role !== "CFO" && role !== "BUSINESSHEAD" && role !== "ADMIN") {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized." });
    }

    const managerId = req.user?.UserID || req.user?.userId;
    const { quarter, status } = req.query;
    const pool = await poolPromise;
    const request = pool.request();
    request.input("ManagerID", sql.Int, managerId);
    request.input("RequesterRole", sql.VarChar, role);

    let query = `
            SELECT u.UserID, u.FirstName, u.LastName, u.Designation, u.Role,
                   g.GoalID, g.GoalTitle, g.GoalStatus, g.CreatedDate, g.ModifiedDate, g.ApprovedDate, g.Quarter,
                     CASE WHEN @RequesterRole IN ('CFO', 'ADMIN') OR (
                       u.BusinessHeadID = @ManagerID
                       AND (
                           (u.ReportingManagerID IS NULL AND u.HODID IS NULL)
                           OR u.ReportingManagerID = @ManagerID
                           OR u.HODID = @ManagerID
                       )
                   ) THEN 1 ELSE 0 END AS InApprovalScope
            FROM dbo.Users u
            JOIN dbo.Goals g ON g.UserID = u.UserID
            WHERE u.IsActive = 1
              AND g.GoalStatus IN (
              'HOD Approved',
              'Manager Approved',
              'Reviewed By HOD',
              'Review By Business Head',
              'Business Head Approved',
              'Approved'
            )
    `;

    if (quarter) {
      query += ` AND g.Quarter = @Quarter`;
      request.input("Quarter", sql.VarChar, quarter);
    }

    if (status) {
      query += ` AND g.GoalStatus = @Status`;
      request.input("Status", sql.VarChar, status);
    }

    query += ` ORDER BY g.CreatedDate DESC`;

    const result = await request.query(query);

    return res.status(200).json({ success: true, data: result.recordset });
  } catch (error) {
    console.error("Get All Employee Goals Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

const getTeamGoals = async (req, res) => {
  try {
    const requesterId = req.user?.UserID || req.user?.userId;
    const role = String(req.user?.Role || req.user?.role || "")
      .trim()
      .toUpperCase();
    const { quarter, status } = req.query;

    const allowedRoles = ["MANAGER", "HOD", "BUSINESSHEAD", "CFO", "ADMIN"];
    if (!allowedRoles.includes(role)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized." });
    }

    const pool = await poolPromise;
    const request = pool.request();
    request.input("RequesterID", sql.Int, requesterId);

    let scopeCondition;
    if (role === "CFO" || role === "ADMIN") {
      scopeCondition = "1 = 1"; // company-wide visibility
    } else if (role === "BUSINESSHEAD") {
      scopeCondition = "u.BusinessHeadID = @RequesterID";
    } else if (role === "HOD") {
      scopeCondition = "u.HODID = @RequesterID";
    } else {
      // MANAGER
      scopeCondition = "u.ReportingManagerID = @RequesterID";
    }

    let query = `
            SELECT g.*, u.FirstName, u.LastName, u.Designation, u.Role AS EmployeeRole
            FROM dbo.Goals g
            JOIN dbo.Users u ON g.UserID = u.UserID
            WHERE u.IsActive = 1
              AND ${scopeCondition}
              AND u.UserID <> @RequesterID
    `;

    if (quarter) {
      query += ` AND g.Quarter = @Quarter`;
      request.input("Quarter", sql.VarChar, quarter);
    }

    if (status) {
      query += ` AND g.GoalStatus = @Status`;
      request.input("Status", sql.VarChar, status);
    }

    query += ` ORDER BY u.FirstName, u.LastName, g.CreatedDate DESC`;

    const result = await request.query(query);

    return res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Get Team Goals Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching team goals.",
      errors: error.message,
    });
  }
};

// 2. Get Single Goal with Sub-Goals & History
const getGoalById = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await poolPromise;

    const goalResult = await pool
      .request()
      .input("GoalID", sql.BigInt, id)
      .query(`
        SELECT TOP 1 g.*, owner.FirstName AS OwnerFirstName,
          owner.LastName AS OwnerLastName
        FROM dbo.Goals g
        LEFT JOIN dbo.Users owner ON owner.UserID = g.UserID
        WHERE g.GoalID = @GoalID
      `);

    if (goalResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Goal not found." });
    }

    const goal = goalResult.recordset[0];
    const requesterUserId = req.user?.UserID || req.user?.userId;
    const requesterResult = await pool
      .request()
      .input("UserID", sql.Int, requesterUserId)
      .query(
        "SELECT Role FROM dbo.Users WHERE UserID = @UserID AND IsActive = 1",
      );
    if (requesterResult.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Your account is not authorized to view goals.",
      });
    }
    const requesterRole = String(requesterResult.recordset[0].Role || "")
      .trim()
      .toUpperCase();

    // A goal URL is not an authorization mechanism.  Restrict its details
    // to the owner, people explicitly assigned in the owner's reporting
    // hierarchy, and company-wide CFO/Admin users.
    const ownerHierarchy = await getUserContact(pool, goal.UserID);
    const assignedApproverIds = ownerHierarchy
      ? [
          ownerHierarchy.ReportingManagerID,
          ownerHierarchy.HODID,
          ownerHierarchy.BusinessHeadID,
        ]
          .filter(
            (approverId) => approverId !== null && approverId !== undefined,
          )
          .map(Number)
      : [];
    const jointAssignmentResult = await pool
      .request()
      .input("GoalID", sql.BigInt, id)
      .input("UserID", sql.Int, requesterUserId)
      .query(`
        SELECT TOP 1 JointAccountabilityID, ContributionNote, Status
        FROM dbo.GoalJointAccountability
        WHERE GoalID = @GoalID AND UserID = @UserID
      `);
    const jointAssignment = jointAssignmentResult.recordset[0] || null;
    const isJointParticipant = Boolean(jointAssignment);
    const canViewGoal =
      Number(requesterUserId) === Number(goal.UserID) ||
      ["CFO", "ADMIN"].includes(requesterRole) ||
      assignedApproverIds.includes(Number(requesterUserId)) ||
      isJointParticipant;

    if (!canViewGoal) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this goal.",
      });
    }

    const subGoalsResult = await pool
      .request()
      .input("GoalID", sql.BigInt, id)
      .query("SELECT * FROM dbo.GoalSubGoals WHERE GoalID = @GoalID");

    const historyResult = await pool
      .request()
      .input("GoalID", sql.BigInt, id)
      .query(
        "SELECT h.*, u.FirstName, u.LastName FROM dbo.GoalHistory h LEFT JOIN dbo.Users u ON h.PerformedBy = u.UserID WHERE h.GoalID = @GoalID ORDER BY h.PerformedDate DESC",
      );

    const canApproveOrReject =
      (!isJointParticipant || Number(requesterUserId) === Number(goal.UserID)) &&
      (requesterRole === "CFO" ||
        requesterRole === "ADMIN" ||
        (await canApproveOrRejectGoal(requesterUserId, goal.UserID)));
    const canManageJointAccountabilities =
      Number(requesterUserId) === Number(goal.UserID) ||
      (!isJointParticipant &&
        (["CFO", "ADMIN", "BUSINESSHEAD"].includes(requesterRole) ||
          (["HOD", "MANAGER"].includes(requesterRole) &&
            ownerHierarchy &&
            [ownerHierarchy.ReportingManagerID, ownerHierarchy.HODID].some(
              (approverId) => Number(approverId) === Number(requesterUserId),
            ))));

    return res.status(200).json({
      success: true,
      data: {
        ...goal,
        IsGoalOwner: Number(requesterUserId) === Number(goal.UserID),
        SubGoals: subGoalsResult.recordset,
        CompletionPercentage: calculateGoalProgress(subGoalsResult.recordset),
        History: historyResult.recordset,
        JointAccountabilities: canManageJointAccountabilities
          ? await jointAccountabilityModel.getJointAccountabilitiesByGoalId(id)
          : [],
        CanApproveOrReject: canApproveOrReject,
        IsJointParticipant: isJointParticipant,
        JointAccountabilityID: jointAssignment?.JointAccountabilityID || null,
        JointStatus: jointAssignment?.Status || null,
        ContributionNote: jointAssignment?.ContributionNote || null,
      },
    });
  } catch (error) {
    console.error("Get Goal By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching goal.",
      errors: error.message,
    });
  }
};

const MAX_SUB_GOALS = 5;
const SUB_GOAL_STATUSES = ["Pending", "Completed"];

// Sub-goals are optional; only rows with a title are kept.
const getTitledSubGoals = (subGoals) =>
  (Array.isArray(subGoals) ? subGoals : []).filter((subGoal) =>
    String(subGoal?.SubGoalTitle ?? "").trim(),
  );

const getSubGoalCountError = (titledSubGoals) =>
  titledSubGoals.length > MAX_SUB_GOALS
    ? `A goal can have no more than ${MAX_SUB_GOALS} sub-goals.`
    : null;

const getSubGoalStatus = (status, fallback = "Pending") =>
  SUB_GOAL_STATUSES.includes(status) ? status : fallback;

// startKey/timelineKey are 'YYYY-MM-DD' strings (or null when invalid);
// bounds are the inclusive quarter bounds from getFiscalQuarterBounds.
const getGoalDateErrors = (startKey, timelineKey, bounds) => {
  const errors = {};
  if (!startKey) {
    errors.StartDate = "Start Date is required and must be a valid date.";
  } else if (startKey < bounds.startKey || startKey > bounds.endKey) {
    errors.StartDate = `Start Date must be within ${bounds.label} (${bounds.startKey} to ${bounds.endKey}).`;
  }

  if (!timelineKey) {
    errors.Timeline = "End Date is required and must be a valid date.";
  } else if (startKey && timelineKey < startKey) {
    errors.Timeline = "End Date must be on or after Start Date.";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const isDateBeforeToday = (dateValue) => {
  if (!dateValue) return false;
  const date =
    dateValue instanceof Date
      ? dateValue.toISOString().slice(0, 10)
      : String(dateValue).slice(0, 10);
  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return date < todayDate;
};

const isGoalReviewWindowOpen = (goal) => {
  if (!goal) return false;

  const completion = Number(goal.CompletionPercentage ?? goal.CompletionPct ?? 0);
  if (Number.isFinite(completion) && completion >= 100) {
    return true;
  }

  const quarterEndDate = goal.QuarterEndDate || goal.QuarterEnd;
  if (!quarterEndDate) return false;

  const endDate = new Date(quarterEndDate);
  if (Number.isNaN(endDate.getTime())) return false;

  const reviewWindowStart = new Date(endDate);
  reviewWindowStart.setDate(endDate.getDate() - 10);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today >= reviewWindowStart;
};

// 3. Add Goal
const createGoal = async (req, res) => {
  const {
    GoalNumber,
    GoalTitle,
    GoalDescription,
    Measurability,
    JointAccountability,
    JointAccountabilities,
    Weightage,
    Priority,
    StartDate,
    Timeline,
    MeetPerformance,
    ExceedPerformance,
    ValidationSource,
    CrossFunctionalGoal,
    GoalCategory,
    GoalStatus,
    SubGoals,
  } = req.body;

  const userId = req.user?.UserID || req.user?.userId;

  const goalCreationWindow = getGoalCreationWindow();
  if (!goalCreationWindow.isOpen) {
    return res.status(403).json({
      success: false,
      message: `Goal creation is available only during the first 7 days of each quarter. The current window was ${goalCreationWindow.startDate.toLocaleDateString()} through ${goalCreationWindow.endDate.toLocaleDateString()}.`,
    });
  }

  if (COMPLETION_STATUSES.includes(GoalStatus)) {
    return res
      .status(400)
      .json({ success: false, message: COMPLETION_STATUS_MESSAGE });
  }

  if (!GoalTitle || !Weightage || !Priority || !StartDate || !Timeline) {
    return res
      .status(400)
      .json({ success: false, message: "Mandatory goal fields are missing." });
  }

  // Dates stay as 'YYYY-MM-DD' strings end to end to avoid IST -> UTC shifts.
  // Quarter is always derived from StartDate; any client Quarter is ignored.
  const startDateKey = toDateKey(StartDate);
  const timelineKey = toDateKey(Timeline);
  const dateErrors = getGoalDateErrors(
    startDateKey,
    timelineKey,
    getFiscalQuarterBounds(),
  );
  if (dateErrors) {
    return res.status(400).json({
      success: false,
      message: Object.values(dateErrors)[0],
      errors: dateErrors,
    });
  }
  const {
    label: goalQuarter,
    endKey: goalQuarterEndDate,
  } = getFiscalQuarterBounds(startDateKey);

  const goalWeightageError = getGoalWeightageError(Weightage);
  if (goalWeightageError) {
    return res.status(400).json({
      success: false,
      message: goalWeightageError,
      errors: { Weightage: goalWeightageError },
    });
  }

  const validSubGoals = getTitledSubGoals(SubGoals);
  const subGoalCountError = getSubGoalCountError(validSubGoals);
  if (subGoalCountError) {
    return res.status(400).json({
      success: false,
      message: subGoalCountError,
      errors: { SubGoals: subGoalCountError },
    });
  }

  const pool = await poolPromise;

  // SMART validation only applies when actually submitting for approval —
  // Draft goals can stay incomplete while the employee is still working
  // on them. See smartGoalValidator.js for the exact criteria and the
  // Achievable weightage-sum DB check this triggers.
  if (GoalStatus === "Submitted") {
    const { valid, errors } = await validateSmartGoal(
      {
        GoalTitle,
        GoalDescription,
        Measurability,
        MeetPerformance,
        ExceedPerformance,
        Weightage,
        GoalCategory,
        Timeline: timelineKey,
        CreatedDate: new Date(),
      },
      { pool, userId },
    );
    if (!valid) {
      return res.status(400).json({
        success: false,
        message:
          "This goal does not meet SMART criteria required for submission.",
        errors,
      });
    }
  }

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    const request = new sql.Request(transaction);

    request.input("UserID", sql.Int, userId);
    const nextGoalNumberResult = await new sql.Request(transaction).input(
      "UserID",
      sql.Int,
      userId,
    ).query(`
        SELECT ISNULL(MAX(GoalNumber), 0) + 1 AS NextGoalNumber
        FROM dbo.Goals
        WHERE UserID = @UserID
      `);
    request.input(
      "GoalNumber",
      sql.Int,
      nextGoalNumberResult.recordset[0].NextGoalNumber,
    );
    request.input("GoalTitle", sql.NVarChar, GoalTitle);
    request.input("GoalDescription", sql.NVarChar, GoalDescription || null);
    request.input("Measurability", sql.NVarChar, Measurability || null);
    request.input(
      "JointAccountability",
      sql.NVarChar,
      JointAccountability || null,
    );
    request.input("Weightage", sql.Decimal(5, 2), Weightage);
    request.input("Priority", sql.VarChar, Priority);
    request.input("StartDate", sql.Date, startDateKey);
    request.input("Timeline", sql.Date, timelineKey);
    const allocation = await getQuarterGoalAllocation(
      transaction,
      userId,
      goalQuarter,
    );
    const allocationError = getQuarterAllocationError(
      allocation,
      Weightage,
    );
    if (allocationError) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: allocationError.message,
        errors: { [allocationError.field]: allocationError.message },
      });
    }
    request.input("Quarter", sql.VarChar, goalQuarter);
    request.input("QuarterEndDate", sql.Date, goalQuarterEndDate);
    request.input("MeetPerformance", sql.NVarChar, MeetPerformance || null);
    request.input("ExceedPerformance", sql.NVarChar, ExceedPerformance || null);
    request.input("ValidationSource", sql.NVarChar, ValidationSource || null);
    request.input("CrossFunctionalGoal", sql.Bit, CrossFunctionalGoal ? 1 : 0);
    request.input("GoalCategory", sql.NVarChar, GoalCategory || null);
    request.input("GoalStatus", sql.VarChar, GoalStatus || "Draft");
    request.input(
      "SubmittedDate",
      sql.DateTime,
      GoalStatus === "Submitted" ? new Date() : null,
    );

    const goalInsertResult = await request.query(`
            INSERT INTO dbo.Goals (
                UserID, GoalNumber, GoalTitle, GoalDescription, Measurability, 
                JointAccountability, Weightage, Priority, StartDate, Timeline, Quarter, QuarterEndDate, MeetPerformance,
                ExceedPerformance, ValidationSource, CrossFunctionalGoal, GoalCategory,
                GoalStatus, DraftVersion, SubmittedDate, CreatedDate
            )
            OUTPUT INSERTED.GoalID
            VALUES (
                @UserID, @GoalNumber, @GoalTitle, @GoalDescription, @Measurability,
                @JointAccountability, @Weightage, @Priority, @StartDate, @Timeline, @Quarter, @QuarterEndDate, @MeetPerformance,
                @ExceedPerformance, @ValidationSource, @CrossFunctionalGoal, @GoalCategory, 
                @GoalStatus, 1, @SubmittedDate, GETDATE()
            )
        `);

    const newGoalID = goalInsertResult.recordset[0].GoalID;

    await logGoalHistory(
      transaction,
      newGoalID,
      "CREATE",
      null,
      GoalStatus || "Draft",
      "Goal created",
      userId,
    );

    for (let i = 0; i < validSubGoals.length; i++) {
      const sub = validSubGoals[i];
      const subRequest = new sql.Request(transaction);
      subRequest.input("GoalID", sql.BigInt, newGoalID);
      subRequest.input("SubGoalNo", sql.Int, i + 1);
      subRequest.input("SubGoalTitle", sql.NVarChar, sub.SubGoalTitle.trim());
      subRequest.input(
        "SubGoalDescription",
        sql.NVarChar,
        sub.SubGoalDescription || null,
      );
      subRequest.input("Weightage", sql.Decimal(5, 2), 0);
      subRequest.input("Target", sql.NVarChar, null);
      subRequest.input("Status", sql.VarChar, getSubGoalStatus(sub.Status));

      await subRequest.query(`
          INSERT INTO dbo.GoalSubGoals (GoalID, SubGoalNo, SubGoalTitle, SubGoalDescription, Weightage, Target, Status, CreatedDate)
          VALUES (@GoalID, @SubGoalNo, @SubGoalTitle, @SubGoalDescription, @Weightage, @Target, @Status, GETDATE())
      `);
    }

    await jointAccountabilityModel.insertJointAccountabilities(
      newGoalID,
      Array.isArray(JointAccountabilities) ? JointAccountabilities : [],
      transaction,
    );

    await transaction.commit();

    const notifiedEmails = await notifyGoalHierarchy(
      userId,
      newGoalID,
      GoalTitle,
      GoalStatus,
    );

    const responseMessage =
      notifiedEmails.length > 0
        ? `Your goal is submitted and email has been sent to ${notifiedEmails.length} approver(s) in your reporting hierarchy.`
        : "Goal created successfully.";

    return res.status(201).json({
      success: true,
      message: responseMessage,
      data: { GoalID: newGoalID },
    });
  } catch (error) {
    if (transaction._aborted === false && transaction._acquiredConnection) {
      try {
        await transaction.rollback();
      } catch (rbErr) {}
    }
    console.error("Create Goal Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while creating goal.",
      errors: error.message,
    });
  }
};

// 4. Update Goal
// NOTE: make sure this import exists at the top of the real controller file,
// pointing at wherever fiscalQuarter.js actually lives relative to this file:
// const { getFiscalQuarter, isWithinCarryForwardWindow } = require("../utils/fiscalQuarter");

const updateGoal = async (req, res) => {
  const { id } = req.params;
  const {
    GoalNumber,
    GoalTitle,
    GoalDescription,
    Measurability,
    JointAccountability,
    JointAccountabilities,
    Weightage,
    Priority,
    StartDate,
    Timeline,
    MeetPerformance,
    ExceedPerformance,
    ValidationSource,
    CrossFunctionalGoal,
    GoalCategory,
    GoalStatus,
    SubGoals,
  } = req.body;

  const userId = req.user?.UserID || req.user?.userId;
  const role = (req.user?.Role || req.user?.role || "").toUpperCase();
  const isEnterpriseGoalManager =
    role === "CFO" || role === "BUSINESSHEAD" || role === "ADMIN";

  if (COMPLETION_STATUSES.includes(GoalStatus)) {
    return res
      .status(400)
      .json({ success: false, message: COMPLETION_STATUS_MESSAGE });
  }

  const transaction = new sql.Transaction(await poolPromise);

  try {
    await transaction.begin();

    const checkRequest = new sql.Request(transaction);
    const checkResult = await checkRequest
      .input("GoalID", sql.BigInt, id)
      .query("SELECT * FROM dbo.Goals WHERE GoalID = @GoalID");

    if (checkResult.recordset.length === 0) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Goal not found." });
    }

    const existingGoal = checkResult.recordset[0];
    const currentStatus = existingGoal.GoalStatus;

    if (
      Number(existingGoal.UserID) !== Number(userId) &&
      (await hasJointAssignment(id, userId, transaction))
    ) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Joint participants can only update their contribution note.",
      });
    }

    if (currentStatus === "Completion Submitted") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "This goal is awaiting completion approval and cannot be edited.",
      });
    }

    const ownerHierarchyResult = await new sql.Request(transaction).input(
      "OwnerUserID",
      sql.Int,
      existingGoal.UserID,
    ).query(`
        SELECT ReportingManagerID, HODID
        FROM dbo.Users
        WHERE UserID = @OwnerUserID
      `);
    const ownerHierarchy = ownerHierarchyResult.recordset[0];
    const isTeamGoalManager =
      (role === "HOD" || role === "MANAGER") &&
      ownerHierarchy &&
      (Number(ownerHierarchy.ReportingManagerID) === Number(userId) ||
        Number(ownerHierarchy.HODID) === Number(userId));

    if (
      !isEnterpriseGoalManager &&
      !isTeamGoalManager &&
      Number(existingGoal.UserID) !== Number(userId)
    ) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to modify this goal.",
      });
    }

    const terminalStatus = ["Completed", "Cancelled"].includes(currentStatus);
    const isGoalOwner = Number(existingGoal.UserID) === Number(userId);
    const isApprover = isEnterpriseGoalManager || isTeamGoalManager;
    const canEditAllFields =
      !terminalStatus &&
      (["Draft", "Rejected"].includes(currentStatus) ||
        (isApprover && !isGoalOwner));
    const timelineOnlyEditStatuses = [
      "HOD Approved",
      "Manager Approved",
      "Business Head Approved",
      "Reviewed By HOD",
      "Review By Business Head",
      "Approved",
    ];
    const isCarryForward =
      isGoalOwner &&
      !canEditAllFields &&
      !terminalStatus &&
      timelineOnlyEditStatuses.includes(currentStatus) &&
      Number(existingGoal.CarryForwardCount || 0) === 0 &&
      isDateBeforeToday(existingGoal.Timeline);

    if (
      isGoalOwner &&
      !canEditAllFields &&
      CARRY_FORWARD_BLOCKED_STATUSES.includes(currentStatus)
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Goals in '${currentStatus}' status cannot be carried forward.`,
      });
    }

    if (!canEditAllFields && !isCarryForward) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "This goal cannot be modified in its current status.",
      });
    }

    const validSubGoals = getTitledSubGoals(SubGoals);
    if (canEditAllFields) {
      const subGoalCountError = getSubGoalCountError(validSubGoals);
      if (subGoalCountError) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: subGoalCountError,
          errors: { SubGoals: subGoalCountError },
        });
      }
    }

    // Full edits keep the goal's stored quarter; StartDate must stay inside
    // it. Goals saved before Quarter was stored fall back to the current
    // quarter. Carry-forward edits keep the stored StartDate untouched.
    const storedQuarterBounds =
      (existingGoal.QuarterEndDate &&
        getFiscalQuarterBounds(toDateKey(existingGoal.QuarterEndDate))) ||
      getFiscalQuarterBoundsFromLabel(existingGoal.Quarter) ||
      getFiscalQuarterBounds();
    const startDateKey = canEditAllFields
      ? toDateKey(StartDate)
      : toDateKey(existingGoal.StartDate);
    const timelineKey = toDateKey(Timeline);

    if (canEditAllFields) {
      const dateErrors = getGoalDateErrors(
        startDateKey,
        timelineKey,
        storedQuarterBounds,
      );
      if (dateErrors) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: Object.values(dateErrors)[0],
          errors: dateErrors,
        });
      }
    }

    if (isCarryForward) {
      if (!timelineKey) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "A valid Timeline is required to resubmit this goal.",
          errors: { Timeline: "A valid Timeline is required." },
        });
      }

      const previousTimelineKey = toDateKey(existingGoal.Timeline);
      if (previousTimelineKey && timelineKey <= previousTimelineKey) {
        const message = `New Timeline must be after the current Timeline (${previousTimelineKey}).`;
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message,
          errors: { Timeline: message },
        });
      }
    }

    // A rejected goal is returned to its owner for revision. The owner may
    // keep it rejected while saving changes, or submit it back into the
    // approval workflow; other status changes remain manager-only.
    if (
      !isEnterpriseGoalManager &&
      !isTeamGoalManager &&
      currentStatus === "Rejected" &&
      GoalStatus &&
      !["Rejected", "Submitted"].includes(GoalStatus)
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Rejected goals can only be saved or resubmitted for approval.",
      });
    }

    const newStatus = isCarryForward
      ? "Submitted"
      : GoalStatus || currentStatus;

    // A goal always stays in its start quarter, including on carry-forward.
    const { label: newQuarter, quarterEndDate: newQuarterEndDate } =
      canEditAllFields
        ? {
            label: storedQuarterBounds.label,
            quarterEndDate: storedQuarterBounds.endKey,
          }
        : {
            label: existingGoal.Quarter,
            quarterEndDate: existingGoal.QuarterEndDate,
          };

    const finalGoalNumber = canEditAllFields
      ? GoalNumber
      : existingGoal.GoalNumber;
    const finalGoalTitle = canEditAllFields
      ? GoalTitle
      : existingGoal.GoalTitle;
    const finalGoalDesc = canEditAllFields
      ? GoalDescription
      : existingGoal.GoalDescription;
    const finalMeasurability = isCarryForward
      ? existingGoal.Measurability
      : Measurability;
    const finalWeightage = isCarryForward ? existingGoal.Weightage : Weightage;
    const finalPriority = isCarryForward ? existingGoal.Priority : Priority;
    const finalMeetPerf = canEditAllFields
      ? MeetPerformance
      : existingGoal.MeetPerformance;
    const finalExceedPerf = canEditAllFields
      ? ExceedPerformance
      : existingGoal.ExceedPerformance;
    const finalValidation = canEditAllFields
      ? ValidationSource
      : existingGoal.ValidationSource;
    const finalJointAcc = canEditAllFields
      ? JointAccountability
      : existingGoal.JointAccountability;
    const finalCategory = canEditAllFields
      ? GoalCategory
      : existingGoal.GoalCategory;
    const finalCrossFunc = canEditAllFields
      ? CrossFunctionalGoal
        ? 1
        : 0
      : existingGoal.CrossFunctionalGoal;

    const goalWeightageError = getGoalWeightageError(finalWeightage);
    if (goalWeightageError) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: goalWeightageError,
        errors: { Weightage: goalWeightageError },
      });
    }

    if (!["Rejected", "Cancelled"].includes(newStatus)) {
      const allocation = await getQuarterGoalAllocation(
        transaction,
        existingGoal.UserID,
        newQuarter,
        id,
      );
      const allocationError = getQuarterAllocationError(
        allocation,
        finalWeightage,
      );
      if (allocationError) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: allocationError.message,
          errors: { [allocationError.field]: allocationError.message },
        });
      }
    }

    // SMART validation uses the exact field values that will be persisted.
    // Uses the goal's own transaction connection for the Achievable
    // weightage-sum read, and the goal's real CreatedDate as the
    // Time-bound baseline (not "now" — this goal may have been created
    // long before this edit).
    if (newStatus === "Submitted") {
      const { valid, errors } = await validateSmartGoal(
        {
          GoalTitle: finalGoalTitle,
          GoalDescription: finalGoalDesc,
          Measurability: finalMeasurability,
          MeetPerformance: finalMeetPerf,
          ExceedPerformance: finalExceedPerf,
          Weightage: finalWeightage,
          GoalCategory: finalCategory,
          Timeline: timelineKey || Timeline,
          CreatedDate: existingGoal.CreatedDate,
        },
        {
          pool: await poolPromise,
          userId: existingGoal.UserID,
          excludeGoalId: id,
        },
      );
      if (!valid) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message:
            "This goal does not meet SMART criteria required for submission.",
          errors,
        });
      }
    }

    const updateRequest = new sql.Request(transaction);
    updateRequest.input("GoalID", sql.BigInt, id);
    updateRequest.input("GoalNumber", sql.Int, finalGoalNumber);
    updateRequest.input("GoalTitle", sql.NVarChar, finalGoalTitle);
    updateRequest.input("GoalDescription", sql.NVarChar, finalGoalDesc || null);
    updateRequest.input("Measurability", sql.NVarChar, finalMeasurability || null);
    updateRequest.input(
      "JointAccountability",
      sql.NVarChar,
      finalJointAcc || null,
    );
    updateRequest.input("Weightage", sql.Decimal(5, 2), finalWeightage);
    updateRequest.input("Priority", sql.VarChar, finalPriority);
    updateRequest.input("StartDate", sql.Date, startDateKey);
    updateRequest.input("Timeline", sql.Date, timelineKey || Timeline);
    updateRequest.input("MeetPerformance", sql.NVarChar, finalMeetPerf || null);
    updateRequest.input(
      "ExceedPerformance",
      sql.NVarChar,
      finalExceedPerf || null,
    );
    updateRequest.input(
      "ValidationSource",
      sql.NVarChar,
      finalValidation || null,
    );
    updateRequest.input("CrossFunctionalGoal", sql.Bit, finalCrossFunc);
    updateRequest.input("GoalCategory", sql.NVarChar, finalCategory || null);
    updateRequest.input("GoalStatus", sql.VarChar, newStatus);
    updateRequest.input("CurrentStatus", sql.VarChar, currentStatus);
    updateRequest.input("Quarter", sql.VarChar, newQuarter);
    updateRequest.input("QuarterEndDate", sql.Date, newQuarterEndDate);
    updateRequest.input("IsCarryForward", sql.Bit, isCarryForward ? 1 : 0);

    let updateQuery = `
    UPDATE dbo.Goals SET 
        GoalNumber = @GoalNumber, GoalTitle = @GoalTitle, GoalDescription = @GoalDescription,
        Measurability = @Measurability, JointAccountability = @JointAccountability, Weightage = @Weightage,
        Priority = @Priority, StartDate = @StartDate, Timeline = @Timeline, MeetPerformance = @MeetPerformance,
        ExceedPerformance = @ExceedPerformance, ValidationSource = @ValidationSource,
        CrossFunctionalGoal = @CrossFunctionalGoal, GoalCategory = @GoalCategory, 
        GoalStatus = @GoalStatus,
        Quarter = @Quarter,
        QuarterEndDate = @QuarterEndDate,
        ApprovedDate = CASE WHEN @IsCarryForward = 1 THEN NULL ELSE ApprovedDate END,
        BusinessHeadApprovedBy = CASE WHEN @IsCarryForward = 1 THEN NULL ELSE BusinessHeadApprovedBy END,
        BusinessHeadApprovedDate = CASE WHEN @IsCarryForward = 1 THEN NULL ELSE BusinessHeadApprovedDate END,
        CarryForwardCount = CASE WHEN @IsCarryForward = 1 THEN ISNULL(CarryForwardCount, 0) + 1 ELSE CarryForwardCount END,
        CompletionRemark = CASE WHEN @IsCarryForward = 1 THEN NULL ELSE CompletionRemark END,
        SubmittedDate = CASE
          WHEN @GoalStatus = 'Submitted' AND @CurrentStatus <> 'Submitted'
            THEN GETDATE()
          ELSE SubmittedDate
        END,
        ModifiedDate = GETDATE()
    WHERE GoalID = @GoalID
`;

    await updateRequest.query(updateQuery);

    if (canEditAllFields && Array.isArray(JointAccountabilities)) {
      await jointAccountabilityModel.syncJointAccountabilities(
        id,
        JointAccountabilities,
        transaction,
      );
    }

    const { oldValues, newValues } = buildGoalDiff(existingGoal, {
      GoalNumber: finalGoalNumber,
      GoalTitle: finalGoalTitle,
      GoalDescription: finalGoalDesc,
      Measurability: finalMeasurability,
      JointAccountability: finalJointAcc,
      Weightage: finalWeightage,
      Priority: finalPriority,
      StartDate: startDateKey,
      Timeline: timelineKey || Timeline,
      MeetPerformance: finalMeetPerf,
      ExceedPerformance: finalExceedPerf,
      ValidationSource: finalValidation,
      CrossFunctionalGoal: finalCrossFunc,
      GoalCategory: finalCategory,
      GoalStatus: newStatus,
    });

    const changedFields = Object.keys(oldValues);
    if (changedFields.length > 0) {
      await logGoalHistory(
        transaction,
        id,
        "UPDATE",
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        `Updated: ${changedFields.join(", ")}`,
        userId,
      );
    }

    // Sub-goals are optional, so an empty list clears existing ones. Only
    // skip the sync when the client did not send SubGoals at all.
    if (canEditAllFields && Array.isArray(SubGoals)) {
      const existingSubGoalsResult = await new sql.Request(transaction)
        .input("GoalID", sql.BigInt, id)
        .query(
          "SELECT SubGoalID, Status FROM dbo.GoalSubGoals WHERE GoalID = @GoalID",
        );
      const existingSubGoalStatuses = new Map(
        existingSubGoalsResult.recordset.map((subGoal) => [
          String(subGoal.SubGoalID),
          subGoal.Status,
        ]),
      );
      const deleteSubRequest = new sql.Request(transaction);
      await deleteSubRequest
        .input("GoalID", sql.BigInt, id)
        .query("DELETE FROM dbo.GoalSubGoals WHERE GoalID = @GoalID");

      for (let i = 0; i < validSubGoals.length; i++) {
        const sub = validSubGoals[i];
        const subRequest = new sql.Request(transaction);
        subRequest.input("GoalID", sql.BigInt, id);
        subRequest.input("SubGoalNo", sql.Int, i + 1);
        subRequest.input("SubGoalTitle", sql.NVarChar, sub.SubGoalTitle.trim());
        subRequest.input(
          "SubGoalDescription",
          sql.NVarChar,
          sub.SubGoalDescription || null,
        );
        subRequest.input("Weightage", sql.Decimal(5, 2), 0);
        subRequest.input("Target", sql.NVarChar, null);
        subRequest.input(
          "Status",
          sql.VarChar,
          getSubGoalStatus(
            sub.Status,
            existingSubGoalStatuses.get(String(sub.SubGoalID)) || "Pending",
          ),
        );

        await subRequest.query(`
                    INSERT INTO dbo.GoalSubGoals (GoalID, SubGoalNo, SubGoalTitle, SubGoalDescription, Weightage, Target, Status, CreatedDate)
                    VALUES (@GoalID, @SubGoalNo, @SubGoalTitle, @SubGoalDescription, @Weightage, @Target, @Status, GETDATE())
                `);
      }
    }
    // Note: when isCarryForward is true, canEditAllFields is false, so this
    // block is skipped entirely — sub-goals are left exactly as they are,
    // which is the intended behavior (they carry over as-is, completed ones
    // stay Completed).

    if (isCarryForward) {
      await new sql.Request(transaction)
        .input("GoalID", sql.BigInt, id)
        .input(
          "FromQuarter",
          sql.VarChar,
          existingGoal.Quarter || storedQuarterBounds.label,
        )
        .input("ToQuarter", sql.VarChar, getFiscalQuarterBounds().label)
        .input("ProgressAtCarryForward", sql.Decimal(5, 2), 0)
        .query(`
          INSERT INTO dbo.GoalCarryForwardHistory (
            GoalID, FromQuarter, ToQuarter, ProgressAtCarryForward, CarriedForwardDate
          )
          VALUES (@GoalID, @FromQuarter, @ToQuarter, @ProgressAtCarryForward, GETDATE())
        `);
    }

    await transaction.commit();

    // A draft becomes visible to approvers only after it is submitted.
    // Creating a submitted goal already sends this notification; this
    // covers the equivalent Draft -> Submitted transition during editing.
    let notifiedEmails = [];
    if (currentStatus !== "Submitted" && newStatus === "Submitted") {
      try {
        notifiedEmails = await notifyGoalHierarchy(
          existingGoal.UserID,
          id,
          finalGoalTitle,
          newStatus,
        );
      } catch (notificationError) {
        // The goal was successfully submitted, so a notification outage
        // should not report the request as failed to the employee.
        console.error(
          `[NOTIF FAILED] updateGoal submit notification. goalId=${id}:`,
          notificationError,
        );
      }
    }

    return res.status(200).json({
      success: true,
      message:
        newStatus === "Submitted" && currentStatus !== "Submitted"
          ? notifiedEmails.length > 0
            ? `Goal submitted and email has been sent to ${notifiedEmails.length} approver(s) in your reporting hierarchy.`
            : "Goal submitted successfully."
          : isCarryForward
            ? "Goal carried forward and resubmitted for approval."
            : "Goal updated successfully.",
    });
  } catch (error) {
    if (transaction._aborted === false && transaction._acquiredConnection) {
      try {
        await transaction.rollback();
      } catch (rbErr) {}
    }
    console.error("Update Goal Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating goal.",
      errors: error.message,
    });
  }
};

//Fetch goal history
const getGoalHistory = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await poolPromise;

    // History follows the same visibility rule as the goal detail page.
    const goalResult = await pool
      .request()
      .input("GoalID", sql.BigInt, id)
      .query("SELECT UserID FROM dbo.Goals WHERE GoalID = @GoalID");
    if (goalResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Goal not found." });
    }

    const goalOwnerId = goalResult.recordset[0].UserID;
    const requesterUserId = req.user?.UserID || req.user?.userId;
    const requesterResult = await pool
      .request()
      .input("UserID", sql.Int, requesterUserId)
      .query(
        "SELECT Role FROM dbo.Users WHERE UserID = @UserID AND IsActive = 1",
      );
    const requesterRole = String(requesterResult.recordset[0]?.Role || "")
      .trim()
      .toUpperCase();
    const ownerHierarchy = await getUserContact(pool, goalOwnerId);
    const assignedApproverIds = ownerHierarchy
      ? [
          ownerHierarchy.ReportingManagerID,
          ownerHierarchy.HODID,
          ownerHierarchy.BusinessHeadID,
        ]
          .filter(
            (approverId) => approverId !== null && approverId !== undefined,
          )
          .map(Number)
      : [];
    const canViewHistory =
      Number(requesterUserId) === Number(goalOwnerId) ||
      ["CFO", "ADMIN"].includes(requesterRole) ||
      assignedApproverIds.includes(Number(requesterUserId)) ||
      (await hasJointAssignment(id, requesterUserId));

    if (!canViewHistory) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this goal history.",
      });
    }

    const result = await pool.request().input("GoalID", sql.BigInt, id).query(`
      SELECT gh.GoalHistoryID, gh.Action, gh.OldValue, gh.NewValue, gh.Remarks,
             gh.PerformedBy, gh.PerformedDate, u.FirstName, u.LastName
      FROM dbo.GoalHistory gh
      LEFT JOIN dbo.Users u ON u.UserID = gh.PerformedBy
      WHERE gh.GoalID = @GoalID
      ORDER BY gh.PerformedDate DESC
    `);

    const history = result.recordset.map((row) => {
      let oldValues = {},
        newValues = {};
      try {
        oldValues = row.OldValue ? JSON.parse(row.OldValue) : {};
      } catch {
        oldValues = {};
      }
      try {
        newValues = row.NewValue ? JSON.parse(row.NewValue) : {};
      } catch {
        newValues = {};
      }

      const fields = Array.from(
        new Set([...Object.keys(oldValues), ...Object.keys(newValues)]),
      );
      return {
        historyId: row.GoalHistoryID,
        action: row.Action,
        remarks: row.Remarks,
        performedBy:
          [row.FirstName, row.LastName].filter(Boolean).join(" ") ||
          row.PerformedBy,
        performedDate: row.PerformedDate,
        changes: fields.map((field) => ({
          field,
          oldValue: oldValues[field] ?? null,
          newValue: newValues[field] ?? null,
        })),
      };
    });

    return res.status(200).json({ success: true, history });
  } catch (error) {
    console.error("Get Goal History Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching goal history.",
    });
  }
};

// 5. Delete Goal
const deleteGoal = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.UserID || req.user?.userId;
  const transaction = new sql.Transaction(await poolPromise);

  try {
    await transaction.begin();

    const checkRequest = new sql.Request(transaction);
    const checkResult = await checkRequest
      .input("GoalID", sql.BigInt, id)
      .query("SELECT GoalStatus, UserID FROM dbo.Goals WHERE GoalID = @GoalID");

    if (checkResult.recordset.length === 0) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Goal not found." });
    }

    if (Number(checkResult.recordset[0].UserID) !== Number(userId)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Only the goal owner can delete this goal.",
      });
    }

    if (checkResult.recordset[0].GoalStatus !== "Draft") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Only goals in Draft status can be deleted.",
      });
    }

    // Since we're hard-deleting the goal, there's no point logging
    // "Deleted" history for a row that won't exist anymore.
    // Instead, just clean up any existing history rows for this goal.
    const delHistReq = new sql.Request(transaction);
    await delHistReq
      .input("GoalID", sql.BigInt, id)
      .query("DELETE FROM dbo.GoalHistory WHERE GoalID = @GoalID");

    const delSubReq = new sql.Request(transaction);
    await delSubReq
      .input("GoalID", sql.BigInt, id)
      .query("DELETE FROM dbo.GoalSubGoals WHERE GoalID = @GoalID");

    const delGoalReq = new sql.Request(transaction);
    await delGoalReq
      .input("GoalID", sql.BigInt, id)
      .query("DELETE FROM dbo.Goals WHERE GoalID = @GoalID");

    await transaction.commit();
    return res
      .status(200)
      .json({ success: true, message: "Goal deleted successfully." });
  } catch (error) {
    if (transaction._aborted === false && transaction._acquiredConnection) {
      try {
        await transaction.rollback();
      } catch (rbErr) {}
    }
    console.error("Delete Goal Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating goal.",
      errors: error.message,
    });
  }
};

const canApproveOrRejectGoal = async (requesterUserId, goalOwnerUserId) => {
  if (!requesterUserId || !goalOwnerUserId) return false;
  if (Number(requesterUserId) === Number(goalOwnerUserId)) return false;

  const pool = await poolPromise;
  const result = await pool.request().input("UserID", sql.Int, goalOwnerUserId)
    .query(`
            SELECT ReportingManagerID, HODID, BusinessHeadID
            FROM dbo.Users
            WHERE UserID = @UserID
        `);

  const ownerHierarchy = result.recordset[0];
  if (!ownerHierarchy) return false;

  const directApproverIds = [];

  if (
    ownerHierarchy.ReportingManagerID !== null &&
    ownerHierarchy.ReportingManagerID !== undefined &&
    ownerHierarchy.ReportingManagerID !== ""
  ) {
    directApproverIds.push(Number(ownerHierarchy.ReportingManagerID));
  }

  if (
    ownerHierarchy.HODID !== null &&
    ownerHierarchy.HODID !== undefined &&
    ownerHierarchy.HODID !== ""
  ) {
    directApproverIds.push(Number(ownerHierarchy.HODID));
  }

  if (
    ownerHierarchy.BusinessHeadID !== null &&
    ownerHierarchy.BusinessHeadID !== undefined &&
    ownerHierarchy.BusinessHeadID !== "" &&
    (!ownerHierarchy.ReportingManagerID ||
      ownerHierarchy.ReportingManagerID === "") &&
    (!ownerHierarchy.HODID || ownerHierarchy.HODID === "")
  ) {
    directApproverIds.push(Number(ownerHierarchy.BusinessHeadID));
  }

  return directApproverIds.some((id) => Number(id) === Number(requesterUserId));
};

// NEW: true only when this employee has no Manager/HOD in between
// and reports directly to this specific Business Head.
const isDirectBusinessHeadReport = async (
  goalOwnerUserId,
  businessHeadUserId,
) => {
  const pool = await poolPromise;
  const result = await pool.request().input("UserID", sql.Int, goalOwnerUserId)
    .query(`
            SELECT ReportingManagerID, HODID, BusinessHeadID
            FROM dbo.Users
            WHERE UserID = @UserID
        `);

  const h = result.recordset[0];
  if (!h) return false;

  const hasManager =
    h.ReportingManagerID !== null &&
    h.ReportingManagerID !== undefined &&
    h.ReportingManagerID !== "";

  const hasHOD = h.HODID !== null && h.HODID !== undefined && h.HODID !== "";

  return (
    !hasManager &&
    !hasHOD &&
    h.BusinessHeadID !== null &&
    h.BusinessHeadID !== undefined &&
    h.BusinessHeadID !== "" &&
    Number(h.BusinessHeadID) === Number(businessHeadUserId)
  );
};

module.exports = {
  canApproveOrRejectGoal,
  isDirectBusinessHeadReport,
  // ...export whatever else this file already exports
};

// 6. Update Goal Status (Approve / Reject)
const changeGoalStatus = async (req, res) => {
  const { id } = req.params;
  const { goalStatus } = req.body;
  const userId = req.user?.UserID || req.user?.userId;

  if (!goalStatus) {
    return res
      .status(400)
      .json({ success: false, message: "Status is required." });
  }

  if (COMPLETION_STATUSES.includes(goalStatus)) {
    return res
      .status(400)
      .json({ success: false, message: COMPLETION_STATUS_MESSAGE });
  }

  const transaction = new sql.Transaction(await poolPromise);

  try {
    await transaction.begin();

    const checkReq = new sql.Request(transaction);
    const oldRes = await checkReq
      .input("GoalID", sql.BigInt, id)
      .query(
        "SELECT GoalStatus, UserID, GoalTitle FROM dbo.Goals WHERE GoalID = @GoalID",
      );
    if (oldRes.recordset.length === 0) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Goal not found." });
    }
    const oldStatus = oldRes.recordset[0].GoalStatus;
    const goalOwnerId = oldRes.recordset[0].UserID;
    const goalTitle = oldRes.recordset[0].GoalTitle;

    if (
      Number(goalOwnerId) !== Number(userId) &&
      (await hasJointAssignment(id, userId, transaction))
    ) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Joint participants cannot change the goal status.",
      });
    }

    const role = (req.user?.Role || req.user?.role || "").toUpperCase();

    // NEW: Business Head is "final" either after Manager/HOD already approved,
    // OR when this employee reports directly to Business Head (no Manager/HOD stage exists).
    const isCfoRole = ["BUSINESSHEAD", "CFO"].includes(role);
    const isDirectReport =
      isCfoRole
        ? await isDirectBusinessHeadReport(goalOwnerId, userId)
        : false;

    const isFinalBusinessHeadAction =
      isCfoRole && (oldStatus !== "Submitted" || isDirectReport);

    const isAuthorizedApprover =
      role === "ADMIN" ||
      isFinalBusinessHeadAction ||
      (await canApproveOrRejectGoal(userId, goalOwnerId));

    if (!isAuthorizedApprover) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to approve or reject this goal.",
      });
    }

    const isFinalApproval = isFinalBusinessHeadAction;
    const isFirstStageApproval =
      ["MANAGER", "HOD"].includes(role) && isAuthorizedApprover;
    const firstStageApprovalStatus =
      role === "MANAGER" ? "Manager Approved" : "HOD Approved";

    const validTransition =
      role === "ADMIN" ||
      (isFinalApproval &&
        [
          "Submitted",
          "HOD Approved",
          "Manager Approved",
          "Reviewed By HOD",
          "Review By Business Head",
          "Business Head Approved",
        ].includes(oldStatus) &&
        ["Approved", "Rejected"].includes(goalStatus)) ||
      (isFirstStageApproval &&
        oldStatus === "Submitted" &&
        [firstStageApprovalStatus, "Rejected"].includes(goalStatus));

    if (!validTransition) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: isFinalApproval
          ? "Final approval is available only after manager/HOD approval."
          : "This goal is not awaiting your approval stage.",
      });
    }

    if (role !== "ADMIN") {
      const approvalWindow = isFinalApproval
        ? getCfoApprovalWindow()
        : getManagerHodApprovalWindow();
      if (!approvalWindow.isOpen) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: isFinalApproval
            ? `CFO approval is available only on quarter days 16-30. The current window is ${approvalWindow.startDate.toLocaleDateString()} through ${approvalWindow.endDate.toLocaleDateString()}.`
            : `Manager/HOD approval is available only on quarter days 8-25. The current window is ${approvalWindow.startDate.toLocaleDateString()} through ${approvalWindow.endDate.toLocaleDateString()}.`,
        });
      }
    }

    const updateReq = new sql.Request(transaction);
    await updateReq
      .input("GoalID", sql.BigInt, id)
      .input("GoalStatus", sql.VarChar, goalStatus)
      .input("BusinessHeadApprovedBy", sql.Int, isFinalApproval ? userId : null)
      .input("IsBusinessHeadApproval", sql.Bit, isFinalApproval).query(`
                           UPDATE dbo.Goals 
                           SET GoalStatus = @GoalStatus, 
                               ModifiedDate = GETDATE(),
                   ApprovedDate = CASE WHEN @GoalStatus IN ('HOD Approved', 'Manager Approved', 'Business Head Approved', 'Approved') THEN GETDATE() ELSE ApprovedDate END,
                   BusinessHeadApprovedBy = CASE WHEN @IsBusinessHeadApproval = 1 AND @GoalStatus = 'Approved' THEN @BusinessHeadApprovedBy ELSE BusinessHeadApprovedBy END,
                   BusinessHeadApprovedDate = CASE WHEN @IsBusinessHeadApproval = 1 AND @GoalStatus = 'Approved' THEN GETDATE() ELSE BusinessHeadApprovedDate END
                           WHERE GoalID = @GoalID
                       `);

    await logGoalHistory(
      transaction,
      id,
      "UPDATE",
      oldStatus,
      goalStatus,
      `Status updated to ${goalStatus}`,
      userId,
    );

    await transaction.commit();

    if (
      goalStatus === "Approved" ||
      goalStatus === "Rejected" ||
      goalStatus.includes("Approved") ||
      goalStatus.includes("Rejected")
    ) {
      try {
        const pool = await poolPromise;
        const employee = await getUserContact(pool, goalOwnerId);
        if (employee) {
          const isApproved = goalStatus.includes("Approved");
          const employeeName = `${employee.FirstName} ${employee.LastName}`;
          const goalLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/goals/view/${id}`;

          await notifyUser(pool, {
            userId: employee.UserID,
            title: isApproved ? "Goal Approved" : "Goal Rejected",
            message: isApproved
              ? `Your goal "${goalTitle}" has been approved (status: ${goalStatus}).`
              : `Your goal "${goalTitle}" has been rejected (status: ${goalStatus}).`,
            type: isApproved ? "GOAL_APPROVED" : "GOAL_REJECTED",
            referenceId: Number(id),
            referenceType: "Goal",
            createdBy: userId,
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
          `[NOTIF FAILED] changeGoalStatus notify step. goalId=${id} userId=${goalOwnerId}:`,
          notifyErr,
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: `Goal status updated to ${goalStatus} successfully.`,
    });
  } catch (error) {
    if (transaction._aborted === false && transaction._acquiredConnection) {
      try {
        await transaction.rollback();
      } catch (rbErr) {}
    }
    console.error("Change Goal Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating goal status.",
      errors: error.message,
    });
  }
};

// 7. Submit Review (HOD or Business Head) — advances GoalStatus based on current stage
const submitGoalReview = async (req, res) => {
  const { goalId, rating, comment } = req.body;
  const userId = req.user?.UserID || req.user?.userId;

  if (!goalId || !rating) {
    return res
      .status(400)
      .json({ success: false, message: "goalId and rating are required." });
  }

  // Defines which status comes next depending on the goal's current status.
  // HOD reviews a goal that is 'HOD Approved' -> moves it to 'Reviewed By HOD'
  // Business Head reviews a goal that is 'Reviewed By HOD' -> moves it to 'Review By Business Head'
  const statusFlow = {
    "HOD Approved": "Reviewed By HOD",
    "Reviewed By HOD": "Review By Business Head",
  };

  const transaction = new sql.Transaction(await poolPromise);

  try {
    await transaction.begin();

    const checkReq = new sql.Request(transaction);
    const checkRes = await checkReq
      .input("GoalID", sql.BigInt, goalId)
      .query("SELECT * FROM dbo.Goals WHERE GoalID = @GoalID");

    if (checkRes.recordset.length === 0) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Goal not found." });
    }

    const existingGoal = checkRes.recordset[0];
    if (
      Number(existingGoal.UserID) !== Number(userId) &&
      (await hasJointAssignment(goalId, userId, transaction))
    ) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Joint participants cannot submit a goal review.",
      });
    }

    const oldStatus = existingGoal.GoalStatus;
    const newStatus = statusFlow[oldStatus];

    if (!newStatus) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Goal cannot be reviewed while in '${oldStatus}' status.`,
      });
    }

    const subGoalsResult = await new sql.Request(transaction)
      .input("GoalID", sql.BigInt, goalId)
      .query("SELECT * FROM dbo.GoalSubGoals WHERE GoalID = @GoalID");

    const completionPercentage = Number(
      existingGoal.CompletionPercentage ??
        existingGoal.CompletionPct ??
        calculateGoalProgress(subGoalsResult.recordset ?? []),
    );
    const reviewWindowOpen = isGoalReviewWindowOpen({
      ...existingGoal,
      CompletionPercentage: completionPercentage,
    });
    if (completionPercentage < 100 && !reviewWindowOpen) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Review opens when the goal is complete or within 10 days of the quarter end.",
      });
    }

    const reviewQuarter = existingGoal.Quarter || getFiscalQuarter(new Date(existingGoal.Timeline || new Date())).label;
    const duplicateCheckReq = new sql.Request(transaction);
    const duplicateCheckRes = await duplicateCheckReq
      .input("GoalID", sql.BigInt, goalId)
      .input("Quarter", sql.VarChar, reviewQuarter)
      .query(`
        SELECT TOP 1 GoalID
        FROM dbo.HODRatings
        WHERE GoalID = @GoalID AND Quarter = @Quarter
      `);

    if (duplicateCheckRes.recordset.length > 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "This goal has already been reviewed in this quarter.",
      });
    }

    const updateReq = new sql.Request(transaction);
    await updateReq
      .input("GoalID", sql.BigInt, goalId)
      .input("Quarter", sql.VarChar, reviewQuarter)
      .input("Rating", sql.Int, rating)
      .input("AchievementPercentage", sql.Decimal(5, 2), Number(rating) * 20)
      .input("Comments", sql.NVarChar, comment || null)
      .input("ReviewedBy", sql.Int, userId)
      .input("GoalStatus", sql.VarChar, newStatus).query(`
                MERGE dbo.HODRatings AS target
                USING (SELECT @GoalID AS GoalID, @Quarter AS Quarter) AS source
                ON target.GoalID = source.GoalID AND target.Quarter = source.Quarter
                WHEN MATCHED THEN UPDATE SET
                    Rating = @Rating,
                    AchievementPercentage = @AchievementPercentage,
                    Comments = @Comments,
                    ReviewedBy = @ReviewedBy,
                    ReviewedDate = GETDATE(),
                    ModifiedDate = GETDATE()
                WHEN NOT MATCHED THEN INSERT
                    (GoalID, Quarter, Rating, AchievementPercentage, Comments, ReviewedBy)
                    VALUES (@GoalID, @Quarter, @Rating, @AchievementPercentage, @Comments, @ReviewedBy);

                UPDATE dbo.Goals
                SET GoalStatus = @GoalStatus,
                    ModifiedDate = GETDATE()
                WHERE GoalID = @GoalID;
            `);

    await logGoalHistory(
      transaction,
      goalId,
      "UPDATE",
      oldStatus,
      newStatus,
      `Reviewed with rating ${rating}/5. Comment: ${comment || "No comment provided"}`,
      userId,
    );

    await transaction.commit();

    // Notify the relevant people that a review was submitted. This never
    // affects the response — the review has already been committed.
    try {
      const pool = await poolPromise;
      const employee = await getUserContact(pool, existingGoal.UserID);
      const isBusinessHeadReview = oldStatus === "Reviewed By HOD"; // Business Head / CFO stage
      const goalLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/goals/view/${goalId}`;

      if (employee) {
        const employeeName = `${employee.FirstName} ${employee.LastName}`;

        if (!isBusinessHeadReview) {
          // HOD review stage: notify the employee only.
          await notifyUser(pool, {
            userId: employee.UserID,
            title: "Goal Reviewed",
            message: `Your goal "${existingGoal.GoalTitle}" was reviewed with a rating of ${rating}/5. Comment: ${comment || "No comment provided"}`,
            type: "GOAL_REVIEWED",
            referenceId: Number(goalId),
            referenceType: "Goal",
            createdBy: userId,
            emailTo: employee.Email || undefined,
            emailSubject: `Your Goal Was Reviewed - ${employeeName}`,
            emailHtml: `
                            <h3>Hello ${employee.FirstName || "there"},</h3>
                            <p>Your goal titled <strong>"${existingGoal.GoalTitle}"</strong> has been reviewed.</p>
                            <p>Rating: <strong>${rating}/5</strong></p>
                            <p>Comment: ${comment || "No comment provided"}</p>
                            <a href="${goalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Goal</a>
                        `,
          });
        } else {
          // Business Head / CFO review stage: notify the employee AND the HOD
          // who approved this goal earlier, so both know the CFO reviewed it.
          await notifyUser(pool, {
            userId: employee.UserID,
            title: "Goal Reviewed by Business Head/CFO",
            message: `Your goal "${existingGoal.GoalTitle}" was reviewed by the Business Head/CFO with a rating of ${rating}/5. Comment: ${comment || "No comment provided"}`,
            type: "CFO_REVIEWED",
            referenceId: Number(goalId),
            referenceType: "Goal",
            createdBy: userId,
            emailTo: employee.Email || undefined,
            emailSubject: `Your Goal Was Reviewed by Business Head/CFO - ${employeeName}`,
            emailHtml: `
                            <h3>Hello ${employee.FirstName || "there"},</h3>
                            <p>Your goal titled <strong>"${existingGoal.GoalTitle}"</strong> has been reviewed by the Business Head/CFO.</p>
                            <p>Rating: <strong>${rating}/5</strong></p>
                            <p>Comment: ${comment || "No comment provided"}</p>
                            <a href="${goalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Goal</a>
                        `,
          });

          if (employee.HODID) {
            const hod = await getUserContact(pool, employee.HODID);
            if (hod) {
              await notifyUser(pool, {
                userId: hod.UserID,
                title: "Goal Reviewed by Business Head/CFO",
                message: `The goal "${existingGoal.GoalTitle}" (${employeeName}), which you approved, was reviewed by the Business Head/CFO with a rating of ${rating}/5.`,
                type: "CFO_REVIEWED",
                referenceId: Number(goalId),
                referenceType: "Goal",
                createdBy: userId,
                emailTo: hod.Email || undefined,
                emailSubject: `Goal You Approved Was Reviewed by Business Head/CFO - ${employeeName}`,
                emailHtml: `
                                    <h3>Hello ${hod.FirstName || "there"},</h3>
                                    <p>The goal titled <strong>"${existingGoal.GoalTitle}"</strong> belonging to <strong>${employeeName}</strong>, which you previously approved, has now been reviewed by the Business Head/CFO.</p>
                                    <p>Rating: <strong>${rating}/5</strong></p>
                                    <p>Comment: ${comment || "No comment provided"}</p>
                                    <a href="${goalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Goal</a>
                                `,
              });
            }
          }
        }
      }
    } catch (notifyErr) {
      console.error(
        `[NOTIF FAILED] submitGoalReview notify step. goalId=${goalId} userId=${existingGoal.UserID}:`,
        notifyErr,
      );
    }

    return res.status(200).json({
      success: true,
      message: `Feedback submitted successfully. Goal status updated to '${newStatus}'.`,
    });
  } catch (error) {
    if (transaction._aborted === false && transaction._acquiredConnection) {
      try {
        await transaction.rollback();
      } catch (rbErr) {}
    }
    console.error("Submit Goal Review Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while submitting feedback.",
      errors: error.message,
    });
  }
};

const getJointGoals = async (req, res) => {
  const userId = req.user?.UserID || req.user?.userId;

  try {
    const data = await jointAccountabilityModel.getJointGoalsForUser(userId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get Joint Goals Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching joint goals.",
      errors: error.message,
    });
  }
};

const updateJointAccountabilityStatus = async (req, res) => {
  const userId = req.user?.UserID || req.user?.userId;
  const { status } = req.body;

  if (!["Accepted", "Declined"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status." });
  }

  try {
    const updated =
      await jointAccountabilityModel.updateJointAccountabilityStatus(
        req.params.id,
        userId,
        status,
      );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Not found or not yours to update." });
    }
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Update Joint Accountability Status Error:", error);
    return res.status(500).json({
      success: false,
      message:
        "Internal server error while updating joint accountability status.",
      errors: error.message,
    });
  }
};

const updateSubGoalStatus = async (req, res) => {
  const { goalId, subGoalId } = req.params;
  const { Status } = req.body;
  const userId = req.user?.UserID || req.user?.userId;
  const role = (req.user?.Role || req.user?.role || "").toUpperCase();

  const validStatuses = ["Pending", "In Progress", "Completed", "Cancelled"];
  if (!validStatuses.includes(Status)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid status value." });
  }

  const transaction = new sql.Transaction(await poolPromise);

  try {
    await transaction.begin();

    const goalReq = new sql.Request(transaction);
    const goalRes = await goalReq
      .input("GoalID", sql.BigInt, goalId)
      .query(
        "SELECT UserID, GoalTitle, Weightage, GoalStatus FROM dbo.Goals WHERE GoalID = @GoalID",
      );

    if (goalRes.recordset.length === 0) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Goal not found." });
    }
    const goal = goalRes.recordset[0];

    const isJointParticipant =
      Number(goal.UserID) !== Number(userId) &&
      (await hasJointAssignment(goalId, userId, transaction));
    // Only the goal's own owner logs sub-goal progress; Admin can too for corrections.
    const isAuthorized =
      !isJointParticipant &&
      (role === "ADMIN" || Number(goal.UserID) === Number(userId));
    if (!isAuthorized) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this sub-goal.",
      });
    }

    const approvedGoalStatuses = [
      "Approved",
      "HOD Approved",
      "Manager Approved",
      "Business Head Approved",
    ];
    if (!approvedGoalStatuses.includes(goal.GoalStatus)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Sub-goal progress can be updated after the goal is approved.",
      });
    }

    const subGoalReq = new sql.Request(transaction);
    const subGoalRes = await subGoalReq
      .input("SubGoalID", sql.BigInt, subGoalId)
      .input("GoalID", sql.BigInt, goalId)
      .query(
        "SELECT * FROM dbo.GoalSubGoals WHERE SubGoalID = @SubGoalID AND GoalID = @GoalID",
      );

    if (subGoalRes.recordset.length === 0) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Sub-goal not found." });
    }
    const subGoal = subGoalRes.recordset[0];
    const oldStatus = subGoal.Status;

    const updateReq = new sql.Request(transaction);
    await updateReq
      .input("SubGoalID", sql.BigInt, subGoalId)
      .input("Status", sql.VarChar, Status).query(`
        UPDATE dbo.GoalSubGoals
        SET Status = @Status
        WHERE SubGoalID = @SubGoalID
      `);

    await logGoalHistory(
      transaction,
      goalId,
      "UPDATE",
      oldStatus,
      Status,
      `Sub-goal "${subGoal.SubGoalTitle}" status updated to ${Status}`,
      userId,
    );

    await transaction.commit();

    // Return updated progress so the frontend can refresh immediately without a second fetch
    const allSubGoals = await goalModel.getSubGoalsByGoalId(goalId);
    const completionPct = calculateGoalProgress(allSubGoals);
    const earnedWeightage = Number(
      (Number(goal.Weightage) * (completionPct / 100)).toFixed(2),
    );

    return res.status(200).json({
      success: true,
      message: "Sub-goal status updated successfully.",
      data: { progress: { completionPct, earnedWeightage } },
    });
  } catch (error) {
    if (transaction._aborted === false && transaction._acquiredConnection) {
      try {
        await transaction.rollback();
      } catch (rbErr) {}
    }
    console.error("Update Sub-Goal Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating sub-goal status.",
      errors: error.message,
    });
  }
};

// ---------------- Goal completion approval ----------------
// Owner requests completion of an Approved goal; the owner's direct
// approver (Reporting Manager, else HOD) approves or rejects it. CFO and
// Business Head are not part of this flow.

const COMPLETION_REMARK_MAX_LENGTH = 500;

const getCompletionApproverId = async (transaction, ownerUserId) => {
  const result = await new sql.Request(transaction).input(
    "OwnerUserID",
    sql.Int,
    ownerUserId,
  ).query(`
      SELECT COALESCE(ReportingManagerID, HODID) AS ApproverID
      FROM dbo.Users
      WHERE UserID = @OwnerUserID
    `);
  const approverId = result.recordset[0]?.ApproverID;
  return approverId === null || approverId === undefined
    ? null
    : Number(approverId);
};

const getGoalForCompletion = async (transaction, goalId) => {
  const result = await new sql.Request(transaction)
    .input("GoalID", sql.BigInt, goalId)
    .query(`
      SELECT GoalID, UserID, GoalTitle, GoalStatus, Weightage
      FROM dbo.Goals WITH (UPDLOCK, ROWLOCK)
      WHERE GoalID = @GoalID
    `);
  return result.recordset[0] || null;
};

const rollbackQuietly = async (transaction) => {
  if (transaction._aborted === false && transaction._acquiredConnection) {
    try {
      await transaction.rollback();
    } catch (rbErr) {}
  }
};

// Shared guard for approve/reject: goal exists, caller is the owner's
// direct approver, and the goal is awaiting completion approval.
const loadGoalForCompletionDecision = async (transaction, goalId, userId) => {
  const goal = await getGoalForCompletion(transaction, goalId);
  if (!goal) {
    return { status: 404, message: "Goal not found." };
  }

  const approverId = await getCompletionApproverId(transaction, goal.UserID);
  if (approverId === null) {
    return {
      status: 403,
      message:
        "This goal's owner has no Reporting Manager or HOD to approve completion.",
    };
  }
  if (
    approverId !== Number(userId) ||
    Number(goal.UserID) === Number(userId)
  ) {
    return {
      status: 403,
      message:
        "Only the goal owner's Reporting Manager (or HOD if none) can approve or reject completion.",
    };
  }

  if (goal.GoalStatus !== "Completion Submitted") {
    return {
      status: 400,
      message: `This goal is not awaiting completion approval (current status: ${goal.GoalStatus}).`,
    };
  }

  return { goal };
};

const notifyCompletionEvent = async ({
  recipientId,
  goalId,
  title,
  message,
  type,
  createdBy,
}) => {
  try {
    const pool = await poolPromise;
    const recipient = await getUserContact(pool, recipientId);
    if (!recipient) return;

    const goalLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/goals/view/${goalId}`;
    await notifyUser(pool, {
      userId: recipient.UserID,
      title,
      message,
      type,
      referenceId: Number(goalId),
      referenceType: "Goal",
      createdBy,
      emailTo: recipient.Email || undefined,
      emailSubject: title,
      emailHtml: `
        <h3>Hello ${recipient.FirstName || "there"},</h3>
        <p>${message}</p>
        <a href="${goalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Goal</a>
      `,
    });
  } catch (notifyErr) {
    console.error(
      `[NOTIF FAILED] ${type} notify step. goalId=${goalId} recipientId=${recipientId}:`,
      notifyErr,
    );
  }
};

// POST /goals/:id/completion/request
const requestGoalCompletion = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.UserID || req.user?.userId;
  const transaction = new sql.Transaction(await poolPromise);

  try {
    await transaction.begin();

    const goal = await getGoalForCompletion(transaction, id);
    if (!goal) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Goal not found." });
    }

    if (Number(goal.UserID) !== Number(userId)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Only the goal owner can request completion.",
      });
    }

    if (goal.GoalStatus !== "Approved") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Only Approved goals can be submitted for completion (current status: ${goal.GoalStatus}).`,
      });
    }

    const approverId = await getCompletionApproverId(transaction, goal.UserID);
    if (approverId === null) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "You have no Reporting Manager or HOD assigned to approve goal completion.",
      });
    }

    const updateResult = await new sql.Request(transaction)
      .input("GoalID", sql.BigInt, id)
      .query(`
        UPDATE dbo.Goals
        SET GoalStatus = 'Completion Submitted',
            CompletionRequestedDate = GETDATE(),
            CompletionRemark = NULL,
            ModifiedDate = GETDATE()
        WHERE GoalID = @GoalID AND GoalStatus = 'Approved'
      `);
    if (updateResult.rowsAffected[0] !== 1) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "This goal's status changed. Refresh and try again.",
      });
    }

    await transaction.commit();

    await notifyCompletionEvent({
      recipientId: approverId,
      goalId: id,
      title: "Goal Completion Requested",
      message: `Completion has been requested for the goal "${goal.GoalTitle}" and is awaiting your approval.`,
      type: "GOAL_COMPLETION_REQUESTED",
      createdBy: userId,
    });

    return res.status(200).json({
      success: true,
      message: "Goal completion submitted for approval.",
    });
  } catch (error) {
    await rollbackQuietly(transaction);
    console.error("Request Goal Completion Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while requesting goal completion.",
      errors: error.message,
    });
  }
};

// POST /goals/:id/completion/approve
const approveGoalCompletion = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.UserID || req.user?.userId;
  const transaction = new sql.Transaction(await poolPromise);

  try {
    await transaction.begin();

    const { goal, status, message } = await loadGoalForCompletionDecision(
      transaction,
      id,
      userId,
    );
    if (!goal) {
      await transaction.rollback();
      return res.status(status).json({ success: false, message });
    }

    const updateResult = await new sql.Request(transaction)
      .input("GoalID", sql.BigInt, id)
      .input("CompletionApprovedBy", sql.Int, userId)
      .query(`
        UPDATE dbo.Goals
        SET GoalStatus = 'Completed',
            AchievedWeightage = Weightage,
            CompletionApprovedBy = @CompletionApprovedBy,
            CompletedDate = GETDATE(),
            ModifiedDate = GETDATE()
        WHERE GoalID = @GoalID AND GoalStatus = 'Completion Submitted'
      `);
    if (updateResult.rowsAffected[0] !== 1) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "This goal's status changed. Refresh and try again.",
      });
    }

    await transaction.commit();

    await notifyCompletionEvent({
      recipientId: goal.UserID,
      goalId: id,
      title: "Goal Completion Approved",
      message: `Completion of your goal "${goal.GoalTitle}" has been approved.`,
      type: "GOAL_COMPLETION_APPROVED",
      createdBy: userId,
    });

    return res.status(200).json({
      success: true,
      message: "Goal completion approved.",
      data: { GoalID: Number(id), AchievedWeightage: Number(goal.Weightage) },
    });
  } catch (error) {
    await rollbackQuietly(transaction);
    console.error("Approve Goal Completion Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while approving goal completion.",
      errors: error.message,
    });
  }
};

// POST /goals/:id/completion/reject  body: { CompletionRemark }
const rejectGoalCompletion = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.UserID || req.user?.userId;
  const remark = String(req.body?.CompletionRemark ?? "").trim();

  if (!remark) {
    return res.status(400).json({
      success: false,
      message: "A remark is required to reject goal completion.",
      errors: { CompletionRemark: "Remark is required." },
    });
  }
  if (remark.length > COMPLETION_REMARK_MAX_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Remark cannot exceed ${COMPLETION_REMARK_MAX_LENGTH} characters.`,
      errors: {
        CompletionRemark: `Remark cannot exceed ${COMPLETION_REMARK_MAX_LENGTH} characters.`,
      },
    });
  }

  const transaction = new sql.Transaction(await poolPromise);

  try {
    await transaction.begin();

    const { goal, status, message } = await loadGoalForCompletionDecision(
      transaction,
      id,
      userId,
    );
    if (!goal) {
      await transaction.rollback();
      return res.status(status).json({ success: false, message });
    }

    const updateResult = await new sql.Request(transaction)
      .input("GoalID", sql.BigInt, id)
      .input(
        "CompletionRemark",
        sql.NVarChar(COMPLETION_REMARK_MAX_LENGTH),
        remark,
      )
      .query(`
        UPDATE dbo.Goals
        SET GoalStatus = 'Approved',
            CompletionRemark = @CompletionRemark,
            ModifiedDate = GETDATE()
        WHERE GoalID = @GoalID AND GoalStatus = 'Completion Submitted'
      `);
    if (updateResult.rowsAffected[0] !== 1) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "This goal's status changed. Refresh and try again.",
      });
    }

    await transaction.commit();

    await notifyCompletionEvent({
      recipientId: goal.UserID,
      goalId: id,
      title: "Goal Completion Rejected",
      message: `Completion of your goal "${goal.GoalTitle}" was not approved. Remark: ${remark}`,
      type: "GOAL_COMPLETION_REJECTED",
      createdBy: userId,
    });

    return res.status(200).json({
      success: true,
      message: "Goal completion rejected. The goal is back in Approved status.",
    });
  } catch (error) {
    await rollbackQuietly(transaction);
    console.error("Reject Goal Completion Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while rejecting goal completion.",
      errors: error.message,
    });
  }
};

// GET /goals/completion-requests/pending
const getPendingCompletionRequests = async (req, res) => {
  const userId = req.user?.UserID || req.user?.userId;

  try {
    const pool = await poolPromise;
    const result = await pool.request().input("ApproverID", sql.Int, userId)
      .query(`
        SELECT g.GoalID, g.GoalNumber, g.GoalTitle, g.Weightage, g.Quarter,
               g.CompletionRequestedDate,
               (SELECT COUNT(*) FROM dbo.GoalSubGoals sg
                 WHERE sg.GoalID = g.GoalID) AS SubGoalCount,
               (SELECT COUNT(*) FROM dbo.GoalSubGoals sg
                 WHERE sg.GoalID = g.GoalID AND sg.Status = 'Completed') AS CompletedSubGoalCount,
               u.UserID AS EmployeeID,
               LTRIM(RTRIM(CONCAT(u.FirstName, ' ', u.LastName))) AS EmployeeName
        FROM dbo.Goals g
        INNER JOIN dbo.Users u ON u.UserID = g.UserID
        WHERE g.GoalStatus = 'Completion Submitted'
          AND COALESCE(u.ReportingManagerID, u.HODID) = @ApproverID
          AND g.UserID <> @ApproverID
        ORDER BY g.CompletionRequestedDate ASC
      `);

    return res.status(200).json({ success: true, data: result.recordset });
  } catch (error) {
    console.error("Get Pending Completion Requests Error:", error);
    return res.status(500).json({
      success: false,
      message:
        "Internal server error while fetching pending completion requests.",
      errors: error.message,
    });
  }
};

module.exports = {
  getGoals,
  getJointAccountabilityUsers,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  changeGoalStatus,
  submitGoalReview,
  getAllEmployeeGoals,
  getJointGoals,
  updateJointAccountabilityStatus,
  getGoalHistory,
  updateSubGoalStatus,
  getTeamGoals,
  requestGoalCompletion,
  approveGoalCompletion,
  rejectGoalCompletion,
  getPendingCompletionRequests,
};
