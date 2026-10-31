const { poolPromise } = require("../config/db");
const taskModel = require("../models/taskModel");
const AppError = require("../utils/AppError");
const StatusCodes = require("../constants/statusCodes");
const withTransaction = require("../utils/withTransaction");
const { getIO } = require("../sockets/io");
const { sendTaskMail } = require("./taskMailService");
const {
    TASK_PRIORITIES,
    TaskStatus,
    TASK_STATUSES,
    TaskAction,
    TaskMailEvent,
    TASK_BUSINESS_HEAD_ROLE,
    TASK_VIEW_ALL_ROLES,
    TASK_NAME_MAX_LENGTH,
    TASK_REMARKS_MAX_LENGTH,
} = require("../constants/taskConstants");

/**
 * ============================================================
 * Task Service
 * Task Tracker - access rules, validation and transactions.
 *
 * Who may do what (taskPermissions is the single rule; the frontend only
 * hides controls):
 *   Owner, self-added task (AssignedBy NULL): edit Task Name / Priority /
 *     Due Date / Status / User's Remarks, delete.
 *   Owner, assigned task: Status and User's Remarks only.
 *   Business Head: view all; CFO's Remarks on any task; Task Name /
 *     Priority / Due Date and delete on tasks they assigned.
 *   Admin: view all (read-only), like All Ideas.
 *   Reporting Manager / HOD: view direct reports' tasks (read-only).
 * Anything else is 403. Every change writes TaskActivityLog rows in the
 * same transaction.
 * ============================================================
 */

const roleOf = (user) => String(user.role || "").toUpperCase();

const isBusinessHead = (user) => roleOf(user) === TASK_BUSINESS_HEAD_ROLE;

const canViewAll = (user) => TASK_VIEW_ALL_ROLES.includes(roleOf(user));

/**
 * Parse a positive integer id, or throw 400
 */
const parseId = (value, label) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        throw new AppError(`Invalid ${label}.`, StatusCodes.BAD_REQUEST);
    }

    return id;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateKey = (value) => {
    if (!DATE_PATTERN.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const pad2 = (value) => String(value).padStart(2, "0");

// Server's local date as YYYY-MM-DD (same basis as SYSDATETIME()).
const todayKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

// SQL DATE value (a JS Date at UTC midnight) as YYYY-MM-DD.
const toDateKey = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);

const text = (value) => (typeof value === "string" ? value.trim() : "");

const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key);

/**
 * ------------------------------------------------------------
 * Permissions
 * ------------------------------------------------------------
 */

/**
 * What `user` may do with `task` (a taskModel row).
 */
const taskPermissions = (task, user) => {
    const userId = Number(user.userId);
    const isOwner = task.UserID === userId;
    const isSelfAdded = task.AssignedBy === null || task.AssignedBy === undefined;
    const businessHead = isBusinessHead(user);
    const isAssigner = businessHead && task.AssignedBy === userId;
    const isManager =
        (task.OwnerReportingManagerID === userId || task.OwnerHODID === userId) &&
        task.OwnerIsActive !== false && task.OwnerIsActive !== 0;

    const canEditDetails = (isOwner && isSelfAdded) || isAssigner;

    return {
        canView: isOwner || canViewAll(user) || isManager,
        canEditDetails,
        canEditStatus: isOwner,
        canEditUserRemarks: isOwner,
        canDelete: canEditDetails,
        canEditCFORemarks: businessHead,
    };
};

// Flags the grid uses to show or hide controls.
const withPermissions = (task, user) => {
    const permissions = taskPermissions(task, user);
    const {
        OwnerReportingManagerID, OwnerHODID, OwnerIsActive, ...row
    } = task;

    return {
        ...row,
        DueDate: toDateKey(task.DueDate),
        IsAssignedByBusinessHead: task.AssignedBy !== null && task.AssignedBy !== undefined,
        CanEditDetails: permissions.canEditDetails,
        CanEditStatus: permissions.canEditStatus,
        CanEditUserRemarks: permissions.canEditUserRemarks,
        CanDelete: permissions.canDelete,
        CanEditCFORemarks: permissions.canEditCFORemarks,
    };
};

