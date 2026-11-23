const { poolPromise } = require("../config/db");
const taskModel = require("../models/taskModel");
const projectModel = require("../models/projectModel");
const AppError = require("../utils/AppError");
const StatusCodes = require("../constants/statusCodes");
const withTransaction = require("../utils/withTransaction");
const { sendTaskMail } = require("./taskMailService");
const taskService = require("./taskService");
const {
    TaskAction,
    TaskMailEvent,
    TASK_BUSINESS_HEAD_ROLE,
    PROJECT_NAME_MAX_LENGTH,
    PROJECT_DESCRIPTION_MAX_LENGTH,
} = require("../constants/taskConstants");

const {
    isBusinessHead,
    canViewAll,
    canCreateProjects,
    parseId,
    text,
    has,
    toDateKey,
    forbidden,
    validationError,
    withPermissions,
    checkTaskName,
    checkPriority,
    checkDueDate,
    checkAssignInput,
    insertAssignedTask,
    snapshot,
    mailResult,
    emitUnseenCount,
} = taskService.helpers;

/**
 * ============================================================
 * Project Service
 * Task Tracker > Projects - projects, members and project tasks.
 *
 * Who may do what ("runs" = canManageProject):
 *   Business Head: creates projects and runs the ones a Business Head
 *     created (rename, add / remove any active user as member, assign tasks
 *     to one member). Sees every project, Managers' too,
 *     with every task, and adds remarks on any task.
 *   Project creator (anyone Admin put on dbo.ProjectCreators): creates
 *     projects and runs only their own; like the Business Head, any active
 *     user can be added as a member. Sees the projects they
 *     created (every task, "Manager / CFO Remarks" on them) and any project
 *     they are a member of. Taken off the list = no longer runs them.
 *   Admin: sees every project and its tasks (read-only), like All Tasks.
 *   Member (active): sees the project and their own tasks in it, and adds
 *     their own tasks like personal ones.
 * Project tasks are ordinary dbo.Tasks rows, so editing, status, remarks,
 * delete and emails go through taskService with the same rules.
 *
 * "All members" (no longer offered for new tasks): older tasks assigned
 * as one copy per active member, all with the same AssignmentGroupID. The
 * group's Task Name / Priority / Due Date are changed
 * (and the group deleted) here, for every copy at once, by whoever
 * assigned it.
 * ============================================================
 */

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseGroupId = (value) => {
    const id = text(String(value ?? ""));
    if (!GUID_PATTERN.test(id)) {
        throw new AppError("Invalid assignment group id.", StatusCodes.BAD_REQUEST);
    }
    return id;
};

const notFound = () => new AppError("Project not found.", StatusCodes.NOT_FOUND);

/**
 * True if the user runs the project: whoever created it (while they can
 * still create projects), or any Business Head for projects a Business
 * Head created.
 */
const canManageProject = (project, user) => {
    if (!canCreateProjects(user)) return false;
    if (project.CreatedBy === Number(user.userId)) return true;
    return isBusinessHead(user) && String(project.CreatedByRole || "").toUpperCase() === TASK_BUSINESS_HEAD_ROLE;
};

const assertCanCreate = (user) => {
    if (!canCreateProjects(user)) throw forbidden("Only the CFO or people allowed by Admin can create projects.");
};

/**
 * The project (locked when `lock`), or 404; 403 unless the user runs it.
 */
const getManagedProject = async (db, projectId, user, lock = false) => {
    const project = await projectModel.getProject(db, projectId, lock);
    if (!project) throw notFound();
    if (!canManageProject(project, user)) {
        throw forbidden("Only the creator of this project can change it, its members or assign tasks in it.");
    }
    return project;
};

