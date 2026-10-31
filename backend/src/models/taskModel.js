const { sql } = require("../config/db");
const { TaskStatus, TASK_DONE_RECENT_DAYS } = require("../constants/taskConstants");

/**
 * ============================================================
 * Task Model
 * SQL for dbo.Tasks and dbo.TaskActivityLog (dbo.Users is only read).
 *
 * Every function takes `db`: either a resolved pool or an open
 * sql.Transaction (both expose .request()).
 *
 * Dates are written with SYSDATETIME() (server-local), the same basis as
 * the Ideas and Goals tables, so the SYSUTCDATETIME() column defaults on
 * CreatedDate are never relied on.
 * ============================================================
 */

const fullName = (alias) =>
    `LTRIM(RTRIM(CONCAT(${alias}.FirstName, ' ', ${alias}.LastName)))`;

const TODAY = "CAST(SYSDATETIME() AS DATE)";

// Overdue: DueDate before today and not Done (dates only). Not stored.
const IS_OVERDUE = `
    CAST(CASE
        WHEN t.Status <> N'${TaskStatus.DONE}'
         AND t.DueDate < ${TODAY}
        THEN 1 ELSE 0
    END AS BIT)
`;

// The same direct-report rule as the Ideas module (ideaModel
// DIRECT_REPORT_CONDITION): active users whose Reporting Manager or HOD is
// the viewer, one level only.
const DIRECT_REPORT_CONDITION = (alias) => `
    ${alias}.IsActive = 1
    AND ${alias}.UserID <> @ViewerID
    AND (${alias}.ReportingManagerID = @ViewerID OR ${alias}.HODID = @ViewerID)
`;

const TASK_SELECT = `
    t.TaskID,
    t.UserID,
    ${fullName("owner")} AS EmployeeName,
    owner.EmployeeCode,
    ownerDept.DepartmentName,
    t.TaskName,
    t.Priority,
    t.DueDate,
    t.Status,
    t.CFORemarks,
    t.CFORemarksBy,
    ${fullName("cfo")} AS CFORemarksByName,
    t.CFORemarksDate,
    t.UserRemarks,
    t.AssignedBy,
    ${fullName("assigner")} AS AssignedByName,
    t.AssignedDate,
    t.CompletedDate,
    t.IsSeenByUser,
    ${IS_OVERDUE} AS IsOverdue,
    t.CreatedBy,
    t.CreatedDate,
    t.ModifiedDate
`;

const TASK_FROM = `
    FROM dbo.Tasks t
    INNER JOIN dbo.Users owner
        ON owner.UserID = t.UserID
    LEFT JOIN dbo.Departments ownerDept
        ON ownerDept.DepartmentID = owner.DepartmentID
    LEFT JOIN dbo.Users assigner
        ON assigner.UserID = t.AssignedBy
    LEFT JOIN dbo.Users cfo
        ON cfo.UserID = t.CFORemarksBy
`;

/**
 * One task (not deleted) with names, or null. Pass `lock = true` inside a
 * transaction to hold an update lock on the row until commit, so two edits
 * of the same task run one after the other.
 */
const getTask = async (db, taskId, lock = false) => {

    const result = await db.request()
        .input("TaskID", sql.Int, taskId)
        .query(`
            SELECT
                ${TASK_SELECT},
                owner.ReportingManagerID AS OwnerReportingManagerID,
                owner.HODID AS OwnerHODID,
                owner.IsActive AS OwnerIsActive
            FROM dbo.Tasks t ${lock ? "WITH (UPDLOCK, ROWLOCK)" : ""}
            INNER JOIN dbo.Users owner
                ON owner.UserID = t.UserID
            LEFT JOIN dbo.Departments ownerDept
                ON ownerDept.DepartmentID = owner.DepartmentID
            LEFT JOIN dbo.Users assigner
                ON assigner.UserID = t.AssignedBy
            LEFT JOIN dbo.Users cfo
                ON cfo.UserID = t.CFORemarksBy
            WHERE t.TaskID = @TaskID
              AND t.IsDeleted = 0;
        `);

    return result.recordset[0] || null;
};

/**
 * Insert a task, returns the new TaskID. `assignedBy` set = assigned by the
 * Business Head (AssignedDate = now, IsSeenByUser = 0); null = self-added.
 */
