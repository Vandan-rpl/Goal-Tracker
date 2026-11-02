const crypto = require("crypto");
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
    TASK_MANAGER_ROLE,
    PROJECT_NAME_MAX_LENGTH,
    PROJECT_DESCRIPTION_MAX_LENGTH,
    PROJECT_ASSIGN_ALL,
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
    checkResponsiblePerson,
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
 *     to one member or all members). Sees every project, Managers' too,
 *     with every task, and adds remarks on any task.
 *   Manager: creates projects and runs only their own; members are limited
 *     to their reportees (Users.ReportingManagerID = the Manager). Sees the
 *     projects they created (every task, "Manager / CFO Remarks" on them)
 *     and any project they are a member of.
 *   Admin: sees every project and its tasks (read-only), like All Tasks.
 *   Member (active): sees the project and their own tasks in it, and adds
 *     their own tasks like personal ones.
 * Project tasks are ordinary dbo.Tasks rows, so editing, status, remarks,
 * delete and emails go through taskService with the same rules.
 *
 * "All members": one copy per current active member, all with the same
 * AssignmentGroupID. Members added later do not get earlier copies. The
 * group's Task Name / Priority / Due Date / Responsible Person are changed
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

// A project creator who is not the Business Head.
const isManagerRole = (user) => canCreateProjects(user) && !isBusinessHead(user);

/**
 * True if the user runs the project: the Manager who created it, or the
 * Business Head for projects not created by a Manager.
 */
const canManageProject = (project, user) => {
    if (!canCreateProjects(user)) return false;
    if (project.CreatedBy === Number(user.userId)) return true;
    return isBusinessHead(user) && String(project.CreatedByRole || "").toUpperCase() !== TASK_MANAGER_ROLE;
};