// Positive integer ids from an array, de-duplicated.
const idList = (value) =>
    [...new Set((Array.isArray(value) ? value : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];

const checkProjectInput = (body, errors) => {
    const projectName = text(body.projectName);
    if (!projectName) errors.push("Project Name is required.");
    else if (projectName.length > PROJECT_NAME_MAX_LENGTH) {
        errors.push(`Project Name cannot exceed ${PROJECT_NAME_MAX_LENGTH} characters.`);
    }

    if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
        errors.push("Description must be text.");
    }
    const description = text(body.description);
    if (description.length > PROJECT_DESCRIPTION_MAX_LENGTH) {
        errors.push(`Description cannot exceed ${PROJECT_DESCRIPTION_MAX_LENGTH} characters.`);
    }

    return { projectName, description: description || null };
};

/**
 * The project, or 404; 403 unless the user is a view-all role, its creator
 * or an active member. Returns { project, isMember, seesAllTasks }.
 */
const getViewableProject = async (db, projectId, user) => {
    const project = await projectModel.getProject(db, projectId);
    if (!project) throw notFound();

    const isCreator = project.CreatedBy === Number(user.userId);
    const isMember = await projectModel.isActiveMember(db, projectId, Number(user.userId));
    if (!isMember && !isCreator && !canViewAll(user)) {
        throw forbidden("You are not a member of this project.");
    }

    return { project, isMember, seesAllTasks: canViewAll(user) || isCreator };
};

/**
 * Members picked for a project: active users other than the creator
 * themselves. Throws 400.
 */
const checkMemberPicks = async (db, userIds, user) => {
    const actorId = Number(user.userId);
    if (userIds.includes(actorId)) {
        throw validationError(["You cannot add yourself as a project member."]);
    }

    const users = await projectModel.getUsers(db, userIds);
    if (users.length !== userIds.length || users.some((u) => !u.IsActive)) {
        throw validationError(["Every selected member must be an active user."]);
    }
};

/**
 * ------------------------------------------------------------
 * Projects and members
 * ------------------------------------------------------------
 */

/**
 * Business Head / Admin: every active project (counts over all tasks).
 * Others: projects they created (counts over all tasks) or are an active
 * member of (counts over their own tasks).
 */
const getProjects = async (user) => {
    const pool = await poolPromise;
    const viewAll = canViewAll(user);
    const userId = Number(user.userId);

    const rows = await projectModel.listProjects(pool, { viewerId: viewAll ? null : userId });

    return {
        canCreate: canCreateProjects(user),
        projects: rows.map((project) => ({
            ...project,
            CanManage: canManageProject(project, user),
            SeesAllTasks: viewAll || project.CreatedBy === userId,
        })),
    };
};

/**
 * One project: details, active members and the tasks the user may see on
 * the project page (view-all roles and the creator: every task, including
 * those of removed members; a member: their own).
 */
const getProjectDetails = async (projectIdParam, user) => {
    const projectId = parseId(projectIdParam, "project id");
    const pool = await poolPromise;
    const { project, isMember, seesAllTasks } = await getViewableProject(pool, projectId, user);

    const [members, tasks] = await Promise.all([
        projectModel.listMembers(pool, projectId),
        taskModel.listProjectTasks(pool, projectId, { ownerId: seesAllTasks ? null : Number(user.userId) }),
    ]);

    return {
        project,
        members,
        tasks: tasks.map((task) => withPermissions(task, user)),
        canManage: canManageProject(project, user),
        seesAllTasks,
        canAddOwnTasks: isMember,
    };
};

/**
 * Users that can be added as members: every active user but themselves.
 */
const getMemberOptions = async (user) => {
    assertCanCreate(user);
    const pool = await poolPromise;
    return await taskModel.getAssignableEmployees(pool, user.userId);
};

/**
 * Create a project (Business Head or Manager), optionally with its first
 * members.
 */
const createProject = async (body = {}, user) => {
    assertCanCreate(user);

    const creatorId = Number(user.userId);
    const errors = [];
    const input = checkProjectInput(body, errors);
    const memberIds = idList(body.memberIds);

    if (errors.length > 0) throw validationError(errors);

    const projectId = await withTransaction(async (transaction) => {
        if (await projectModel.projectNameExists(transaction, input.projectName)) {
            throw validationError(["A project with this name already exists."]);
        }

        await checkMemberPicks(transaction, memberIds, user);

        const newProjectId = await projectModel.insertProject(transaction, { ...input, createdBy: creatorId });

        for (const memberId of memberIds) {
            await projectModel.addMember(transaction, newProjectId, memberId, creatorId);
        }

        return newProjectId;
    });

    return await getProjectDetails(projectId, user);
};

/**
 * Rename / change the description of a project (whoever runs it).
 */
const updateProject = async (projectIdParam, body = {}, user) => {
    const projectId = parseId(projectIdParam, "project id");

    const errors = [];
    const input = checkProjectInput(body, errors);
    if (errors.length > 0) throw validationError(errors);

    await withTransaction(async (transaction) => {
        await getManagedProject(transaction, projectId, user, true);

        if (await projectModel.projectNameExists(transaction, input.projectName, projectId)) {
            throw validationError(["A project with this name already exists."]);
        }

        await projectModel.updateProject(transaction, projectId, input);
    });

    return await getProjectDetails(projectId, user);
};

/**
 * Add members (whoever runs the project). A
 * user removed earlier is reactivated on their existing row. They get only
 * tasks assigned from now on.
 */
const addMembers = async (projectIdParam, body = {}, user) => {
    const projectId = parseId(projectIdParam, "project id");

    const actorId = Number(user.userId);
    const userIds = idList(body.userIds);
    if (userIds.length === 0) throw validationError(["Select at least one member to add."]);

    const outcomes = await withTransaction(async (transaction) => {
        await getManagedProject(transaction, projectId, user, true);

        await checkMemberPicks(transaction, userIds, user);

        const counts = { added: 0, reactivated: 0, already: 0 };
        for (const userId of userIds) {
            counts[await projectModel.addMember(transaction, projectId, userId, actorId)] += 1;
        }
        return counts;
    });

    return { ...outcomes, ...(await getProjectDetails(projectId, user)) };
};

/**
 * Remove a member (whoever runs the project). Their tasks stay as they are
 * and stay visible on the project page to whoever sees all its tasks.
 */
const removeMember = async (projectIdParam, userIdParam, user) => {
    const projectId = parseId(projectIdParam, "project id");
    const memberId = parseId(userIdParam, "user id");

    await withTransaction(async (transaction) => {
        await getManagedProject(transaction, projectId, user, true);

        if (!(await projectModel.removeMember(transaction, projectId, memberId))) {
            throw new AppError("This user is not a member of the project.", StatusCodes.NOT_FOUND);
        }
    });

    return await getProjectDetails(projectId, user);
};

/**
 * ------------------------------------------------------------
 * Project tasks
 * ------------------------------------------------------------
 */

/**
 * A member adds their own task to the project (same as Add Task).
 */
const createProjectTask = async (projectIdParam, body = {}, user) => {
    const projectId = parseId(projectIdParam, "project id");
    const pool = await poolPromise;
    if (!(await projectModel.getProject(pool, projectId))) throw notFound();

    return await taskService.createTask(body, user, { projectId });
};

/**
 * Assign a project task to one member (whoever runs the project: the
 * Business Head, or the Manager who created it). body.assignTo = the
 * member's UserID; they are also the Responsible Person
 * (body.responsiblePersonId is ignored). Assigning to all members is no
 * longer offered; older "All members" tasks are still edited / deleted
 * below. The assignee is emailed after commit.
 */
const assignProjectTask = async (projectIdParam, body = {}, user) => {
    const projectId = parseId(projectIdParam, "project id");
    assertCanCreate(user);

    const assignerId = Number(user.userId);
    const errors = [];

    let assigneeId = null;
    const id = Number(body.assignTo);
    if (body.assignTo === null || body.assignTo === undefined || body.assignTo === "" || !Number.isInteger(id) || id <= 0) {
        errors.push("Assigned To is required: pick a member.");
    } else if (id === assignerId) {
        errors.push("You cannot assign a task to yourself.");
    } else {
        assigneeId = id;
    }

    const input = checkAssignInput(body, errors);

    if (errors.length > 0) throw validationError(errors);

    const created = await withTransaction(async (transaction) => {
        // Locks the project so the member list can't change mid-assignment.
        await getManagedProject(transaction, projectId, user, true);

        const members = await projectModel.listMembers(transaction, projectId);
        const member = members.find((m) => m.UserIsActive && m.UserID === assigneeId);
        if (!member) throw validationError(["Assigned To must be an active member of the project."]);

        const taskId = await insertAssignedTask(transaction, {
            employeeId: member.UserID,
            input,
            businessHeadId: assignerId,
            project: { projectId, responsiblePersonId: assigneeId, assignmentGroupId: null },
        });
        return { taskId, userId: member.UserID };
    });

    // Committed. The DB change stands whatever the email does.
    const mail = await sendTaskMail(TaskMailEvent.ASSIGNED, created.taskId);
    emitUnseenCount(created.userId);

    return { assignedCount: 1, ...mailResult(mail) };
};

/**
 * The copies of a group in this project, locked, after checking the user
 * assigned them. 404 if there are none.
 */
const getOwnGroup = async (transaction, projectId, groupId, user) => {
    const copies = await taskModel.getGroupTasks(transaction, groupId, true);

    if (copies.length === 0 || copies[0].ProjectID !== projectId) {
        throw new AppError("Task not found.", StatusCodes.NOT_FOUND);
    }
    if (copies[0].AssignedBy !== Number(user.userId)) {
        throw forbidden("Only the person who assigned this task can change it.");
    }

    return copies;
};

/**
 * Change an "All members" task for every copy at once (whoever assigned
 * it): taskName, priority, dueDate. Status and remarks
 * stay per member.
 */
const updateGroup = async (projectIdParam, groupIdParam, body = {}, user) => {
    const projectId = parseId(projectIdParam, "project id");
    const groupId = parseGroupId(groupIdParam);
    const actorId = Number(user.userId);

    await withTransaction(async (transaction) => {
        const copies = await getOwnGroup(transaction, projectId, groupId, user);
        const first = copies[0];
        const errors = [];

        const current = {
            TaskName: first.TaskName,
            Priority: first.Priority,
            DueDate: toDateKey(first.DueDate),
        };

        const next = { ...current };
        if (has(body, "taskName")) next.TaskName = checkTaskName(body.taskName, errors);
        if (has(body, "priority")) next.Priority = checkPriority(body.priority, errors);
        if (has(body, "dueDate")) {
            next.DueDate = checkDueDate(body.dueDate, errors, { notPast: text(body.dueDate) !== current.DueDate });
        }
        if (errors.length > 0) throw validationError(errors);

        const changed = Object.keys(next).filter((column) => next[column] !== current[column]);
        if (changed.length === 0) return;

        const values = Object.fromEntries(changed.map((column) => [column, next[column]]));
        const oldValue = JSON.stringify(Object.fromEntries(changed.map((column) => [column, current[column]])));
        const newValue = JSON.stringify(values);

        for (const copy of copies) {
            await taskModel.updateTask(transaction, copy.TaskID, values);
            await taskModel.insertActivity(transaction, {
                taskId: copy.TaskID,
                actionBy: actorId,
                action: TaskAction.UPDATED,
                oldValue,
                newValue,
            });
        }
    });

    const pool = await poolPromise;
    const copies = await taskModel.getGroupTasks(pool, groupId);
    return copies.map((task) => withPermissions(task, user));
};

/**
 * Delete every copy of an "All members" task (soft delete, whoever
 * assigned it). A single member's copy is deleted with the normal Delete
 * on that row.
 */
const deleteGroup = async (projectIdParam, groupIdParam, user) => {
    const projectId = parseId(projectIdParam, "project id");
    const groupId = parseGroupId(groupIdParam);
    const actorId = Number(user.userId);

    const ownerIds = await withTransaction(async (transaction) => {
        const copies = await getOwnGroup(transaction, projectId, groupId, user);

        for (const copy of copies) {
            await taskModel.updateTask(transaction, copy.TaskID, {}, { softDelete: true });
            await taskModel.insertActivity(transaction, {
                taskId: copy.TaskID,
                actionBy: actorId,
                action: TaskAction.DELETED,
                oldValue: snapshot(copy),
            });
        }

        return copies.map((copy) => copy.UserID);
    });

    ownerIds.forEach((ownerId) => emitUnseenCount(ownerId));

    return { AssignmentGroupID: groupId, deletedCount: ownerIds.length };
};

/**
 * ------------------------------------------------------------
 * Project creators (Admin settings; the route allows Admin only)
 * ------------------------------------------------------------
 */

/**
 * Everyone on the list and the active users who can be added.
 */
const getCreatorSettings = async () => {
    const pool = await poolPromise;
    const [creators, candidates] = await Promise.all([
        projectModel.listProjectCreators(pool),
        projectModel.listProjectCreatorCandidates(pool),
    ]);
    return { creators, candidates };
};

const addCreator = async (body = {}) => {
    const userId = parseId(body.userId, "user");
    const pool = await poolPromise;

    if (!(await projectModel.addProjectCreator(pool, userId))) {
        throw new AppError("Selected user was not found or is inactive.", StatusCodes.BAD_REQUEST);
    }

    return await getCreatorSettings();
};

/**
 * Take someone off the list. They can no longer create projects or run the
 * ones they created; those projects and their tasks stay as they are.
 */
const removeCreator = async (userIdParam) => {
    const userId = parseId(userIdParam, "user");
    const pool = await poolPromise;

    if (!(await projectModel.removeProjectCreator(pool, userId))) {
        throw new AppError("This user is not on the project creator list.", StatusCodes.NOT_FOUND);
    }

    return await getCreatorSettings();
};

module.exports = {
    getCreatorSettings,
    addCreator,
    removeCreator,
    getProjects,
    getProjectDetails,
    getMemberOptions,
    createProject,
    updateProject,
    addMembers,
    removeMember,
    createProjectTask,
    assignProjectTask,
    updateGroup,
    deleteGroup,
};
