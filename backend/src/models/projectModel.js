const { sql } = require("../config/db");
const { TaskStatus } = require("../constants/taskConstants");

/**
 * ============================================================
 * Project Model
 * SQL for dbo.Projects and dbo.ProjectMembers (Task Tracker > Projects).
 * Project tasks themselves are rows of dbo.Tasks (see taskModel).
 *
 * Every function takes `db`: either a resolved pool or an open
 * sql.Transaction (both expose .request()).
 *
 * Both tables are DATETIME with GETDATE() defaults, so dates are written
 * with GETDATE(). A removed member keeps their row (IsActive = 0,
 * RemovedDate set); adding them again reactivates that row, since
 * (ProjectID, UserID) is unique.
 * ============================================================
 */

const fullName = (alias) =>
    `LTRIM(RTRIM(CONCAT(${alias}.FirstName, ' ', ${alias}.LastName)))`;

// Counts over a project's tasks (deleted ones left out), per row of `p`.
// @OwnerID set = the viewer: all tasks of projects they created, otherwise
// only their own.
const PROJECT_TASK_COUNTS = `
    OUTER APPLY (
        SELECT
            COUNT(*) AS TaskCount,
            SUM(CASE WHEN t.Status <> N'${TaskStatus.DONE}' THEN 1 ELSE 0 END) AS OpenCount,
            SUM(CASE
                WHEN t.Status <> N'${TaskStatus.DONE}'
                 AND t.DueDate < CAST(SYSDATETIME() AS DATE)
                THEN 1 ELSE 0
            END) AS OverdueCount
        FROM dbo.Tasks t
        WHERE t.ProjectID = p.ProjectID
          AND t.IsDeleted = 0
          AND (@OwnerID IS NULL OR p.CreatedBy = @OwnerID OR t.UserID = @OwnerID)
    ) c
`;

const PROJECT_SELECT = `
    p.ProjectID,
    p.ProjectName,
    p.Description,
    p.CreatedBy,
    ${fullName("creator")} AS CreatedByName,
    creator.Role AS CreatedByRole,
    p.CreatedDate,
    p.ModifiedDate,
    (
        SELECT COUNT(*)
        FROM dbo.ProjectMembers pm
        INNER JOIN dbo.Users mu ON mu.UserID = pm.UserID
        WHERE pm.ProjectID = p.ProjectID
          AND pm.IsActive = 1
    ) AS MemberCount,
    ISNULL(c.TaskCount, 0) AS TaskCount,
    ISNULL(c.OpenCount, 0) AS OpenCount,
    ISNULL(c.OverdueCount, 0) AS OverdueCount
`;

/**
 * Active projects. `viewerId` set = only projects that user created (a
 * Manager) or is an active member of, with counts over all tasks of
 * projects they created and their own tasks elsewhere; null = every
 * project with counts over all tasks.
 */
const listProjects = async (db, { viewerId = null } = {}) => {

    const result = await db.request()
        .input("MemberID", sql.Int, viewerId)
        .input("OwnerID", sql.Int, viewerId)
        .query(`
            SELECT ${PROJECT_SELECT}
            FROM dbo.Projects p
            INNER JOIN dbo.Users creator
                ON creator.UserID = p.CreatedBy
            ${PROJECT_TASK_COUNTS}
            WHERE p.IsActive = 1
              AND (
                @MemberID IS NULL
                OR p.CreatedBy = @MemberID
                OR EXISTS (
                    SELECT 1 FROM dbo.ProjectMembers pm
                    WHERE pm.ProjectID = p.ProjectID
                      AND pm.UserID = @MemberID
                      AND pm.IsActive = 1
                )
              )
            ORDER BY p.ProjectName;
        `);

    return result.recordset;
};

/**
 * One active project (counts over all its tasks), or null. Pass `lock =
 * true` inside a transaction to hold an update lock on the row, so member
 * changes and "All members" assignments of a project run one after the
 * other.
 */
