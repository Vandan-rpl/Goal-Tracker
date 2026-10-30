const { sql } = require("../config/db");
const { IDEA_OVERDUE_STATUSES, IDEA_LEAD_ROLES, IdeaActor } = require("../constants/ideaConstants");

/**
 * ============================================================
 * Idea Model
 * SQL for dbo.Ideas and dbo.IdeaActivityLog (dbo.IdeaFinalApprovers is
 * only read).
 *
 * Every function takes `db`: either a resolved pool or an open
 * sql.Transaction (both expose .request()).
 * ============================================================
 */

const fullName = (alias) =>
    `LTRIM(RTRIM(CONCAT(${alias}.FirstName, ' ', ${alias}.LastName)))`;

const TODAY = "CAST(SYSDATETIME() AS DATE)";

const OVERDUE_STATUS_LIST = IDEA_OVERDUE_STATUSES.map((s) => `N'${s}'`).join(", ");

const LEAD_ROLE_LIST = IDEA_LEAD_ROLES.map((r) => `N'${r}'`).join(", ");

// Overdue: Active / In Implementation and TargetDate before today (dates
// only). The single definition used by every query below.
const IS_OVERDUE = `
    CAST(CASE
        WHEN i.Status IN (${OVERDUE_STATUS_LIST})
         AND i.TargetDate < ${TODAY}
        THEN 1 ELSE 0
    END AS BIT)
`;

// Days until the target date (negative when overdue). Only for ideas that
// are still being worked on; NULL otherwise.
const DAYS_REMAINING = `
    CASE
        WHEN i.Status IN (${OVERDUE_STATUS_LIST})
        THEN DATEDIFF(DAY, ${TODAY}, i.TargetDate)
    END
`;

/**
 * Active users with a lead role for the Reporting Manager dropdown,
 * excluding the logged-in user
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
              AND u.Role IN (${LEAD_ROLE_LIST})
              AND u.UserID <> @UserID
            ORDER BY u.FirstName, u.LastName;
        `);

    return result.recordset;
};

/**
 * Active user with a lead role by id, or null
 */
const getLeadUser = async (db, userId) => {

    const result = await db.request()
        .input("UserID", sql.Int, userId)
        .query(`
            SELECT UserID
            FROM dbo.Users
            WHERE UserID = @UserID
              AND IsActive = 1
              AND Role IN (${LEAD_ROLE_LIST});
        `);

    return result.recordset[0] || null;
};

// Active final approvers who are also active users.
const ACTIVE_FINAL_APPROVERS_FROM = `
    FROM dbo.IdeaFinalApprovers fa
    INNER JOIN dbo.Users u
        ON u.UserID = fa.UserID
    LEFT JOIN dbo.Departments d
        ON d.DepartmentID = u.DepartmentID
    WHERE fa.IsActive = 1
      AND u.IsActive = 1
`;

/**
 * Active final approvers for the manager's approve dropdown, by
 * DisplayOrder (blank last) then name
 */
const getFinalApproverOptions = async (db) => {

    const result = await db.request().query(`
        SELECT
            u.UserID,
            ${fullName("u")} AS FullName,
            u.Designation,
            d.DepartmentName
        ${ACTIVE_FINAL_APPROVERS_FROM}
        ORDER BY
            CASE WHEN fa.DisplayOrder IS NULL THEN 1 ELSE 0 END,
            fa.DisplayOrder,
            u.FirstName,
            u.LastName;
    `);

    return result.recordset;
};

/**
 * Active final approver by user id, or null
 */