const insertTask = async (db, task) => {
    const isAssigned = Boolean(task.assignedBy);

    const result = await db.request()
        .input("UserID", sql.Int, task.userId)
        .input("TaskName", sql.NVarChar(500), task.taskName)
        .input("Priority", sql.NVarChar(10), task.priority)
        .input("DueDate", sql.Date, task.dueDate)
        .input("Status", sql.NVarChar(20), task.status)
        .input("UserRemarks", sql.NVarChar(2000), task.userRemarks || null)
        .input("CFORemarks", sql.NVarChar(2000), task.cfoRemarks || null)
        .input("AssignedBy", sql.Int, task.assignedBy || null)
        .input("IsAssigned", sql.Bit, isAssigned ? 1 : 0)
        .input("CreatedBy", sql.Int, task.createdBy)
        .query(`
            INSERT INTO dbo.Tasks
                (UserID, TaskName, Priority, DueDate, Status,
                 CFORemarks, CFORemarksBy, CFORemarksDate,
                 UserRemarks, AssignedBy, AssignedDate, CompletedDate,
                 IsSeenByUser, IsDeleted, CreatedBy, CreatedDate)
            OUTPUT INSERTED.TaskID
            VALUES
                (@UserID, @TaskName, @Priority, @DueDate, @Status,
                 @CFORemarks,
                 CASE WHEN @CFORemarks IS NULL THEN NULL ELSE @AssignedBy END,
                 CASE WHEN @CFORemarks IS NULL THEN NULL ELSE SYSDATETIME() END,
                 @UserRemarks,
                 @AssignedBy,
                 CASE WHEN @IsAssigned = 1 THEN SYSDATETIME() END,
                 CASE WHEN @Status = N'${TaskStatus.DONE}' THEN SYSDATETIME() END,
                 CASE WHEN @IsAssigned = 1 THEN 0 ELSE 1 END,
                 0, @CreatedBy, SYSDATETIME());
        `);

    return result.recordset[0].TaskID;
};

// Columns the service may change through updateTask, with their SQL types.
const UPDATABLE_COLUMNS = {
    TaskName: sql.NVarChar(500),
    Priority: sql.NVarChar(10),
    DueDate: sql.Date,
    Status: sql.NVarChar(20),
    UserRemarks: sql.NVarChar(2000),
    CFORemarks: sql.NVarChar(2000),
    CFORemarksBy: sql.Int,
    IsSeenByUser: sql.Bit,
};

/**
 * Update a task (not deleted). `values` = { Column: value } for columns in
 * UPDATABLE_COLUMNS. Options:
 *   completedDate  "now" sets CompletedDate = SYSDATETIME(), "clear" sets NULL
 *   cfoRemarksDate true sets CFORemarksDate = SYSDATETIME()
 *   softDelete     true sets IsDeleted = 1
 * ModifiedDate is always set. Returns true if a row was updated.
 */
const updateTask = async (db, taskId, values = {}, { completedDate, cfoRemarksDate = false, softDelete = false } = {}) => {

    const request = db.request().input("TaskID", sql.Int, taskId);
    const setClauses = [];

    Object.entries(values).forEach(([column, value]) => {
        const type = UPDATABLE_COLUMNS[column];
        if (!type) throw new Error(`Task column ${column} cannot be updated.`);
        request.input(column, type, value);
        setClauses.push(`${column} = @${column}`);
    });

    if (completedDate === "now") setClauses.push("CompletedDate = SYSDATETIME()");
    if (completedDate === "clear") setClauses.push("CompletedDate = NULL");
    if (cfoRemarksDate) setClauses.push("CFORemarksDate = SYSDATETIME()");
    if (softDelete) setClauses.push("IsDeleted = 1");
    setClauses.push("ModifiedDate = SYSDATETIME()");

    const result = await request.query(`
        UPDATE dbo.Tasks
        SET
            ${setClauses.join(",\n            ")}
        WHERE TaskID = @TaskID
          AND IsDeleted = 0;
    `);

    return result.rowsAffected[0] > 0;
};

/**
 * Add a TaskActivityLog row. Old/new values are stored as given (strings;
 * the service serializes field changes as JSON).
 */