const forbidden = (message = "You do not have permission to perform this action on this task.") =>
    new AppError(message, StatusCodes.FORBIDDEN);

/**
 * Load a task inside the transaction (locked), or throw 404 / 403 when the
 * user may not even see it.
 */
const getVisibleTask = async (db, taskId, user, lock = false) => {
    const task = await taskModel.getTask(db, taskId, lock);

    if (!task) {
        throw new AppError("Task not found.", StatusCodes.NOT_FOUND);
    }

    if (!taskPermissions(task, user).canView) {
        throw forbidden("You do not have access to this task.");
    }

    return task;
};

/**
 * ------------------------------------------------------------
 * Validation
 * ------------------------------------------------------------
 */

const validationError = (errors) => new AppError("Validation failed.", StatusCodes.BAD_REQUEST, errors);

const checkTaskName = (value, errors) => {
    const name = text(value);
    if (!name) errors.push("Task Name is required.");
    else if (name.length > TASK_NAME_MAX_LENGTH) errors.push(`Task Name cannot exceed ${TASK_NAME_MAX_LENGTH} characters.`);
    return name;
};

const checkPriority = (value, errors) => {
    const priority = text(value);
    if (!TASK_PRIORITIES.includes(priority)) errors.push(`Priority must be one of: ${TASK_PRIORITIES.join(", ")}.`);
    return priority;
};

const checkStatus = (value, errors) => {
    const status = text(value);
    if (!TASK_STATUSES.includes(status)) errors.push(`Status must be one of: ${TASK_STATUSES.join(", ")}.`);
    return status;
};

const checkDueDate = (value, errors, { notPast = false } = {}) => {
    const dueDate = text(value);
    if (!dueDate) {
        errors.push("Due Date is required.");
    } else if (!isValidDateKey(dueDate)) {
        errors.push("Due Date must be a date in YYYY-MM-DD format.");
    } else if (notPast && dueDate < todayKey()) {
        errors.push("Due Date must be today or later.");
    }
    return dueDate;
};

// Remarks: trimmed, '' -> null.
const checkRemarks = (value, label, errors) => {
    if (value !== undefined && value !== null && typeof value !== "string") {
        errors.push(`${label} must be text.`);
        return null;
    }
    const remarks = text(value);
    if (remarks.length > TASK_REMARKS_MAX_LENGTH) errors.push(`${label} cannot exceed ${TASK_REMARKS_MAX_LENGTH} characters.`);
    return remarks || null;
};

/**
 * ------------------------------------------------------------
 * Badge (unseen tasks) and access
 * ------------------------------------------------------------
 */

const getUnseenCount = async (user) => {
    const pool = await poolPromise;
    return await taskModel.countUnseenTasks(pool, user.userId);
};

/**
 * Push the user's current unseen count to their open tabs
 * ('task:unseen-count'). Never throws: the badge also refreshes on
 * navigation.
 */
const emitUnseenCount = async (userId) => {
    try {
        const io = getIO();
        if (!io) return;
        const pool = await poolPromise;
        const count = await taskModel.countUnseenTasks(pool, userId);
        io.to(`user:${userId}`).emit("task:unseen-count", { count });
    } catch (error) {
        console.error(`[SOCKET EMIT FAILED] task:unseen-count userId=${userId}:`, error);
    }
};

/**
 * What the Tasks menu shows: Team Tasks needs direct reports, All Tasks
 * Business Head / Admin, Assign Task Business Head.
 */
const getAccess = async (user) => {
    const pool = await poolPromise;
    const [hasDirectReports, unseenCount] = await Promise.all([
        taskModel.hasDirectReports(pool, user.userId),
        taskModel.countUnseenTasks(pool, user.userId),
    ]);

    return {
        isBusinessHead: isBusinessHead(user),
        canViewAll: canViewAll(user),
        hasDirectReports,
        unseenCount,
    };
};

/**
 * ------------------------------------------------------------
 * Lists
 * ------------------------------------------------------------
 */

/**
 * Validate the list query string. Blank values are ignored; invalid ones
 * throw 400 with every problem listed.
 *   status, priority, dueFrom, dueTo (YYYY-MM-DD), source (self | assigned),
 *   employeeId (team, all), department (all)
 */