const getActiveFinalApprover = async (db, userId) => {

    const result = await db.request()
        .input("UserID", sql.Int, userId)
        .query(`
            SELECT u.UserID, ${fullName("u")} AS FullName
            ${ACTIVE_FINAL_APPROVERS_FROM}
              AND fa.UserID = @UserID;
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
                i.IdeaID,
                i.IdeaNumber,
                i.UserID,
                i.Title,
                i.Description,
                i.Purpose,
                i.AssignedLeadID,
                i.FinalApproverID,
                i.Status,
                i.TimelineDays,
                i.TargetDate,
                ${IS_OVERDUE} AS IsOverdue,
                -- Days from TargetDate to today (positive when it has passed)
                DATEDIFF(DAY, i.TargetDate, ${TODAY}) AS DaysPastTarget
            FROM dbo.Ideas i ${lock ? "WITH (UPDLOCK, ROWLOCK)" : ""}
            WHERE i.IdeaID = @IdeaID;
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
                i.FinalApproverID,
                ${fullName("finalApprover")} AS FinalApproverName,
                i.TargetDate,
                ${IS_OVERDUE} AS IsOverdue,
                i.SubmittedDate,
                i.CreatedDate,
                i.ModifiedDate
            FROM dbo.Ideas i
            LEFT JOIN dbo.Users lead
                ON lead.UserID = i.AssignedLeadID
            LEFT JOIN dbo.Users finalApprover
                ON finalApprover.UserID = i.FinalApproverID
            WHERE i.UserID = @UserID
              AND (@Status IS NULL OR i.Status = @Status)
            ORDER BY i.CreatedDate DESC, i.IdeaID DESC;
        `);

    return result.recordset;
};

/**
 * Ideas where the user is the reporting manager (lead) or the final approver
 * (Drafts excluded). Ideas waiting for the user's decision come first, oldest
 * submission first; then the rest, newest submission first.
 */
const getAssignedIdeas = async (db, userId) => {

    const result = await db.request()
        .input("UserID", sql.Int, userId)
        .query(`
            SELECT
                i.IdeaID,
                i.IdeaNumber,
                i.Title,
                i.Purpose,
                i.UserID AS SubmittedByID,
                ${fullName("submitter")} AS SubmitterName,
                submitterDept.DepartmentName AS SubmitterDepartment,
                i.AssignedLeadID,
                ${fullName("lead")} AS LeadName,
                i.FinalApproverID,
                ${fullName("finalApprover")} AS FinalApproverName,
                i.SubmittedDate,
                i.Status,
                i.TimelineDays,
                i.TargetDate,
                ${IS_OVERDUE} AS IsOverdue,
                ${DAYS_REMAINING} AS DaysRemaining,
                CAST(CASE WHEN i.AssignedLeadID = @UserID THEN 1 ELSE 0 END AS BIT) AS IsLead,
                CAST(CASE WHEN i.FinalApproverID = @UserID THEN 1 ELSE 0 END AS BIT) AS IsFinalApprover,
                pending.IsPendingWithMe
            FROM dbo.Ideas i
            INNER JOIN dbo.Users submitter
                ON submitter.UserID = i.UserID
            LEFT JOIN dbo.Departments submitterDept
                ON submitterDept.DepartmentID = submitter.DepartmentID
            LEFT JOIN dbo.Users lead
                ON lead.UserID = i.AssignedLeadID
            LEFT JOIN dbo.Users finalApprover
                ON finalApprover.UserID = i.FinalApproverID
            CROSS APPLY (
                SELECT CAST(CASE
                    WHEN i.Status = N'Submitted' AND i.AssignedLeadID = @UserID THEN 1
                    WHEN i.Status = N'Pending Final Approval' AND i.FinalApproverID = @UserID THEN 1
                    ELSE 0
                END AS BIT) AS IsPendingWithMe
            ) pending
            WHERE (i.AssignedLeadID = @UserID OR i.FinalApproverID = @UserID)
              AND i.Status <> N'Draft'
            ORDER BY
                pending.IsPendingWithMe DESC,
                CASE WHEN pending.IsPendingWithMe = 1 THEN i.SubmittedDate END ASC,
                i.SubmittedDate DESC,
                i.IdeaID DESC;
        `);

    return result.recordset;
};

/**
 * ------------------------------------------------------------
 * Team Ideas / All Ideas (server-side filters, sorting, paging)
 * ------------------------------------------------------------
 */