const getProject = async (db, projectId, lock = false) => {

    const result = await db.request()
        .input("ProjectID", sql.Int, projectId)
        .input("OwnerID", sql.Int, null)
        .query(`
            SELECT ${PROJECT_SELECT}
            FROM dbo.Projects p ${lock ? "WITH (UPDLOCK, ROWLOCK)" : ""}
            INNER JOIN dbo.Users creator
                ON creator.UserID = p.CreatedBy
            ${PROJECT_TASK_COUNTS}
            WHERE p.ProjectID = @ProjectID
              AND p.IsActive = 1;
        `);

    return result.recordset[0] || null;
};

/**
 * True if another active project already has this name (case-insensitive
 * under the default collation). `excludeProjectId` skips the project being
 * renamed.
 */
const projectNameExists = async (db, projectName, excludeProjectId = null) => {

    const result = await db.request()
        .input("ProjectName", sql.NVarChar(200), projectName)
        .input("ExcludeID", sql.Int, excludeProjectId)
        .query(`
            SELECT TOP 1 1 AS Found
            FROM dbo.Projects
            WHERE IsActive = 1
              AND ProjectName = @ProjectName
              AND (@ExcludeID IS NULL OR ProjectID <> @ExcludeID);
        `);

    return result.recordset.length > 0;
};

/**
 * Insert a project, returns the new ProjectID.
 */
const insertProject = async (db, { projectName, description, createdBy }) => {

    const result = await db.request()
        .input("ProjectName", sql.NVarChar(200), projectName)
        .input("Description", sql.NVarChar(sql.MAX), description || null)
        .input("CreatedBy", sql.Int, createdBy)
        .query(`
            INSERT INTO dbo.Projects
                (ProjectName, Description, CreatedBy, CreatedDate, IsActive)
            OUTPUT INSERTED.ProjectID
            VALUES
                (@ProjectName, @Description, @CreatedBy, GETDATE(), 1);
        `);

    return result.recordset[0].ProjectID;
};

/**
 * Change a project's name and description. Returns true if updated.
 */
const updateProject = async (db, projectId, { projectName, description }) => {

    const result = await db.request()
        .input("ProjectID", sql.Int, projectId)
        .input("ProjectName", sql.NVarChar(200), projectName)
        .input("Description", sql.NVarChar(sql.MAX), description || null)
        .query(`
            UPDATE dbo.Projects
            SET ProjectName = @ProjectName,
                Description = @Description,
                ModifiedDate = GETDATE()
            WHERE ProjectID = @ProjectID
              AND IsActive = 1;
        `);

    return result.rowsAffected[0] > 0;
};

/**
 * Active members of a project, by name.
 */
const listMembers = async (db, projectId) => {

    const result = await db.request()
        .input("ProjectID", sql.Int, projectId)
        .query(`
            SELECT
                pm.ProjectMemberID,
                pm.UserID,
                u.EmployeeCode,
                ${fullName("u")} AS FullName,
                u.Designation,
                d.DepartmentName,
                u.IsActive AS UserIsActive,
                pm.AddedBy,
                ${fullName("adder")} AS AddedByName,
                pm.AddedDate
            FROM dbo.ProjectMembers pm
            INNER JOIN dbo.Users u
                ON u.UserID = pm.UserID
            LEFT JOIN dbo.Departments d
                ON d.DepartmentID = u.DepartmentID
            LEFT JOIN dbo.Users adder
                ON adder.UserID = pm.AddedBy
            WHERE pm.ProjectID = @ProjectID
              AND pm.IsActive = 1
            ORDER BY u.FirstName, u.LastName;
        `);

    return result.recordset;
};

/**
 * True if the user is an active member of the project.
 */
const isActiveMember = async (db, projectId, userId) => {

    const result = await db.request()
        .input("ProjectID", sql.Int, projectId)
        .input("UserID", sql.Int, userId)
        .query(`
            SELECT TOP 1 1 AS Found
            FROM dbo.ProjectMembers
            WHERE ProjectID = @ProjectID
              AND UserID = @UserID
              AND IsActive = 1;
        `);

    return result.recordset.length > 0;
};

/**
 * True if the user is an active member of, or created, at least one active
 * project (Projects menu item).
 */