const parseTaskListQuery = (query = {}, scope) => {
    const errors = [];

    const dateKey = (value, label) => {
        const key = text(value);
        if (!key) return null;
        if (!isValidDateKey(key)) {
            errors.push(`${label} must be a date in YYYY-MM-DD format.`);
            return null;
        }
        return key;
    };

    const filters = {
        status: text(query.status),
        priority: text(query.priority),
        dueFrom: dateKey(query.dueFrom, "Due date from"),
        dueTo: dateKey(query.dueTo, "Due date to"),
        source: text(query.source),
    };

    if (filters.status && !TASK_STATUSES.includes(filters.status)) {
        errors.push(`Status must be one of: ${TASK_STATUSES.join(", ")}.`);
    }

    if (filters.priority && !TASK_PRIORITIES.includes(filters.priority)) {
        errors.push(`Priority must be one of: ${TASK_PRIORITIES.join(", ")}.`);
    }

    if (filters.dueFrom && filters.dueTo && filters.dueFrom > filters.dueTo) {
        errors.push("Due date from cannot be after Due date to.");
    }

    if (filters.source && !["self", "assigned"].includes(filters.source)) {
        errors.push("Source must be self or assigned.");
    }

    if (scope !== "my") {
        const employeeId = text(String(query.employeeId ?? ""));
        if (employeeId) {
            const id = Number(employeeId);
            if (!Number.isInteger(id) || id <= 0) errors.push("Employee must be a positive whole number.");
            else filters.employeeId = id;
        }
    }

    if (scope === "all") {
        filters.department = text(query.department).slice(0, 150);
    }

    if (errors.length > 0) {
        throw new AppError("Invalid filters.", StatusCodes.BAD_REQUEST, errors);
    }

    return filters;
};

const listTasks = async (scope, user, query) => {
    const filters = parseTaskListQuery(query, scope);
    const pool = await poolPromise;
    const rows = await taskModel.listTasks(pool, { scope, viewerId: Number(user.userId), filters });

    // Visibility is the scope itself (own / direct reports / view-all role,
    // checked by the callers); the flags only say what may be changed.
    return rows.map((row) => withPermissions(row, user));
};

const assertCanViewTeamTasks = async (user) => {
    const pool = await poolPromise;
    if (!(await taskModel.hasDirectReports(pool, user.userId))) {
        throw forbidden("Team Tasks is only available to users who have team members.");
    }
};

const assertCanViewAllTasks = (user) => {
    if (!canViewAll(user)) {
        throw forbidden("All Tasks is only available to the Business Head and Admin users.");
    }
};

const assertBusinessHead = (user, message = "Only the Business Head can do this.") => {
    if (!isBusinessHead(user)) throw forbidden(message);
};

const getMyTasks = (user, query) => listTasks("my", user, query);

const getTeamTasks = async (user, query) => {
    await assertCanViewTeamTasks(user);
    return await listTasks("team", user, query);
};

const getAllTasks = async (user, query) => {
    assertCanViewAllTasks(user);
    return await listTasks("all", user, query);
};

const getTeamFilterOptions = async (user) => {
    await assertCanViewTeamTasks(user);
    const pool = await poolPromise;
    return await taskModel.getTaskFilterOptions(pool, { scope: "team", viewerId: Number(user.userId) });
};

const getAllFilterOptions = async (user) => {
    assertCanViewAllTasks(user);
    const pool = await poolPromise;
    return await taskModel.getTaskFilterOptions(pool, { scope: "all", viewerId: Number(user.userId) });
};

/**
 * Active users for the Assign Task dropdown (Business Head only)
 */
const getAssignableEmployees = async (user) => {
    assertBusinessHead(user, "Only the Business Head can assign tasks.");
    const pool = await poolPromise;
    return await taskModel.getAssignableEmployees(pool, user.userId);
};

/**
 * One task the user may see
 */
const getTaskById = async (taskIdParam, user) => {
    const taskId = parseId(taskIdParam, "task id");
    const pool = await poolPromise;
    return withPermissions(await getVisibleTask(pool, taskId, user), user);
};