// The Goal Tracker's direct-report relationship (see teamController /
// analyticsController): active users whose Reporting Manager or HOD is the
// viewer, one level only.
const DIRECT_REPORT_CONDITION = (alias) => `
    ${alias}.IsActive = 1
    AND ${alias}.UserID <> @ViewerID
    AND (${alias}.ReportingManagerID = @ViewerID OR ${alias}.HODID = @ViewerID)
`;

// Who may see an idea: the submitter, its reporting manager (lead) or final
// approver, the submitter's Reporting Manager / HOD, or a view-all role
// (@ViewAll = 1). The single rule for Idea Details and Track Idea. Needs
// @ViewerID, @ViewAll and dbo.Users joined as `submitter`.
const CAN_VIEW_IDEA = `
    (@ViewAll = 1
     OR i.UserID = @ViewerID
     OR i.AssignedLeadID = @ViewerID
     OR i.FinalApproverID = @ViewerID
     OR submitter.ReportingManagerID = @ViewerID
     OR submitter.HODID = @ViewerID)
`;

const bindViewer = (request, { viewerId, viewAll }) =>
    request
        .input("ViewerID", sql.Int, viewerId)
        .input("ViewAll", sql.Bit, viewAll ? 1 : 0);

// sortBy values the API accepts -> ORDER BY expression
const IDEA_SORT_COLUMNS = {
    submittedDate: "i.SubmittedDate",
    ideaNumber: "i.IdeaID",
    title: "i.Title",
    submitter: fullName("submitter"),
    targetDate: "i.TargetDate",
    status: "i.Status",
};

const IDEA_LIST_FROM = `
    FROM dbo.Ideas i
    INNER JOIN dbo.Users submitter
        ON submitter.UserID = i.UserID
    LEFT JOIN dbo.Departments submitterDept
        ON submitterDept.DepartmentID = submitter.DepartmentID
    LEFT JOIN dbo.Users lead
        ON lead.UserID = i.AssignedLeadID
    LEFT JOIN dbo.Departments leadDept
        ON leadDept.DepartmentID = lead.DepartmentID
    LEFT JOIN dbo.Users finalApprover
        ON finalApprover.UserID = i.FinalApproverID
    LEFT JOIN dbo.Departments finalApproverDept
        ON finalApproverDept.DepartmentID = finalApprover.DepartmentID
`;

// LIKE pattern for a literal substring (escapes %, _ and [).
const likeContains = (text) => `%${text.replace(/[[%_]/g, "[$&]")}%`;

/**
 * WHERE conditions for a list scope + filters. Returns { conditions, bind },
 * where bind(request) adds the parameters. `includeStatus = false` leaves
 * out the status filter (used for the count boxes).
 */