const insertActivity = async (db, activity) => {

    await db.request()
        .input("TaskID", sql.Int, activity.taskId)
        .input("ActionBy", sql.Int, activity.actionBy)
        .input("Action", sql.NVarChar(50), activity.action)
        .input("OldValue", sql.NVarChar(sql.MAX), activity.oldValue ?? null)
        .input("NewValue", sql.NVarChar(sql.MAX), activity.newValue ?? null)
        .query(`
            INSERT INTO dbo.TaskActivityLog
                (TaskID, ActionBy, Action, OldValue, NewValue, CreatedDate)
            VALUES
                (@TaskID, @ActionBy, @Action, @OldValue, @NewValue, SYSDATETIME());
        `);
};

/**
 * ------------------------------------------------------------
 * Lists (My Tasks / Team Tasks / All Tasks)
 * ------------------------------------------------------------
 */

/**
 * WHERE conditions for a list scope + filters. Returns { where, bind }.
 *   scope "my"   - the viewer's own tasks
 *   scope "team" - tasks of the viewer's direct reports
 *   scope "all"  - every user's tasks
 * filters: status, priority, dueFrom, dueTo (YYYY-MM-DD), source
 * ("self" | "assigned"), employeeId, department. With no status filter only
 * tasks not Done plus Done in the last TASK_DONE_RECENT_DAYS days are listed.
 */
const buildTaskListWhere = ({ scope, viewerId, filters }) => {
    const conditions = ["t.IsDeleted = 0"];
    const params = [["ViewerID", sql.Int, viewerId]];

    if (scope === "my") {
        conditions.push("t.UserID = @ViewerID");
    } else if (scope === "team") {
        conditions.push(DIRECT_REPORT_CONDITION("owner"));
    }

    if (filters.status) {
        conditions.push("t.Status = @Status");
        params.push(["Status", sql.NVarChar(20), filters.status]);
    } else {
        conditions.push(`
            t.Status <> N'${TaskStatus.DONE}'
            OR t.CompletedDate >= CAST(DATEADD(DAY, -${TASK_DONE_RECENT_DAYS}, ${TODAY}) AS DATETIME2)
        `);
    }

    if (filters.priority) {
        conditions.push("t.Priority = @Priority");
        params.push(["Priority", sql.NVarChar(10), filters.priority]);
    }

    if (filters.dueFrom) {
        conditions.push("t.DueDate >= @DueFrom");
        params.push(["DueFrom", sql.Date, filters.dueFrom]);
    }

    if (filters.dueTo) {
        conditions.push("t.DueDate <= @DueTo");
        params.push(["DueTo", sql.Date, filters.dueTo]);
    }

    if (filters.source === "self") {
        conditions.push("t.AssignedBy IS NULL");
    } else if (filters.source === "assigned") {
        conditions.push("t.AssignedBy IS NOT NULL");
    }

    if (filters.employeeId) {
        conditions.push("t.UserID = @EmployeeID");
        params.push(["EmployeeID", sql.Int, filters.employeeId]);
    }

    if (filters.department) {
        conditions.push("ownerDept.DepartmentName = @Department");
        params.push(["Department", sql.NVarChar(150), filters.department]);
    }

    return {
        where: conditions.map((condition) => `(${condition})`).join("\n AND "),
        bind: (request) => {
            params.forEach(([name, type, value]) => request.input(name, type, value));
            return request;
        },
    };
};

/**
 * Tasks for a list scope: open tasks first by due date, then Done tasks
 * (most recently completed first).
 */
const listTasks = async (db, { scope, viewerId, filters }) => {

    const { where, bind } = buildTaskListWhere({ scope, viewerId, filters });

    const result = await bind(db.request()).query(`
        SELECT
            ${TASK_SELECT}
        ${TASK_FROM}
        WHERE ${where}
        ORDER BY
            CASE WHEN t.Status = N'${TaskStatus.DONE}' THEN 1 ELSE 0 END,
            CASE WHEN t.Status = N'${TaskStatus.DONE}' THEN NULL ELSE t.DueDate END,
            t.CompletedDate DESC,
            t.TaskID DESC;
    `);

    return result.recordset;
};

/**
 * Number of the user's tasks not yet seen (badge)
 */
const countUnseenTasks = async (db, userId) => {

    const result = await db.request()
        .input("UserID", sql.Int, userId)
        .query(`
            SELECT COUNT(*) AS UnseenCount
            FROM dbo.Tasks
            WHERE UserID = @UserID
              AND IsSeenByUser = 0
              AND IsDeleted = 0;
        `);

    return result.recordset[0].UnseenCount;
};

