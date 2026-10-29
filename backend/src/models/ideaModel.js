const { sql } = require("../config/db");
const { IDEA_CLOSED_STATUSES } = require("../constants/ideaConstants");

/**
 * ============================================================
 * Idea Model
 * SQL for dbo.Ideas and dbo.IdeaActivityLog.
 *
 * Every function takes `db`: either a resolved pool or an open
 * sql.Transaction (both expose .request()).
 * ============================================================
 */

const fullName = (alias) =>
    `LTRIM(RTRIM(CONCAT(${alias}.FirstName, ' ', ${alias}.LastName)))`;

// Overdue: target date has passed and the idea isn't closed.
const IS_OVERDUE = `
    CAST(CASE
        WHEN i.TargetDate < CAST(SYSDATETIME() AS DATE)
         AND i.Status NOT IN (${IDEA_CLOSED_STATUSES.map((s) => `N'${s}'`).join(", ")})
        THEN 1 ELSE 0
    END AS BIT)
`;

/**
 * Active users for the Lead dropdown, excluding the logged-in user
 */
const getLeadOptions = async (db, excludeUserId) => {

    const result = await db.request()
        .input("UserID", sql.Int, excludeUserId)
        .query(`
            SELECT
                u.UserID,
                u.EmployeeCode,
                ${fullName("u")} AS FullName,
                u.Designation,
                d.DepartmentName
            FROM dbo.Users u
            LEFT JOIN dbo.Departments d
                ON d.DepartmentID = u.DepartmentID
            WHERE u.IsActive = 1
              AND u.UserID <> @UserID
            ORDER BY u.FirstName, u.LastName;
        `);

    return result.recordset;
};

/**
 * Active user by id, or null
 */
const getActiveUser = async (db, userId) => {

    const result = await db.request()
        .input("UserID", sql.Int, userId)
        .query(`
            SELECT UserID
            FROM dbo.Users
            WHERE UserID = @UserID
              AND IsActive = 1;
        `);

    return result.recordset[0] || null;
};

/**
 * Raw idea row. Pass `lock = true` inside a transaction to hold an update
 * lock on the row until commit (stops two submits of the same idea racing).
 */
const getIdeaRow = async (db, ideaId, lock = false) => {

    const result = await db.request()
        .input("IdeaID", sql.Int, ideaId)
        .query(`
            SELECT
                IdeaID,
                IdeaNumber,
                UserID,
                Title,
                Description,
                Purpose,
                AssignedLeadID,
                Status
            FROM dbo.Ideas ${lock ? "WITH (UPDLOCK, ROWLOCK)" : ""}
            WHERE IdeaID = @IdeaID;
        `);

    return result.recordset[0] || null;
};

/**
 * Insert a new Draft idea, returns the new IdeaID
 */
const insertDraftIdea = async (db, idea) => {

    const result = await db.request()
        .input("UserID", sql.Int, idea.userId)
        .input("Title", sql.NVarChar(200), idea.title)
        .input("Description", sql.NVarChar(4000), idea.description)
        .input("Purpose", sql.NVarChar(100), idea.purpose)
        .input("AssignedLeadID", sql.Int, idea.assignedLeadId)
        .query(`
            INSERT INTO dbo.Ideas
                (UserID, Title, Description, Purpose, AssignedLeadID, Status, CreatedDate)
            OUTPUT INSERTED.IdeaID
            VALUES
                (@UserID, @Title, @Description, @Purpose, @AssignedLeadID, N'Draft', SYSDATETIME());
        `);

    return result.recordset[0].IdeaID;
};

/**
 * Update a Draft's content. The UserID/Status guard makes this a no-op if
 * the idea isn't the user's or has left Draft. Returns true if updated.
 */
const updateDraftIdea = async (db, idea) => {

    const result = await db.request()
        .input("IdeaID", sql.Int, idea.ideaId)
        .input("UserID", sql.Int, idea.userId)
        .input("Title", sql.NVarChar(200), idea.title)
        .input("Description", sql.NVarChar(4000), idea.description)
        .input("Purpose", sql.NVarChar(100), idea.purpose)
        .input("AssignedLeadID", sql.Int, idea.assignedLeadId)
        .query(`
            UPDATE dbo.Ideas
            SET
                Title = @Title,
                Description = @Description,
                Purpose = @Purpose,
                AssignedLeadID = @AssignedLeadID,
                ModifiedDate = SYSDATETIME()
            WHERE IdeaID = @IdeaID
              AND UserID = @UserID
              AND Status = N'Draft';
        `);

    return result.rowsAffected[0] > 0;
};

/**
 * Delete a Draft (its activity log rows cascade). Returns true if deleted.
 */
const deleteDraftIdea = async (db, ideaId, userId) => {

    const result = await db.request()
        .input("IdeaID", sql.Int, ideaId)
        .input("UserID", sql.Int, userId)
        .query(`
            DELETE FROM dbo.Ideas
            WHERE IdeaID = @IdeaID
              AND UserID = @UserID
              AND Status = N'Draft';
        `);

    return result.rowsAffected[0] > 0;
};

/**
 * Draft -> Submitted. Returns true if the idea was still a Draft.
 */