const buildIdeaListWhere = ({ scope, viewerId, filters }, { includeStatus }) => {
    const conditions = ["i.Status <> N'Draft'"];
    const params = [["ViewerID", sql.Int, viewerId]];

    if (scope === "team") {
        conditions.push(DIRECT_REPORT_CONDITION("submitter"));
    }

    if (filters.search) {
        conditions.push("(i.IdeaNumber LIKE @Search OR i.Title LIKE @Search)");
        params.push(["Search", sql.NVarChar(210), likeContains(filters.search)]);
    }

    if (includeStatus && filters.status) {
        conditions.push("i.Status = @Status");
        params.push(["Status", sql.NVarChar(30), filters.status]);
    }

    if (filters.purpose) {
        conditions.push("i.Purpose = @Purpose");
        params.push(["Purpose", sql.NVarChar(100), filters.purpose]);
    }

    if (filters.overdueOnly) {
        conditions.push(`i.Status IN (${OVERDUE_STATUS_LIST}) AND i.TargetDate < ${TODAY}`);
    }

    if (filters.submittedFrom) {
        conditions.push("CAST(i.SubmittedDate AS DATE) >= @SubmittedFrom");
        params.push(["SubmittedFrom", sql.Date, filters.submittedFrom]);
    }

    if (filters.submittedTo) {
        conditions.push("CAST(i.SubmittedDate AS DATE) <= @SubmittedTo");
        params.push(["SubmittedTo", sql.Date, filters.submittedTo]);
    }

    if (filters.memberId) {
        conditions.push("i.UserID = @MemberID");
        params.push(["MemberID", sql.Int, filters.memberId]);
    }

    if (filters.department) {
        conditions.push("submitterDept.DepartmentName = @Department");
        params.push(["Department", sql.NVarChar(150), filters.department]);
    }

    if (filters.leadId) {
        conditions.push("i.AssignedLeadID = @LeadID");
        params.push(["LeadID", sql.Int, filters.leadId]);
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
 * One page of ideas plus per-status counts.
 *
 * @param {object} options
 * @param {"team"|"all"} options.scope
 * @param {number} options.viewerId
 * @param {object} options.filters  - see buildIdeaListWhere
 * @param {string} options.sortBy   - key of IDEA_SORT_COLUMNS
 * @param {"asc"|"desc"} options.sortDir
 * @param {number} options.page     - 1-based
 * @param {number} options.pageSize
 * @returns {Promise<{ items: object[], statusCounts: object[] }>}
 *   statusCounts: [{ Status, IdeaCount, OverdueCount }] for every filter
 *   except status.
 */
const searchIdeas = async (db, { scope, viewerId, filters, sortBy, sortDir, page, pageSize }) => {

    const listWhere = buildIdeaListWhere({ scope, viewerId, filters }, { includeStatus: true });
    const countWhere = buildIdeaListWhere({ scope, viewerId, filters }, { includeStatus: false });

    // i.IdeaID breaks ties so paging is stable (unless it's already the sort).
    const sortColumn = IDEA_SORT_COLUMNS[sortBy];
    const orderBy = `${sortColumn} ${sortDir === "asc" ? "ASC" : "DESC"}${
        sortColumn === "i.IdeaID" ? "" : ", i.IdeaID DESC"
    }`;

    const itemsRequest = listWhere.bind(db.request())
        .input("Offset", sql.Int, (page - 1) * pageSize)
        .input("PageSize", sql.Int, pageSize);

    const [itemsResult, countsResult] = await Promise.all([
        itemsRequest.query(`
            SELECT
                i.IdeaID,
                i.IdeaNumber,
                i.Title,
                i.Purpose,
                i.UserID AS SubmittedByID,
                ${fullName("submitter")} AS SubmitterName,
                submitterDept.DepartmentName AS SubmitterDepartment,
                i.AssignedLeadID,
                ${fullName("lead")} AS LeadName,
                leadDept.DepartmentName AS LeadDepartment,
                i.FinalApproverID,
                ${fullName("finalApprover")} AS FinalApproverName,
                finalApproverDept.DepartmentName AS FinalApproverDepartment,
                i.SubmittedDate,
                i.Status,
                i.TargetDate,
                ${IS_OVERDUE} AS IsOverdue,
                ${DAYS_REMAINING} AS DaysRemaining
            ${IDEA_LIST_FROM}
            WHERE ${listWhere.where}
            ORDER BY ${orderBy}
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        `),
        countWhere.bind(db.request()).query(`
            SELECT
                i.Status,
                COUNT(*) AS IdeaCount,
                SUM(CASE WHEN ${IS_OVERDUE} = 1 THEN 1 ELSE 0 END) AS OverdueCount
            ${IDEA_LIST_FROM}
            WHERE ${countWhere.where}
            GROUP BY i.Status;
        `),
    ]);

    return {
        items: itemsResult.recordset,
        statusCounts: countsResult.recordset,
    };
};

/**
 * True if the viewer has at least one direct report (Team Ideas access)
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
 * Filter dropdown values for a list scope:
 *   members     - (team) the viewer's direct reports
 *   departments - (all) submitter departments that have ideas
 *   leads       - (all) users who lead at least one idea
 *   purposes    - purposes used by ideas in scope (may include retired ones)
 */
const getIdeaListFilterOptions = async (db, { scope, viewerId }) => {

    const scopeWhere = buildIdeaListWhere({ scope, viewerId, filters: {} }, { includeStatus: false });
    const queries = [
        scopeWhere.bind(db.request()).query(`
            SELECT DISTINCT i.Purpose
            ${IDEA_LIST_FROM}
            WHERE ${scopeWhere.where} AND i.Purpose <> N''
            ORDER BY i.Purpose;
        `),
    ];

    if (scope === "team") {
        queries.push(db.request()
            .input("ViewerID", sql.Int, viewerId)
            .query(`
                SELECT u.UserID, ${fullName("u")} AS FullName, d.DepartmentName
                FROM dbo.Users u
                LEFT JOIN dbo.Departments d ON d.DepartmentID = u.DepartmentID
                WHERE ${DIRECT_REPORT_CONDITION("u")}
                ORDER BY u.FirstName, u.LastName;
            `));
    } else {
        queries.push(
            db.request().query(`
                SELECT DISTINCT d.DepartmentName
                FROM dbo.Ideas i
                INNER JOIN dbo.Users submitter ON submitter.UserID = i.UserID
                INNER JOIN dbo.Departments d ON d.DepartmentID = submitter.DepartmentID
                WHERE i.Status <> N'Draft'
                ORDER BY d.DepartmentName;
            `),
            db.request().query(`
                SELECT DISTINCT lead.UserID, ${fullName("lead")} AS FullName, leadDept.DepartmentName,
                       lead.FirstName, lead.LastName
                FROM dbo.Ideas i
                INNER JOIN dbo.Users lead ON lead.UserID = i.AssignedLeadID
                LEFT JOIN dbo.Departments leadDept ON leadDept.DepartmentID = lead.DepartmentID
                WHERE i.Status <> N'Draft'
                ORDER BY lead.FirstName, lead.LastName;
            `)
        );
    }

    const [purposes, ...rest] = await Promise.all(queries);
    const usedPurposes = purposes.recordset.map((row) => row.Purpose);

    if (scope === "team") {
        return { purposes: usedPurposes, members: rest[0].recordset };
    }

    return {
        purposes: usedPurposes,
        departments: rest[0].recordset.map((row) => row.DepartmentName),
        leads: rest[1].recordset.map(({ UserID, FullName, DepartmentName }) => ({ UserID, FullName, DepartmentName })),
    };
};

/**
 * ------------------------------------------------------------
 * Track Idea (every non-draft idea the viewer may see)
 * ------------------------------------------------------------
 */

// Whose action the idea is waiting on; NULL once Implemented / Rejected.
const PENDING_WITH_NAME = `
    CASE
        WHEN i.Status IN (N'Submitted', N'Active', N'In Implementation') THEN ${fullName("lead")}
        WHEN i.Status = N'Pending Final Approval' THEN ${fullName("finalApprover")}
    END
`;

const TRACK_IDEA_FROM = `
    FROM dbo.Ideas i
    INNER JOIN dbo.Users submitter
        ON submitter.UserID = i.UserID
    LEFT JOIN dbo.Users lead
        ON lead.UserID = i.AssignedLeadID
    LEFT JOIN dbo.Users finalApprover
        ON finalApprover.UserID = i.FinalApproverID
    WHERE i.Status <> N'Draft'
      AND ${CAN_VIEW_IDEA}
`;

/**
 * Search conditions for the filled-in filters (all must match). Returns
 * { where, bind } like buildIdeaListWhere.
 */
const buildTrackIdeaWhere = (filters) => {
    const conditions = [];
    const params = [];

    if (filters.ideaNumber) {
        conditions.push("UPPER(i.IdeaNumber) LIKE UPPER(@IdeaNumber)");
        params.push(["IdeaNumber", sql.NVarChar(110), likeContains(filters.ideaNumber)]);
    }

    // Any time on that calendar day; a range so an index on SubmittedDate
    // can be used.
    if (filters.submittedDate) {
        conditions.push("i.SubmittedDate >= @SubmittedOn AND i.SubmittedDate < DATEADD(DAY, 1, @SubmittedOn)");
        params.push(["SubmittedOn", sql.Date, filters.submittedDate]);
    }

    if (filters.initiatedBy) {
        conditions.push("i.UserID = @InitiatedBy");
        params.push(["InitiatedBy", sql.Int, filters.initiatedBy]);
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
 * One page of visible ideas matching every given filter, newest submission
 * first, plus the total match count.
 *
 * @param {object} options
 * @param {{ viewerId: number, viewAll: boolean }} options.viewer
 * @param {{ ideaNumber?: string, submittedDate?: string, initiatedBy?: number }} options.filters
 *   - at least one is required (checked in the service)
 * @param {number} options.page     - 1-based
 * @param {number} options.pageSize
 * @returns {Promise<{ items: object[], total: number }>}
 */
const trackIdeas = async (db, { viewer, filters, page, pageSize }) => {

    const { where: condition, bind } = buildTrackIdeaWhere(filters);
    const newRequest = () => bind(bindViewer(db.request(), viewer));

    const [itemsResult, countResult] = await Promise.all([
        newRequest()
            .input("Offset", sql.Int, (page - 1) * pageSize)
            .input("PageSize", sql.Int, pageSize)
            .query(`
                SELECT
                    i.IdeaID,
                    i.IdeaNumber,
                    i.Title,
                    i.UserID AS SubmittedByID,
                    ${fullName("submitter")} AS SubmitterName,
                    submitter.EmployeeCode AS SubmitterEmployeeCode,
                    i.SubmittedDate,
                    i.Status,
                    ${PENDING_WITH_NAME} AS PendingWithName
                ${TRACK_IDEA_FROM}
                  AND (${condition})
                ORDER BY i.SubmittedDate DESC, i.IdeaID DESC
                OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
            `),
        newRequest().query(`
            SELECT COUNT(*) AS Total
            ${TRACK_IDEA_FROM}
              AND (${condition});
        `),
    ]);

    return {
        items: itemsResult.recordset,
        total: countResult.recordset[0].Total,
    };
};

/**
 * All active users, for the Initiated By dropdown. The search itself still
 * applies CAN_VIEW_IDEA, so picking someone outside the viewer's scope just
 * finds nothing.
 */
const getTrackIdeaInitiators = async (db) => {

    const result = await db.request().query(`
        SELECT
            u.UserID,
            ${fullName("u")} AS FullName,
            u.EmployeeCode
        FROM dbo.Users u
        WHERE u.IsActive = 1
        ORDER BY u.FirstName, u.LastName;
    `);

    return result.recordset;
};

/**
 * ------------------------------------------------------------
 * Status changes (rules in IDEA_TRANSITIONS)
 * ------------------------------------------------------------
 */

// Column holding each actor's user id.
const ACTOR_COLUMNS = {
    [IdeaActor.MANAGER]: "AssignedLeadID",
    [IdeaActor.FINAL_APPROVER]: "FinalApproverID",
};

/**
 * Apply a transition. The UPDATE is guarded by the actor's column and the
 * expected current status, so it changes nothing (returns null) if either no
 * longer holds. `fromStatuses` defaults to transition.from. `remark` replaces
 * Remarks only when given. Returns the updated
 * { Status, TimelineDays, TargetDate }.
 */
const applyTransition = async (db, {
    transition,
    ideaId,
    actorId,
    fromStatuses = transition.from,
    remark,
    setClause,
    inputs = {},
}) => {

    const request = db.request()
        .input("IdeaID", sql.Int, ideaId)
        .input("ActorID", sql.Int, actorId)
        .input("ToStatus", sql.NVarChar(30), transition.to)
        .input("Remark", sql.NVarChar(1000), remark || null);

    const statusParams = fromStatuses.map((status, index) => {
        request.input(`FromStatus${index}`, sql.NVarChar(30), status);
        return `@FromStatus${index}`;
    });

    Object.entries(inputs).forEach(([name, [type, value]]) => request.input(name, type, value));

    // A null `to` (Extend Timeline) leaves the status as it is.
    const setClauses = [
        transition.to ? "Status = @ToStatus" : null,
        setClause && setClause.trim(),
        "Remarks = ISNULL(@Remark, Remarks)",
        "ModifiedDate = SYSDATETIME()",
    ].filter(Boolean);

    const result = await request.query(`
        UPDATE dbo.Ideas
        SET
            ${setClauses.join(",\n            ")}
        OUTPUT INSERTED.Status, INSERTED.TimelineDays, INSERTED.TargetDate
        WHERE IdeaID = @IdeaID
          AND ${ACTOR_COLUMNS[transition.actor]} = @ActorID
          AND Status IN (${statusParams.join(", ")});
    `);

    return result.recordset[0] || null;
};

// Submitted -> Pending Final Approval. TargetDate stays empty until the
// final approver approves (TimelineSetDate is set then).
const managerApprove = (db, { finalApproverId, timelineDays, ...options }) =>
    applyTransition(db, {
        ...options,
        inputs: {
            FinalApproverID: [sql.Int, finalApproverId],
            TimelineDays: [sql.Int, timelineDays],
        },
        setClause: `
            FinalApproverID = @FinalApproverID,
            TimelineDays = @TimelineDays,
            TimelineSetDate = NULL,
            ManagerActionDate = SYSDATETIME(),
            ReviewedBy = @ActorID,
            ReviewedDate = SYSDATETIME()
        `,
    });

// Submitted -> Rejected by the reporting manager.
const managerReject = (db, { rejectedStage, ...options }) =>
    applyTransition(db, {
        ...options,
        inputs: { RejectedStage: [sql.NVarChar(20), rejectedStage] },
        setClause: `
            RejectedStage = @RejectedStage,
            ManagerActionDate = SYSDATETIME(),
            ReviewedBy = @ActorID,
            ReviewedDate = SYSDATETIME()
        `,
    });

// Pending Final Approval -> Active. TargetDate (computed) =
// TimelineSetDate + TimelineDays = today + days.
const finalApprove = (db, options) =>
    applyTransition(db, {
        ...options,
        setClause: `
            TimelineSetDate = ${TODAY},
            FinalActionDate = SYSDATETIME(),
            ReviewedBy = @ActorID,
            ReviewedDate = SYSDATETIME()
        `,
    });

// Pending Final Approval -> Rejected by the final approver.
const finalReject = (db, { rejectedStage, ...options }) =>
    applyTransition(db, {
        ...options,
        inputs: { RejectedStage: [sql.NVarChar(20), rejectedStage] },
        setClause: `
            RejectedStage = @RejectedStage,
            FinalActionDate = SYSDATETIME(),
            ReviewedBy = @ActorID,
            ReviewedDate = SYSDATETIME()
        `,
    });

// Active -> In Implementation.
const startImplementation = (db, options) => applyTransition(db, options);

// In Implementation -> Implemented.
const markImplemented = (db, options) =>
    applyTransition(db, {
        ...options,
        setClause: "ImplementedDate = SYSDATETIME()",
    });

// Status unchanged. Adding to TimelineDays moves the computed TargetDate by
// the same number of days.
const extendTimeline = (db, { additionalDays, ...options }) =>
    applyTransition(db, {
        ...options,
        inputs: { AdditionalDays: [sql.Int, additionalDays] },
        setClause: "TimelineDays = TimelineDays + @AdditionalDays",
    });

/**
 * Full idea details with submitter / lead / final approver / reviewer names.
 * CanView says whether `viewer` ({ viewerId, viewAll }) may see it
 * (CAN_VIEW_IDEA).
 */
const getIdeaDetails = async (db, ideaId, viewer) => {

    const result = await bindViewer(db.request(), viewer)
        .input("IdeaID", sql.Int, ideaId)
        .query(`
            SELECT
                CAST(CASE WHEN ${CAN_VIEW_IDEA} THEN 1 ELSE 0 END AS BIT) AS CanView,
                i.IdeaID,
                i.IdeaNumber,
                i.UserID,
                ${fullName("submitter")} AS SubmitterName,
                submitter.EmployeeCode AS SubmitterEmployeeCode,
                submitterDept.DepartmentName AS SubmitterDepartment,
                i.Title,
                i.Description,
                i.Purpose,
                i.AssignedLeadID,
                ${fullName("lead")} AS LeadName,
                leadDept.DepartmentName AS LeadDepartment,
                i.FinalApproverID,
                ${fullName("finalApprover")} AS FinalApproverName,
                finalApproverDept.DepartmentName AS FinalApproverDepartment,
                i.TimelineDays,
                i.TimelineSetDate,
                -- Set by the final approval; the target date counts from it
                CAST(i.TimelineSetDate AS DATE) AS ActiveDate,
                i.TargetDate,
                ${IS_OVERDUE} AS IsOverdue,
                ${DAYS_REMAINING} AS DaysRemaining,
                i.Remarks,
                i.Status,
                i.ManagerActionDate,
                i.FinalActionDate,
                i.RejectedStage,
                CASE i.RejectedStage
                    WHEN N'Manager' THEN ${fullName("lead")}
                    WHEN N'Final' THEN ${fullName("finalApprover")}
                END AS RejectedByName,
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
            LEFT JOIN dbo.Users finalApprover
                ON finalApprover.UserID = i.FinalApproverID
            LEFT JOIN dbo.Departments finalApproverDept
                ON finalApproverDept.DepartmentID = finalApprover.DepartmentID
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

/**
 * Idea plus name, email and active flag of the submitter, reporting manager
 * (lead) and final approver, for idea emails
 */
const getIdeaMailData = async (db, ideaId) => {

    const result = await db.request()
        .input("IdeaID", sql.Int, ideaId)
        .query(`
            SELECT
                i.IdeaID,
                i.IdeaNumber,
                i.Title,
                i.Status,
                i.TimelineDays,
                i.TargetDate,
                i.UserID AS SubmitterID,
                ${fullName("submitter")} AS SubmitterName,
                submitter.Email AS SubmitterEmail,
                submitter.IsActive AS SubmitterIsActive,
                i.AssignedLeadID AS LeadID,
                ${fullName("lead")} AS LeadName,
                lead.Email AS LeadEmail,
                lead.IsActive AS LeadIsActive,
                i.FinalApproverID,
                ${fullName("finalApprover")} AS FinalApproverName,
                finalApprover.Email AS FinalApproverEmail,
                finalApprover.IsActive AS FinalApproverIsActive
            FROM dbo.Ideas i
            INNER JOIN dbo.Users submitter
                ON submitter.UserID = i.UserID
            LEFT JOIN dbo.Users lead
                ON lead.UserID = i.AssignedLeadID
            LEFT JOIN dbo.Users finalApprover
                ON finalApprover.UserID = i.FinalApproverID
            WHERE i.IdeaID = @IdeaID;
        `);

    return result.recordset[0] || null;
};

module.exports = {
    getLeadOptions,
    getLeadUser,
    getFinalApproverOptions,
    getActiveFinalApprover,
    getIdeaRow,
    insertDraftIdea,
    updateDraftIdea,
    deleteDraftIdea,
    markIdeaSubmitted,
    insertActivity,
    getIdeasByUser,
    getAssignedIdeas,
    IDEA_SORT_COLUMNS,
    searchIdeas,
    hasDirectReports,
    getIdeaListFilterOptions,
    trackIdeas,
    getTrackIdeaInitiators,
    ACTOR_COLUMNS,
    managerApprove,
    managerReject,
    finalApprove,
    finalReject,
    startImplementation,
    markImplemented,
    extendTimeline,
    getIdeaDetails,
    getIdeaActivity,
    getIdeaMailData,
};
