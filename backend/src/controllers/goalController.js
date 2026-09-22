const { poolPromise, sql } = require("../config/db");
const crypto = require("crypto");
const goalModel = require("../models/goalModel");
const jointAccountabilityModel = require("../models/jointAccountabilityModel");
const { notifyUser } = require("../services/notifyService");
const { validateSmartGoal } = require("../utils/smartGoalValidator");
const { calculateGoalProgress } = require("../utils/goalProgress");
const {
  getFiscalQuarter,
  isWithinCarryForwardWindow,
} = require("../utils/fiscalQuarter");

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
const getGoals = async (req, res) => {
  const userId = req.user?.UserID || req.user?.userId;
  const { quarter, status } = req.query;

  try {
    const pool = await poolPromise;
    let query = `
            SELECT g.*, u.Username, u.FirstName, u.LastName 
            FROM dbo.Goals g
            JOIN dbo.Users u ON g.UserID = u.UserID
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

    return res.status(200).json({ success: true, data: result.recordset });
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
            WHERE g.GoalStatus IN (
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
            WHERE ${scopeCondition}
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
      .query("SELECT TOP 1 * FROM dbo.Goals WHERE GoalID = @GoalID");

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
    const canViewGoal =
      Number(requesterUserId) === Number(goal.UserID) ||
      ["CFO", "ADMIN"].includes(requesterRole) ||
      assignedApproverIds.includes(Number(requesterUserId));

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
      requesterRole === "CFO" ||
      requesterRole === "ADMIN" ||
      (await canApproveOrRejectGoal(requesterUserId, goal.UserID));

    return res.status(200).json({
      success: true,
      data: {
        ...goal,
        SubGoals: subGoalsResult.recordset,
        History: historyResult.recordset,
        CanApproveOrReject: canApproveOrReject,
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

// 3. Add Goal
const createGoal = async (req, res) => {
  const {
    GoalNumber,
    GoalTitle,
    GoalDescription,
    Measurability,
    JointAccountability,
    Weightage,
    Priority,
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

  if (!GoalTitle || !Weightage || !Priority || !Timeline) {
    return res
      .status(400)
      .json({ success: false, message: "Mandatory goal fields are missing." });
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
        Timeline,
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
    request.input("Timeline", sql.Date, Timeline);
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
                JointAccountability, Weightage, Priority, Timeline, MeetPerformance, 
                ExceedPerformance, ValidationSource, CrossFunctionalGoal, GoalCategory, 
                GoalStatus, DraftVersion, SubmittedDate, CreatedDate
            )
            OUTPUT INSERTED.GoalID
            VALUES (
                @UserID, @GoalNumber, @GoalTitle, @GoalDescription, @Measurability, 
                @JointAccountability, @Weightage, @Priority, @Timeline, @MeetPerformance, 
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

    const validSubGoals = (SubGoals || []).filter((sub) =>
      sub?.SubGoalTitle?.trim(),
    );

    if (validSubGoals.length > 0) {
      for (let i = 0; i < validSubGoals.length; i++) {
        const sub = validSubGoals[i];
        const subRequest = new sql.Request(transaction);
        subRequest.input("GoalID", sql.BigInt, newGoalID);
        subRequest.input("SubGoalNo", sql.Int, i + 1);
        subRequest.input("SubGoalTitle", sql.NVarChar, sub.SubGoalTitle);
        subRequest.input(
          "SubGoalDescription",
          sql.NVarChar,
          sub.SubGoalDescription || null,
        );
        subRequest.input("Weightage", sql.Decimal(5, 2), sub.Weightage || 0);
        subRequest.input("Target", sql.NVarChar, sub.Target || null);
        subRequest.input("Status", sql.VarChar, "Pending");

        await subRequest.query(`
                    INSERT INTO dbo.GoalSubGoals (GoalID, SubGoalNo, SubGoalTitle, SubGoalDescription, Weightage, Target, Status, CreatedDate)
                    VALUES (@GoalID, @SubGoalNo, @SubGoalTitle, @SubGoalDescription, @Weightage, @Target, @Status, GETDATE())
                `);
      }
    }

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
    Weightage,
    Priority,
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

    // isDraft/canEditAllFields must be declared BEFORE ownerLocked uses them
    const isDraft = currentStatus === "Draft";
    const canEditAllFields =
      isDraft ||
      currentStatus === "Rejected" ||
      isEnterpriseGoalManager ||
      isTeamGoalManager;

    const ownerLocked =
      !isEnterpriseGoalManager && !isTeamGoalManager && !canEditAllFields;
    // ownerLocked is true for the owner on ANY non-Draft/non-Rejected status —
    // Submitted, Manager Approved, HOD Approved, Approved, etc.

    let isCarryForward = false;

    if (ownerLocked) {
      const terminal = ["Completed", "Cancelled"].includes(currentStatus);
      const inWindow =
        !terminal && isWithinCarryForwardWindow(existingGoal.QuarterEndDate);

      if (!inWindow) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "This goal cannot be modified in its current status.",
        });
      }

      // In the carry-forward window: only Timeline may change.
      const guardedFields = {
        GoalNumber,
        GoalTitle,
        GoalDescription,
        Measurability,
        JointAccountability,
        Weightage,
        Priority,
        MeetPerformance,
        ExceedPerformance,
        ValidationSource,
        CrossFunctionalGoal,
        GoalCategory,
      };
      const onlyTimelineChanged = Object.entries(guardedFields).every(
        ([field, value]) =>
          value === undefined || value === existingGoal[field],
      );

      if (!onlyTimelineChanged) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message:
            "Only the Timeline can be updated during the carry-forward window.",
        });
      }

      if (!Timeline) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Timeline is required to carry this goal forward.",
        });
      }

      isCarryForward = true;
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

    const { label: newQuarter, quarterEndDate: newQuarterEndDate } =
      isCarryForward
        ? getFiscalQuarter(new Date(Timeline))
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

    // SMART validation only applies when this update actually moves the
    // goal to 'Submitted' — validated against the exact values that
    // will be persisted below (finalGoalDesc/finalCategory respect the
    // isDraft field-locking rule already in this function; Weightage
    // and Timeline aren't isDraft-gated here — they never were, even
    // before this fix — so they're validated as submitted directly).
    // Uses the goal's own transaction connection for the Achievable
    // weightage-sum read, and the goal's real CreatedDate as the
    // Time-bound baseline (not "now" — this goal may have been created
    // long before this edit).
    if (newStatus === "Submitted") {
      const { valid, errors } = await validateSmartGoal(
        {
          GoalTitle: finalGoalTitle,
          GoalDescription: finalGoalDesc,
          Measurability,
          MeetPerformance: finalMeetPerf,
          ExceedPerformance: finalExceedPerf,
          Weightage,
          GoalCategory: finalCategory,
          Timeline,
          CreatedDate: existingGoal.CreatedDate,
        },
        { pool: await poolPromise, userId, excludeGoalId: id },
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
    updateRequest.input("Measurability", sql.NVarChar, Measurability || null);
    updateRequest.input(
      "JointAccountability",
      sql.NVarChar,
      finalJointAcc || null,
    );
    updateRequest.input("Weightage", sql.Decimal(5, 2), Weightage);
    updateRequest.input("Priority", sql.VarChar, Priority);
    updateRequest.input("Timeline", sql.Date, Timeline);
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
        Priority = @Priority, Timeline = @Timeline, MeetPerformance = @MeetPerformance,
        ExceedPerformance = @ExceedPerformance, ValidationSource = @ValidationSource,
        CrossFunctionalGoal = @CrossFunctionalGoal, GoalCategory = @GoalCategory, 
        GoalStatus = @GoalStatus,
        Quarter = @Quarter,
        QuarterEndDate = @QuarterEndDate,
        ApprovedDate = CASE WHEN @IsCarryForward = 1 THEN NULL ELSE ApprovedDate END,
        BusinessHeadApprovedBy = CASE WHEN @IsCarryForward = 1 THEN NULL ELSE BusinessHeadApprovedBy END,
        BusinessHeadApprovedDate = CASE WHEN @IsCarryForward = 1 THEN NULL ELSE BusinessHeadApprovedDate END,
        CarryForwardCount = CASE WHEN @IsCarryForward = 1 THEN ISNULL(CarryForwardCount, 0) + 1 ELSE CarryForwardCount END,
        SubmittedDate = CASE
          WHEN @GoalStatus = 'Submitted' AND @CurrentStatus <> 'Submitted'
            THEN GETDATE()
          ELSE SubmittedDate
        END,
        ModifiedDate = GETDATE()
    WHERE GoalID = @GoalID
`;

    await updateRequest.query(updateQuery);

    const { oldValues, newValues } = buildGoalDiff(existingGoal, {
      GoalNumber: finalGoalNumber,
      GoalTitle: finalGoalTitle,
      GoalDescription: finalGoalDesc,
      Measurability,
      JointAccountability: finalJointAcc,
      Weightage,
      Priority,
      Timeline,
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

    const validSubGoals = (SubGoals || []).filter((sub) =>
      sub?.SubGoalTitle?.trim(),
    );

    if (canEditAllFields && (SubGoals || []).length > 0) {
      const deleteSubRequest = new sql.Request(transaction);
      await deleteSubRequest
        .input("GoalID", sql.BigInt, id)
        .query("DELETE FROM dbo.GoalSubGoals WHERE GoalID = @GoalID");

      for (let i = 0; i < validSubGoals.length; i++) {
        const sub = validSubGoals[i];
        const subRequest = new sql.Request(transaction);
        subRequest.input("GoalID", sql.BigInt, id);
        subRequest.input("SubGoalNo", sql.Int, i + 1);
        subRequest.input("SubGoalTitle", sql.NVarChar, sub.SubGoalTitle);
        subRequest.input(
          "SubGoalDescription",
          sql.NVarChar,
          sub.SubGoalDescription || null,
        );
        subRequest.input("Weightage", sql.Decimal(5, 2), sub.Weightage || 0);
        subRequest.input("Target", sql.NVarChar, sub.Target || null);
        subRequest.input("Status", sql.VarChar, "Pending");

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
        .input("FromQuarter", sql.VarChar, existingGoal.Quarter)
        .input("ToQuarter", sql.VarChar, newQuarter).query(`
          INSERT INTO dbo.GoalCarryForwardHistory (GoalID, FromQuarter, ToQuarter, CarriedForwardDate)
          VALUES (@GoalID, @FromQuarter, @ToQuarter, GETDATE())
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

    // History contains the same sensitive goal information as the detail
    // page, so it must use the same owner/hierarchy/CFO/Admin access rule.
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
      assignedApproverIds.includes(Number(requesterUserId));

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
      .query("SELECT GoalStatus FROM dbo.Goals WHERE GoalID = @GoalID");

    if (checkResult.recordset.length === 0) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Goal not found." });
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

    const role = (req.user?.Role || req.user?.role || "").toUpperCase();

    // NEW: Business Head is "final" either after Manager/HOD already approved,
    // OR when this employee reports directly to Business Head (no Manager/HOD stage exists).
    const isDirectReport =
      role === "BUSINESSHEAD"
        ? await isDirectBusinessHeadReport(goalOwnerId, userId)
        : false;

    const isFinalBusinessHeadAction =
      role === "BUSINESSHEAD" && (oldStatus !== "Submitted" || isDirectReport);

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
      !isFinalApproval && role !== "ADMIN" && isAuthorizedApprover;
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
    const oldStatus = existingGoal.GoalStatus;
    const newStatus = statusFlow[oldStatus];

    console.log(
      "DEBUG → oldStatus:",
      JSON.stringify(oldStatus),
      "| newStatus:",
      JSON.stringify(newStatus),
      "| userId:",
      userId,
    );

    if (!newStatus) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Goal cannot be reviewed while in '${oldStatus}' status.`,
      });
    }

    const updateReq = new sql.Request(transaction);
    const currentQuarter = `Q${Math.floor(new Date().getMonth() / 3) + 1}`;
    await updateReq
      .input("GoalID", sql.BigInt, goalId)
      .input("Quarter", sql.VarChar(2), currentQuarter)
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
        "SELECT UserID, GoalTitle, Weightage FROM dbo.Goals WHERE GoalID = @GoalID",
      );

    if (goalRes.recordset.length === 0) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Goal not found." });
    }
    const goal = goalRes.recordset[0];

    // Only the goal's own owner logs sub-goal progress; Admin can too for corrections.
    const isAuthorized =
      role === "ADMIN" || Number(goal.UserID) === Number(userId);
    if (!isAuthorized) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this sub-goal.",
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
    const progress = calculateGoalProgress(goal, allSubGoals);

    return res.status(200).json({
      success: true,
      message: "Sub-goal status updated successfully.",
      data: { progress },
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
};