const markIdeaSubmitted = async (db, ideaId) => {

    const result = await db.request()
        .input("IdeaID", sql.Int, ideaId)
        .query(`
            UPDATE dbo.Ideas
            SET
                Status = N'Submitted',
                SubmittedDate = SYSDATETIME(),
                ModifiedDate = SYSDATETIME()
            WHERE IdeaID = @IdeaID
              AND Status = N'Draft';
        `);

    return result.rowsAffected[0] > 0;
};

/**
 * Add an activity log entry
 */
const insertActivity = async (db, activity) => {

    await db.request()
        .input("IdeaID", sql.Int, activity.ideaId)
        .input("ActionBy", sql.Int, activity.actionBy)
        .input("Action", sql.NVarChar(50), activity.action)
        .input("FromStatus", sql.NVarChar(30), activity.fromStatus || null)
        .input("ToStatus", sql.NVarChar(30), activity.toStatus || null)
        .input("Remark", sql.NVarChar(1000), activity.remark || null)
        .query(`
            INSERT INTO dbo.IdeaActivityLog
                (IdeaID, ActionBy, Action, FromStatus, ToStatus, Remark, ActionDate)
            VALUES
                (@IdeaID, @ActionBy, @Action, @FromStatus, @ToStatus, @Remark, SYSDATETIME());
        `);
};

/**
 * Ideas submitted by a user, newest first
 */
const getIdeasByUser = async (db, userId, status) => {

    const result = await db.request()
        .input("UserID", sql.Int, userId)
        .input("Status", sql.NVarChar(30), status || null)
        .query(`
            SELECT
                i.IdeaID,
                i.IdeaNumber,
                i.Title,
                i.Purpose,
                i.Status,
                i.AssignedLeadID,
                ${fullName("lead")} AS LeadName,
                i.TargetDate,
                ${IS_OVERDUE} AS IsOverdue,
                i.SubmittedDate,
                i.CreatedDate,
                i.ModifiedDate
            FROM dbo.Ideas i
            LEFT JOIN dbo.Users lead
                ON lead.UserID = i.AssignedLeadID
            WHERE i.UserID = @UserID
              AND (@Status IS NULL OR i.Status = @Status)
            ORDER BY i.CreatedDate DESC, i.IdeaID DESC;
        `);

    return result.recordset;
};

/**
 * Full idea details with submitter / lead / reviewer names. Also returns
 * the submitter's current reporting manager, used for the access check.
 */
const getIdeaDetails = async (db, ideaId) => {

    const result = await db.request()
        .input("IdeaID", sql.Int, ideaId)
        .query(`
            SELECT
                i.IdeaID,
                i.IdeaNumber,
                i.UserID,
                ${fullName("submitter")} AS SubmitterName,
                submitter.EmployeeCode AS SubmitterEmployeeCode,
                submitterDept.DepartmentName AS SubmitterDepartment,
                submitter.ReportingManagerID AS SubmitterReportingManagerID,
                i.Title,
                i.Description,
                i.Purpose,
                i.AssignedLeadID,
                ${fullName("lead")} AS LeadName,
                leadDept.DepartmentName AS LeadDepartment,
                i.TimelineDays,
                i.TimelineSetDate,
                i.TargetDate,
                ${IS_OVERDUE} AS IsOverdue,
                i.Remarks,
                i.Status,
                i.SubmittedDate,
                i.ReviewedBy,
                ${fullName("reviewer")} AS ReviewedByName,
                i.ReviewedDate,
                i.ImplementedDate,
                i.CreatedDate,
                i.ModifiedDate
            FROM dbo.Ideas i
            INNER JOIN dbo.Users submitter
                ON submitter.UserID = i.UserID
            LEFT JOIN dbo.Departments submitterDept
                ON submitterDept.DepartmentID = submitter.DepartmentID
            LEFT JOIN dbo.Users lead
                ON lead.UserID = i.AssignedLeadID
            LEFT JOIN dbo.Departments leadDept
                ON leadDept.DepartmentID = lead.DepartmentID
            LEFT JOIN dbo.Users reviewer
                ON reviewer.UserID = i.ReviewedBy
            WHERE i.IdeaID = @IdeaID;
        `);

    return result.recordset[0] || null;
};

/**
 * Activity log for an idea, oldest first
 */
const getIdeaActivity = async (db, ideaId) => {

    const result = await db.request()
        .input("IdeaID", sql.Int, ideaId)
        .query(`
            SELECT
                a.LogID,
                a.Action,
                a.FromStatus,
                a.ToStatus,
                a.Remark,
                a.ActionBy,
                ${fullName("u")} AS ActionByName,
                a.ActionDate
            FROM dbo.IdeaActivityLog a
            INNER JOIN dbo.Users u
                ON u.UserID = a.ActionBy
            WHERE a.IdeaID = @IdeaID
            ORDER BY a.ActionDate, a.LogID;
        `);

    return result.recordset;
};

module.exports = {
    getLeadOptions,
    getActiveUser,
    getIdeaRow,
    insertDraftIdea,
    updateDraftIdea,
    deleteDraftIdea,
    markIdeaSubmitted,
    insertActivity,
    getIdeasByUser,
    getIdeaDetails,
    getIdeaActivity,
};