const hasActiveProjects = async (db, userId) => {

    const result = await db.request()
        .input("UserID", sql.Int, userId)
        .query(`
            SELECT TOP 1 1 AS Found
            FROM dbo.Projects p
            WHERE p.IsActive = 1
              AND (
                p.CreatedBy = @UserID
                OR EXISTS (
                    SELECT 1 FROM dbo.ProjectMembers pm
                    WHERE pm.ProjectID = p.ProjectID
                      AND pm.UserID = @UserID
                      AND pm.IsActive = 1
                )
              );
        `);

    return result.recordset.length > 0;
};

/**
 * Add a member: reactivates the existing (ProjectID, UserID) row if there
 * is one, otherwise inserts it. Returns "added", "reactivated" or
 * "already" (already an active member; nothing changed).
 */
const addMember = async (db, projectId, userId, addedBy) => {

    const result = await db.request()
        .input("ProjectID", sql.Int, projectId)
        .input("UserID", sql.Int, userId)
        .input("AddedBy", sql.Int, addedBy)
        .query(`
            DECLARE @Existing BIT;

            SELECT @Existing = IsActive
            FROM dbo.ProjectMembers WITH (UPDLOCK, HOLDLOCK)
            WHERE ProjectID = @ProjectID
              AND UserID = @UserID;

            IF @Existing IS NULL
            BEGIN
                INSERT INTO dbo.ProjectMembers
                    (ProjectID, UserID, AddedBy, AddedDate, IsActive, RemovedDate)
                VALUES
                    (@ProjectID, @UserID, @AddedBy, GETDATE(), 1, NULL);

                SELECT 'added' AS Outcome;
            END
            ELSE IF @Existing = 0
            BEGIN
                UPDATE dbo.ProjectMembers
                SET IsActive = 1,
                    RemovedDate = NULL,
                    AddedBy = @AddedBy,
                    AddedDate = GETDATE()
                WHERE ProjectID = @ProjectID
                  AND UserID = @UserID;

                SELECT 'reactivated' AS Outcome;
            END
            ELSE
                SELECT 'already' AS Outcome;
        `);

    return result.recordset[0].Outcome;
};

/**
 * Remove a member (IsActive = 0, RemovedDate = now). Their tasks are left
 * as they are. Returns true if an active membership was removed.
 */
const removeMember = async (db, projectId, userId) => {

    const result = await db.request()
        .input("ProjectID", sql.Int, projectId)
        .input("UserID", sql.Int, userId)
        .query(`
            UPDATE dbo.ProjectMembers
            SET IsActive = 0,
                RemovedDate = GETDATE()
            WHERE ProjectID = @ProjectID
              AND UserID = @UserID
              AND IsActive = 1;
        `);

    return result.rowsAffected[0] > 0;
};

/**
 * Users by id ({ UserID, FullName, IsActive, ReportingManagerID }), for
 * validating member picks and removals.
 */
const getUsers = async (db, userIds) => {
    if (userIds.length === 0) return [];

    const request = db.request();
    const idParams = userIds.map((id, index) => {
        request.input(`UserID${index}`, sql.Int, id);
        return `@UserID${index}`;
    });

    const result = await request.query(`
        SELECT u.UserID, ${fullName("u")} AS FullName, u.IsActive, u.ReportingManagerID
        FROM dbo.Users u
        WHERE u.UserID IN (${idParams.join(", ")});
    `);

    return result.recordset;
};

/**
 * Active users whose Reporting Manager is `managerId` (the members a
 * Manager may add), in the same shape as taskModel.getAssignableEmployees.
 */
const listReportees = async (db, managerId) => {

    const result = await db.request()
        .input("ManagerID", sql.Int, managerId)
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
              AND u.ReportingManagerID = @ManagerID
              AND u.UserID <> @ManagerID
            ORDER BY u.FirstName, u.LastName;
        `);

    return result.recordset;
};

module.exports = {
    listProjects,
    getProject,
    projectNameExists,
    insertProject,
    updateProject,
    listMembers,
    isActiveMember,
    hasActiveProjects,
    addMember,
    removeMember,
    getUsers,
    listReportees,
};