/**
 * Mark the given tasks of the user as seen (My Tasks on load). Only the
 * user's own tasks change. Not an edit of the task, so no activity log row
 * and ModifiedDate is left alone.
 */
const markTasksSeen = async (user, body = {}) => {
    const rawIds = Array.isArray(body.taskIds) ? body.taskIds : [];
    const taskIds = [...new Set(rawIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 1000);

    const pool = await poolPromise;
    const updated = await taskModel.markTasksSeen(pool, user.userId, taskIds);

    if (updated > 0) emitUnseenCount(user.userId);

    return { updated, unseenCount: await taskModel.countUnseenTasks(pool, user.userId) };
};

/**
 * ------------------------------------------------------------
 * Changes
 * ------------------------------------------------------------
 */

// Values stored in the log for Created / Assigned / Deleted.
const snapshot = (task) => JSON.stringify({
    UserID: task.UserID,
    TaskName: task.TaskName,
    Priority: task.Priority,
    DueDate: toDateKey(task.DueDate) || task.DueDate,
    Status: task.Status,
    CFORemarks: task.CFORemarks ?? null,
    UserRemarks: task.UserRemarks ?? null,
    AssignedBy: task.AssignedBy ?? null,
});

const reloadTask = async (taskId, user) => {
    const pool = await poolPromise;
    const task = await taskModel.getTask(pool, taskId);
    return task ? withPermissions(task, user) : null;
};

/**
 * Add Task (self-added; the logged-in user is the owner)
 */
const createTask = async (body = {}, user) => {
    const userId = Number(user.userId);
    const errors = [];

    const input = {
        taskName: checkTaskName(body.taskName, errors),
        priority: checkPriority(body.priority, errors),
        dueDate: checkDueDate(body.dueDate, errors),
        status: has(body, "status") && text(body.status) ? checkStatus(body.status, errors) : TaskStatus.PENDING,
        userRemarks: checkRemarks(body.userRemarks, "User's Remarks", errors),
    };

    if (errors.length > 0) throw validationError(errors);

    const taskId = await withTransaction(async (transaction) => {
        const newTaskId = await taskModel.insertTask(transaction, {
            ...input,
            userId,
            assignedBy: null,
            cfoRemarks: null,
            createdBy: userId,
        });

        await taskModel.insertActivity(transaction, {
            taskId: newTaskId,
            actionBy: userId,
            action: TaskAction.CREATED,
            newValue: snapshot({
                UserID: userId,
                TaskName: input.taskName,
                Priority: input.priority,
                DueDate: input.dueDate,
                Status: input.status,
                UserRemarks: input.userRemarks,
            }),
        });

        return newTaskId;
    });

    return await reloadTask(taskId, user);
};

// { sent } from sendTaskMail -> what the Business Head sees.
const mailResult = (result) => ({
    mailSent: result.sent,
    mailWarning: result.sent
        ? null
        : `The change was saved, but the email to the employee could not be sent (${result.reason}).`,
});

/**
 * Assign Task (Business Head). Email to the employee after commit.
 */
const assignTask = async (body = {}, user) => {
    assertBusinessHead(user, "Only the Business Head can assign tasks.");

    const businessHeadId = Number(user.userId);
    const errors = [];

    const rawEmployeeId = Number(body.employeeId);
    const employeeId = Number.isInteger(rawEmployeeId) && rawEmployeeId > 0 ? rawEmployeeId : null;
    if (!employeeId) errors.push("Employee is required.");
    else if (employeeId === businessHeadId) errors.push("You cannot assign a task to yourself.");

    const input = {
        taskName: checkTaskName(body.taskName, errors),
        priority: checkPriority(body.priority, errors),
        dueDate: checkDueDate(body.dueDate, errors, { notPast: true }),
        cfoRemarks: checkRemarks(body.cfoRemarks, "CFO's Remarks", errors),
    };

    if (errors.length > 0) throw validationError(errors);

    const taskId = await withTransaction(async (transaction) => {
        if (!(await taskModel.getActiveUser(transaction, employeeId))) {
            throw validationError(["Selected employee must be an active user."]);
        }

        const newTaskId = await taskModel.insertTask(transaction, {
            ...input,
            userId: employeeId,
            status: TaskStatus.PENDING,
            userRemarks: null,
            assignedBy: businessHeadId,
            createdBy: businessHeadId,
        });

        await taskModel.insertActivity(transaction, {
            taskId: newTaskId,
            actionBy: businessHeadId,
            action: TaskAction.ASSIGNED,
            newValue: snapshot({
                UserID: employeeId,
                TaskName: input.taskName,
                Priority: input.priority,
                DueDate: input.dueDate,
                Status: TaskStatus.PENDING,
                CFORemarks: input.cfoRemarks,
                AssignedBy: businessHeadId,
            }),
        });

        return newTaskId;
    });

    // Committed. The DB change stands whatever the email does.
    const mail = await sendTaskMail(TaskMailEvent.ASSIGNED, taskId);
    emitUnseenCount(employeeId);

    return { task: await reloadTask(taskId, user), ...mailResult(mail) };
};

/**
 * Edit a task. Only the fields present in the body are considered, and
 * only the ones that actually change are checked against the user's
 * permissions (403 if any is not allowed):
 *   taskName, priority, dueDate  - canEditDetails
 *   status                       - canEditStatus
 *   userRemarks                  - canEditUserRemarks
 * CFO's Remarks have their own endpoint (submitCFORemarks).
 */
const updateTask = async (taskIdParam, body = {}, user) => {
    const taskId = parseId(taskIdParam, "task id");
    const actorId = Number(user.userId);

    if (has(body, "cfoRemarks")) {
        throw forbidden("CFO's Remarks can only be changed by the Business Head with Submit.");
    }

    await withTransaction(async (transaction) => {
        const task = await getVisibleTask(transaction, taskId, user, true);
        const permissions = taskPermissions(task, user);
        const errors = [];

        const current = {
            TaskName: task.TaskName,
            Priority: task.Priority,
            DueDate: toDateKey(task.DueDate),
            Status: task.Status,
            UserRemarks: task.UserRemarks ?? null,
        };

        const next = { ...current };
        if (has(body, "taskName")) next.TaskName = checkTaskName(body.taskName, errors);
        if (has(body, "priority")) next.Priority = checkPriority(body.priority, errors);
        if (has(body, "dueDate")) {
            // The Business Head moving an assigned task's date: today or later,
            // like Assign Task.
            const notPast = task.AssignedBy !== null && permissions.canEditDetails && text(body.dueDate) !== current.DueDate;
            next.DueDate = checkDueDate(body.dueDate, errors, { notPast });
        }
        if (has(body, "status")) next.Status = checkStatus(body.status, errors);
        if (has(body, "userRemarks")) next.UserRemarks = checkRemarks(body.userRemarks, "User's Remarks", errors);

        if (errors.length > 0) throw validationError(errors);

        const changed = Object.keys(next).filter((column) => next[column] !== current[column]);
        if (changed.length === 0) return;

        const detailColumns = changed.filter((column) => ["TaskName", "Priority", "DueDate"].includes(column));

        if (detailColumns.length > 0 && !permissions.canEditDetails) {
            throw forbidden(task.AssignedBy !== null && permissions.canEditStatus
                ? "Task Name, Priority and Due Date of a task assigned by the Business Head cannot be changed."
                : "You cannot change the Task Name, Priority or Due Date of this task.");
        }
        if (changed.includes("Status") && !permissions.canEditStatus) {
            throw forbidden("Only the task's owner can change its Status.");
        }
        if (changed.includes("UserRemarks") && !permissions.canEditUserRemarks) {
            throw forbidden("Only the task's owner can change User's Remarks.");
        }

        const values = Object.fromEntries(changed.map((column) => [column, next[column]]));
        let completedDate;
        if (changed.includes("Status")) {
            if (next.Status === TaskStatus.DONE) completedDate = "now";
            else if (current.Status === TaskStatus.DONE) completedDate = "clear";
        }

        const updated = await taskModel.updateTask(transaction, taskId, values, { completedDate });
        if (!updated) throw new AppError("Task not found.", StatusCodes.NOT_FOUND);

        if (detailColumns.length > 0) {
            await taskModel.insertActivity(transaction, {
                taskId,
                actionBy: actorId,
                action: TaskAction.UPDATED,
                oldValue: JSON.stringify(Object.fromEntries(detailColumns.map((column) => [column, current[column]]))),
                newValue: JSON.stringify(Object.fromEntries(detailColumns.map((column) => [column, next[column]]))),
            });
        }

        if (changed.includes("Status")) {
            await taskModel.insertActivity(transaction, {
                taskId,
                actionBy: actorId,
                action: TaskAction.STATUS_CHANGED,
                oldValue: current.Status,
                newValue: next.Status,
            });
        }

        if (changed.includes("UserRemarks")) {
            await taskModel.insertActivity(transaction, {
                taskId,
                actionBy: actorId,
                action: TaskAction.USER_REMARK_UPDATED,
                oldValue: current.UserRemarks,
                newValue: next.UserRemarks,
            });
        }
    });

    return await reloadTask(taskId, user);
};

/**
 * Add or change CFO's Remarks (Business Head, any task). The task shows as
 * New to its owner again; email to the employee after commit.
 */
const submitCFORemarks = async (taskIdParam, body = {}, user) => {
    const taskId = parseId(taskIdParam, "task id");
    assertBusinessHead(user, "Only the Business Head can add CFO's Remarks.");

    const actorId = Number(user.userId);
    const errors = [];
    const remarks = checkRemarks(body.cfoRemarks, "CFO's Remarks", errors);
    if (!remarks) errors.push("CFO's Remarks is required.");
    if (errors.length > 0) throw validationError(errors);

    const ownerId = await withTransaction(async (transaction) => {
        const task = await getVisibleTask(transaction, taskId, user, true);
        const previous = task.CFORemarks ?? null;

        if (previous === remarks) {
            throw new AppError("CFO's Remarks are unchanged.", StatusCodes.BAD_REQUEST);
        }

        const updated = await taskModel.updateTask(
            transaction,
            taskId,
            { CFORemarks: remarks, CFORemarksBy: actorId, IsSeenByUser: false },
            { cfoRemarksDate: true }
        );
        if (!updated) throw new AppError("Task not found.", StatusCodes.NOT_FOUND);

        await taskModel.insertActivity(transaction, {
            taskId,
            actionBy: actorId,
            action: previous ? TaskAction.CFO_REMARK_UPDATED : TaskAction.CFO_REMARK_ADDED,
            oldValue: previous,
            newValue: remarks,
        });

        return task.UserID;
    });

    // Committed. The DB change stands whatever the email does.
    const mail = await sendTaskMail(TaskMailEvent.CFO_REMARK, taskId);
    emitUnseenCount(ownerId);

    return { task: await reloadTask(taskId, user), ...mailResult(mail) };
};

/**
 * Delete (soft: IsDeleted = 1). Owner of a self-added task, or the
 * Business Head who assigned it.
 */
const deleteTask = async (taskIdParam, user) => {
    const taskId = parseId(taskIdParam, "task id");
    const actorId = Number(user.userId);

    const ownerId = await withTransaction(async (transaction) => {
        const task = await getVisibleTask(transaction, taskId, user, true);

        if (!taskPermissions(task, user).canDelete) {
            throw forbidden(task.AssignedBy !== null && task.UserID === actorId
                ? "A task assigned by the Business Head cannot be deleted."
                : "You cannot delete this task.");
        }

        const deleted = await taskModel.updateTask(transaction, taskId, {}, { softDelete: true });
        if (!deleted) throw new AppError("Task not found.", StatusCodes.NOT_FOUND);

        await taskModel.insertActivity(transaction, {
            taskId,
            actionBy: actorId,
            action: TaskAction.DELETED,
            oldValue: snapshot(task),
        });

        return task.UserID;
    });

    if (ownerId !== actorId) emitUnseenCount(ownerId);

    return { TaskID: taskId };
};

module.exports = {
    getAccess,
    getUnseenCount,
    getMyTasks,
    getTeamTasks,
    getAllTasks,
    getTeamFilterOptions,
    getAllFilterOptions,
    getAssignableEmployees,
    getTaskById,
    markTasksSeen,
    createTask,
    assignTask,
    updateTask,
    submitCFORemarks,
    deleteTask,
};