/**
 * Mark the given tasks of the user as seen. Ids that aren't the user's,
 * are deleted or already seen are ignored. Returns the number updated.
 */
const markTasksSeen = async (db, userId, taskIds) => {
    if (taskIds.length === 0) return 0;

    const request = db.request().input("UserID", sql.Int, userId);
    const idParams = taskIds.map((id, index) => {
        request.input(`TaskID${index}`, sql.Int, id);
        return `@TaskID${index}`;
    });

    const result = await request.query(`
        UPDATE dbo.Tasks
        SET IsSeenByUser = 1
        WHERE UserID = @UserID
          AND IsSeenByUser = 0
          AND IsDeleted = 0
          AND TaskID IN (${idParams.join(", ")});
    `);

    return result.rowsAffected[0];
};

/**
 * True if the viewer has at least one direct report (Team Tasks access)
 */
const hasDirectReports = async (db, viewerId) => {

    const result = await db.request()
        .input("ViewerID", sql.Int, viewerId)
        .query(`
            SELECT TOP 1 1 AS Found
            FROM dbo.Users u
            WHERE ${DIRECT_REPORT_CONDITION("u")};
        `);

    return result.recordset.length > 0;
};

/**
 * Active users, for the Assign Task employee dropdown (the Business Head
 * themselves left out)
 */
const getAssignableEmployees = async (db, excludeUserId) => {

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
 * Active user by id ({ UserID, FullName }), or null
 */
const getActiveUser = async (db, userId) => {

    const result = await db.request()
        .input("UserID", sql.Int, userId)
        .query(`
            SELECT u.UserID, ${fullName("u")} AS FullName
            FROM dbo.Users u
            WHERE u.UserID = @UserID
              AND u.IsActive = 1;
        `);

    return result.recordset[0] || null;
};

/**
 * Filter dropdown values:
 *   team - employees: the viewer's direct reports
 *   all  - employees: users with at least one task; departments: their
 *          departments
 */
const getTaskFilterOptions = async (db, { scope, viewerId }) => {

    if (scope === "team") {
        const result = await db.request()
            .input("ViewerID", sql.Int, viewerId)
            .query(`
                SELECT u.UserID, ${fullName("u")} AS FullName, d.DepartmentName
                FROM dbo.Users u
                LEFT JOIN dbo.Departments d ON d.DepartmentID = u.DepartmentID
                WHERE ${DIRECT_REPORT_CONDITION("u")}
                ORDER BY u.FirstName, u.LastName;
            `);

        return { employees: result.recordset };
    }

    const result = await db.request().query(`
        SELECT u.UserID, ${fullName("u")} AS FullName, d.DepartmentName
        FROM dbo.Users u
        LEFT JOIN dbo.Departments d ON d.DepartmentID = u.DepartmentID
        WHERE EXISTS (
            SELECT 1 FROM dbo.Tasks t
            WHERE t.UserID = u.UserID AND t.IsDeleted = 0
        )
        ORDER BY u.FirstName, u.LastName;
    `);

    const departments = [...new Set(result.recordset.map((row) => row.DepartmentName).filter(Boolean))].sort();

    return { employees: result.recordset, departments };
};

/**
 * Task plus the employee's name, email and active flag, for task emails
 */
const getTaskMailData = async (db, taskId) => {

    const result = await db.request()
        .input("TaskID", sql.Int, taskId)
        .query(`
            SELECT
                t.TaskID,
                t.TaskName,
                t.Priority,
                t.DueDate,
                t.CFORemarks,
                t.UserID AS EmployeeID,
                ${fullName("owner")} AS EmployeeName,
                owner.Email AS EmployeeEmail,
                owner.IsActive AS EmployeeIsActive
            FROM dbo.Tasks t
            INNER JOIN dbo.Users owner
                ON owner.UserID = t.UserID
            WHERE t.TaskID = @TaskID
              AND t.IsDeleted = 0;
        `);

    return result.recordset[0] || null;
};

module.exports = {
    getTask,
    insertTask,
    updateTask,
    insertActivity,
    listTasks,
    countUnseenTasks,
    markTasksSeen,
    hasDirectReports,
    getAssignableEmployees,
    getActiveUser,
    getTaskFilterOptions,
    getTaskMailData,
};