const assertCanCreate = (user) => {
    if (!canCreateProjects(user)) throw forbidden("Only the Business Head or a Manager can create projects.");
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
 * themselves; for a Manager, only their reportees. Throws 400.
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
    if (isManagerRole(user) && users.some((u) => u.ReportingManagerID !== actorId)) {
        throw validationError(["You can add only your own reportees as members."]);
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
 * Users that can be added as members: for the Business Head every active
 * user but themselves, for a Manager their active reportees.
 */
const getMemberOptions = async (user) => {
    assertCanCreate(user);
    const pool = await poolPromise;
    return isManagerRole(user)
        ? await projectModel.listReportees(pool, Number(user.userId))
        : await taskModel.getAssignableEmployees(pool, user.userId);
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
 * Add members (whoever runs the project; a Manager only their reportees). A
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
 * Remove a member (whoever runs the project; a Manager only their
 * reportees). Their tasks stay as they are and stay visible on the project
 * page to whoever sees all its tasks.
 */
const removeMember = async (projectIdParam, userIdParam, user) => {
    const projectId = parseId(projectIdParam, "project id");
    const memberId = parseId(userIdParam, "user id");

    await withTransaction(async (transaction) => {
        await getManagedProject(transaction, projectId, user, true);

        if (isManagerRole(user)) {
            const [member] = await projectModel.getUsers(transaction, [memberId]);
            if (!member || member.ReportingManagerID !== Number(user.userId)) {
                throw forbidden("You can remove only your own reportees.");
            }
        }

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

// Several { sent, reason } results -> what the assigner sees.
const groupMailResult = (results) => {
    const failed = results.filter(({ mail }) => !mail.sent);
    if (failed.length === 0) return { mailSent: true, mailWarning: null };
    if (results.length === 1) return mailResult(results[0].mail);

    return {
        mailSent: false,
        mailWarning: `The tasks were saved, but the email could not be sent to ${failed.length} of ${results.length} members: ${failed.map(({ name, mail }) => `${name} (${mail.reason})`).join(", ")}.`,
    };
};

/**
 * Assign a project task (whoever runs the project: the Business Head, or
 * the Manager who created it).
 *   body.assignTo = a member's UserID - one task for that member
 *   body.assignTo = "all"             - one copy per current active member,
 *                                       linked by a new AssignmentGroupID
 * body.responsiblePersonId must be an active member. Each assignee is
 * emailed after commit.
 */
const assignProjectTask = async (projectIdParam, body = {}, user) => {
    const projectId = parseId(projectIdParam, "project id");
    assertCanCreate(user);

    const assignerId = Number(user.userId);
    const errors = [];

    const assignToAll = text(String(body.assignTo ?? "")).toLowerCase() === PROJECT_ASSIGN_ALL;
    let assigneeId = null;
    if (!assignToAll) {
        const id = Number(body.assignTo);
        if (body.assignTo === null || body.assignTo === undefined || body.assignTo === "" || !Number.isInteger(id) || id <= 0) {
            errors.push("Assigned To is required: pick a member or All members.");
        } else if (id === assignerId) {
            errors.push("You cannot assign a task to yourself.");
        } else {
            assigneeId = id;
        }
    }

    const responsiblePersonId = checkResponsiblePerson(body.responsiblePersonId, errors);
    const input = checkAssignInput(body, errors);

    if (errors.length > 0) throw validationError(errors);

    const created = await withTransaction(async (transaction) => {
        // Locks the project so the member list can't change mid-assignment.
        await getManagedProject(transaction, projectId, user, true);

        const members = await projectModel.listMembers(transaction, projectId);
        const activeMembers = members.filter((m) => m.UserIsActive && m.UserID !== assignerId);

        if (!members.some((m) => m.UserID === responsiblePersonId && m.UserIsActive)) {
            throw validationError(["Responsible Person must be an active member of the project."]);
        }

        let assignees;
        if (assignToAll) {
            assignees = activeMembers;
            if (assignees.length === 0) throw validationError(["This project has no active members to assign to."]);
        } else {
            const member = activeMembers.find((m) => m.UserID === assigneeId);
            if (!member) throw validationError(["Assigned To must be an active member of the project."]);
            assignees = [member];
        }

        const project = {
            projectId,
            responsiblePersonId,
            assignmentGroupId: assignToAll ? crypto.randomUUID() : null,
        };

        const rows = [];
        for (const member of assignees) {
            const taskId = await insertAssignedTask(transaction, {
                employeeId: member.UserID, input, businessHeadId: assignerId, project,
            });
            rows.push({ taskId, userId: member.UserID, name: member.FullName });
        }
        return { rows, assignmentGroupId: project.assignmentGroupId };
    });

    // Committed. The DB change stands whatever the emails do.
    const mails = [];
    for (const row of created.rows) {
        mails.push({ name: row.name, mail: await sendTaskMail(TaskMailEvent.ASSIGNED, row.taskId) });
        emitUnseenCount(row.userId);
    }

    return {
        assignmentGroupId: created.assignmentGroupId,
        assignedCount: created.rows.length,
        ...groupMailResult(mails),
    };
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
 * it): taskName, priority, dueDate, responsiblePersonId. Status and remarks
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
            ResponsiblePersonID: first.ResponsiblePersonID ?? null,
        };

        const next = { ...current };
        if (has(body, "taskName")) next.TaskName = checkTaskName(body.taskName, errors);
        if (has(body, "priority")) next.Priority = checkPriority(body.priority, errors);
        if (has(body, "dueDate")) {
            next.DueDate = checkDueDate(body.dueDate, errors, { notPast: text(body.dueDate) !== current.DueDate });
        }
        if (has(body, "responsiblePersonId")) {
            next.ResponsiblePersonID = checkResponsiblePerson(body.responsiblePersonId, errors);
        }

        if (errors.length > 0) throw validationError(errors);

        const changed = Object.keys(next).filter((column) => next[column] !== current[column]);
        if (changed.length === 0) return;

        if (changed.includes("ResponsiblePersonID") &&
            !(await projectModel.isActiveMember(transaction, projectId, next.ResponsiblePersonID))) {
            throw validationError(["Responsible Person must be a member of the project."]);
        }

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

module.exports = {
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
