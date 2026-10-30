const { sql, poolPromise } = require("../config/db");
const ideaModel = require("../models/ideaModel");
const AppError = require("../utils/AppError");
const StatusCodes = require("../constants/statusCodes");
const {
    IDEA_PURPOSES,
    IdeaStatus,
    IDEA_STATUSES,
    IdeaAction,
    IdeaRejectedStage,
    IDEA_TRANSITIONS,
    IDEA_TIMELINE_DAYS_MIN,
    IDEA_TIMELINE_DAYS_MAX,
    IDEA_LEAD_REMARK_MAX_LENGTH,
    IDEA_ACTIVITY_REMARK_MAX_LENGTH,
    IDEA_VIEW_ALL_ROLES,
    IDEA_TITLE_MAX_LENGTH,
    IDEA_DESCRIPTION_MAX_LENGTH,
} = require("../constants/ideaConstants");

/**
 * ============================================================
 * Idea Service
 * Ideas Module - validation, access rules and transactions.
 *
 * Status is never taken from the request: create always writes
 * Draft, submit only moves an idea that is currently Draft, and every
 * later change follows IDEA_TRANSITIONS.
 * ============================================================
 */

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

/**
 * Normalize the editable fields from a request body. Missing values become
 * '' (Title/Description/Purpose are NOT NULL in dbo.Ideas) or null (the
 * reporting manager, stored as the lead).
 */
const normalizeIdeaInput = (body = {}) => {
    const text = (value) => (typeof value === "string" ? value.trim() : "");

    const rawLeadId = body.assignedLeadId;
    const hasLead = rawLeadId !== undefined && rawLeadId !== null && rawLeadId !== "";

    return {
        title: text(body.title),
        description: text(body.description),
        purpose: text(body.purpose),
        assignedLeadId: hasLead ? Number(rawLeadId) : null,
    };
};

/**
 * Checks shared by draft save and submit. With `requireAll`, every field
 * must be filled in (submit); otherwise only the values present are
 * checked, plus a Title so the draft can be identified in My Ideas.
 */
const validateIdeaInput = async (db, idea, userId, { requireAll }) => {
    const errors = [];

    if (!idea.title) {
        errors.push("Title is required.");
    } else if (idea.title.length > IDEA_TITLE_MAX_LENGTH) {
        errors.push(`Title cannot exceed ${IDEA_TITLE_MAX_LENGTH} characters.`);
    }

    if (!idea.description) {
        if (requireAll) errors.push("Description is required.");
    } else if (idea.description.length > IDEA_DESCRIPTION_MAX_LENGTH) {
        errors.push(`Description cannot exceed ${IDEA_DESCRIPTION_MAX_LENGTH} characters.`);
    }

    if (!idea.purpose) {
        if (requireAll) errors.push("Purpose is required.");
    } else if (!IDEA_PURPOSES.includes(idea.purpose)) {
        errors.push(`Purpose must be one of: ${IDEA_PURPOSES.join(", ")}.`);
    }

    if (idea.assignedLeadId === null) {
        if (requireAll) errors.push("Reporting manager is required.");
    } else if (!Number.isInteger(idea.assignedLeadId) || idea.assignedLeadId <= 0) {
        errors.push("Invalid reporting manager.");
    } else if (idea.assignedLeadId === Number(userId)) {
        errors.push("You cannot select yourself as the reporting manager.");
    } else if (!(await ideaModel.getLeadUser(db, idea.assignedLeadId))) {
        errors.push("Selected reporting manager must be an active Manager or HOD.");
    }

    if (errors.length > 0) {
        throw new AppError("Validation failed.", StatusCodes.BAD_REQUEST, errors);
    }
};

/**
 * Run `work(transaction)` inside a transaction; rolls back on any error
 */
const withTransaction = async (work) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    await transaction.begin();

    try {
        const result = await work(transaction);
        await transaction.commit();
        return result;
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (rollbackError) {
            console.error("Idea Transaction Rollback Error:", rollbackError);
        }
        throw error;
    }
};

/**
 * Load an idea the user owns and that is still a Draft, or throw
 * 404 / 403 / 409 so the caller gets a specific reason.
 */
const getOwnDraft = async (db, ideaId, userId, lock = false) => {
    const idea = await ideaModel.getIdeaRow(db, ideaId, lock);

    if (!idea) {
        throw new AppError("Idea not found.", StatusCodes.NOT_FOUND);
    }

    if (idea.UserID !== Number(userId)) {
        throw new AppError("Only the submitter can change this idea.", StatusCodes.FORBIDDEN);
    }

    if (idea.Status !== IdeaStatus.DRAFT) {
        throw new AppError(
            `This idea is already ${idea.Status} and can no longer be changed.`,
            StatusCodes.CONFLICT
        );
    }

    return idea;
};

const canViewIdea = (idea, user) => {
    const userId = Number(user.userId);
    const role = String(user.role || "").toUpperCase();

    // Reporting manager or HOD: the same direct-report relationship Team
    // Ideas lists by.
    return (
        idea.UserID === userId ||
        idea.AssignedLeadID === userId ||
        idea.FinalApproverID === userId ||
        idea.SubmitterReportingManagerID === userId ||
        idea.SubmitterHODID === userId ||
        IDEA_VIEW_ALL_ROLES.includes(role)
    );
};

/**
 * Get Purpose List
 */
const getPurposes = () => IDEA_PURPOSES;

/**
 * Get Reporting Manager Options (active Managers and HODs except the
 * logged-in user)
 */
const getLeadOptions = async (userId) => {
    const pool = await poolPromise;
    return await ideaModel.getLeadOptions(pool, userId);
};

/**
 * Get Final Approver Options (active final approvers)
 */
const getFinalApproverOptions = async () => {
    const pool = await poolPromise;
    return await ideaModel.getFinalApproverOptions(pool);
};

/**
 * Get One Idea With Activity Log
 */
const getIdeaById = async (ideaIdParam, user) => {
    const ideaId = parseId(ideaIdParam, "idea id");
    const pool = await poolPromise;

    const idea = await ideaModel.getIdeaDetails(pool, ideaId);

    if (!idea) {
        throw new AppError("Idea not found.", StatusCodes.NOT_FOUND);
    }

    if (!canViewIdea(idea, user)) {
        throw new AppError("You do not have access to this idea.", StatusCodes.FORBIDDEN);
    }

    const activity = await ideaModel.getIdeaActivity(pool, ideaId);

    // The reporting manager / HOD ids are only needed for the access check above.
    const { SubmitterReportingManagerID, SubmitterHODID, ...details } = idea;

    const userId = Number(user.userId);
    const isSubmitter = idea.UserID === userId;
    const isLead = idea.AssignedLeadID === userId;
    const isFinalApprover = idea.FinalApproverID === userId;

    return {
        ...details,
        IsSubmitter: isSubmitter,
        IsLead: isLead,
        IsFinalApprover: isFinalApprover,
        IsPendingWithMe:
            (isLead && idea.Status === IdeaStatus.SUBMITTED) ||
            (isFinalApprover && idea.Status === IdeaStatus.PENDING_FINAL_APPROVAL),
        CanEdit: isSubmitter && idea.Status === IdeaStatus.DRAFT,
        Activity: activity,
    };
};

/**
 * Create Idea As Draft
 */
const createDraft = async (body, user) => {
    const userId = user.userId;
    const input = normalizeIdeaInput(body);
    const pool = await poolPromise;

    await validateIdeaInput(pool, input, userId, { requireAll: false });

    const ideaId = await withTransaction(async (transaction) => {
        const newIdeaId = await ideaModel.insertDraftIdea(transaction, { ...input, userId });

        await ideaModel.insertActivity(transaction, {
            ideaId: newIdeaId,
            actionBy: userId,
            action: IdeaAction.CREATED,
            fromStatus: null,
            toStatus: IdeaStatus.DRAFT,
        });

        return newIdeaId;
    });

    return await getIdeaById(ideaId, user);
};

/**
 * Update Draft
 */
const updateDraft = async (ideaIdParam, body, user) => {
    const ideaId = parseId(ideaIdParam, "idea id");
    const userId = user.userId;
    const input = normalizeIdeaInput(body);
    const pool = await poolPromise;

    await getOwnDraft(pool, ideaId, userId);
    await validateIdeaInput(pool, input, userId, { requireAll: false });

    const updated = await ideaModel.updateDraftIdea(pool, { ...input, ideaId, userId });

    // Passed the checks above but was submitted/deleted in between.
    if (!updated) {
        throw new AppError("This idea is no longer a draft and can't be changed.", StatusCodes.CONFLICT);
    }

    return await getIdeaById(ideaId, user);
};

/**
 * Delete Draft
 */
const deleteDraft = async (ideaIdParam, user) => {
    const ideaId = parseId(ideaIdParam, "idea id");
    const userId = user.userId;
    const pool = await poolPromise;

    await getOwnDraft(pool, ideaId, userId);

    const deleted = await ideaModel.deleteDraftIdea(pool, ideaId, userId);

    if (!deleted) {
        throw new AppError("This idea is no longer a draft and can't be deleted.", StatusCodes.CONFLICT);
    }

    return { IdeaID: ideaId };
};

/**
 * Submit Idea (Draft -> Submitted)
 *
 * Validates the saved draft, not the request body. The idea goes to the
 * reporting manager chosen on the form (stored as the lead). IdeaNumber is
 * a computed column on the IDENTITY IdeaID, so it's already unique.
 */
const submitIdea = async (ideaIdParam, user) => {
    const ideaId = parseId(ideaIdParam, "idea id");
    const userId = user.userId;

    await withTransaction(async (transaction) => {
        // UPDLOCK holds the row until commit, so a second concurrent submit
        // waits here and then sees Status = 'Submitted'.
        const idea = await getOwnDraft(transaction, ideaId, userId, true);

        await validateIdeaInput(
            transaction,
            {
                title: idea.Title,
                description: idea.Description,
                purpose: idea.Purpose,
                assignedLeadId: idea.AssignedLeadID,
            },
            userId,
            { requireAll: true }
        );

        const submitted = await ideaModel.markIdeaSubmitted(transaction, ideaId);

        if (!submitted) {
            throw new AppError("This idea has already been submitted.", StatusCodes.CONFLICT);
        }

        await ideaModel.insertActivity(transaction, {
            ideaId,
            actionBy: userId,
            action: IdeaAction.SUBMITTED,
            fromStatus: IdeaStatus.DRAFT,
            toStatus: IdeaStatus.SUBMITTED,
        });
    });

    return await getIdeaById(ideaId, user);
};

/**
 * ------------------------------------------------------------
 * Approval and implementation actions (rules in IDEA_TRANSITIONS)
 * ------------------------------------------------------------
 */

const pluralDays = (days) => `${days} day${days === 1 ? "" : "s"}`;

// SQL DATE value (a JS Date at UTC midnight) as DD/MM/YYYY
const formatDate = (value) => {
    if (!value) return "";
    const [year, month, day] = new Date(value).toISOString().slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
};

/**
 * Whole number of days within the allowed range, or throw 400. Accepts a
 * number or a numeric string ("30"); rejects decimals and blanks.
 */
const parseDays = (value, label) => {
    const isWholeNumber =
        (typeof value === "number" && Number.isInteger(value)) ||
        (typeof value === "string" && /^\d+$/.test(value.trim()));
    const days = Number(value);

    if (!isWholeNumber || days < IDEA_TIMELINE_DAYS_MIN || days > IDEA_TIMELINE_DAYS_MAX) {
        throw new AppError("Validation failed.", StatusCodes.BAD_REQUEST, [
            `${label} must be a whole number from ${IDEA_TIMELINE_DAYS_MIN} to ${IDEA_TIMELINE_DAYS_MAX}.`,
        ]);
    }

    return days;
};

/**
 * Trimmed remark ('' when not given), or throw 400.
 */
const parseRemark = (value, label, { required }) => {
    const remark = typeof value === "string" ? value.trim() : "";

    if (required && !remark) {
        throw new AppError("Validation failed.", StatusCodes.BAD_REQUEST, [`${label} is required.`]);
    }

    if (remark.length > IDEA_LEAD_REMARK_MAX_LENGTH) {
        throw new AppError("Validation failed.", StatusCodes.BAD_REQUEST, [
            `${label} cannot exceed ${IDEA_LEAD_REMARK_MAX_LENGTH} characters.`,
        ]);
    }

    return remark;
};

// Wrong person, wrong status, or someone acted first.
const NOT_ACTIONABLE_MESSAGE = "This idea has already been actioned or you are not the approver.";

/**
 * Shared flow for every action, in one transaction:
 *   lock the idea -> must exist (404) -> caller must be the transition's
 *   actor and the status one of its `from` (409) -> `apply` runs the guarded
 *   UPDATE (409 if it matched nothing) -> one IdeaActivityLog row.
 *
 * `apply(transaction, idea, base)` gets base = { transition, ideaId, actorId }
 * for the model call and returns { updated, logRemark }.
 */
const performTransition = async (ideaIdParam, user, transition, apply) => {
    const ideaId = parseId(ideaIdParam, "idea id");
    const actorId = Number(user.userId);

    await withTransaction(async (transaction) => {
        // UPDLOCK holds the row until commit, so two actions on the same idea
        // run one after the other and the second sees the new status.
        const idea = await ideaModel.getIdeaRow(transaction, ideaId, true);

        if (!idea) {
            throw new AppError("Idea not found.", StatusCodes.NOT_FOUND);
        }

        const actorColumn = ideaModel.ACTOR_COLUMNS[transition.actor];

        if (idea[actorColumn] !== actorId || !transition.from.includes(idea.Status)) {
            throw new AppError(NOT_ACTIONABLE_MESSAGE, StatusCodes.CONFLICT);
        }

        const { updated, logRemark } = await apply(transaction, idea, { transition, ideaId, actorId });

        if (!updated) {
            throw new AppError(NOT_ACTIONABLE_MESSAGE, StatusCodes.CONFLICT);
        }

        await ideaModel.insertActivity(transaction, {
            ideaId,
            actionBy: actorId,
            action: transition.action,
            fromStatus: idea.Status,
            toStatus: updated.Status,
            remark: logRemark ? logRemark.slice(0, IDEA_ACTIVITY_REMARK_MAX_LENGTH) : null,
        });
    });

    return await getIdeaById(ideaId, user);
};

/**
 * Manager Approve (Submitted -> Pending Final Approval). The manager picks
 * an active final approver (not themselves or the submitter) and the
 * timeline; the target date is set when the final approver approves.
 */
const managerApprove = async (ideaIdParam, body = {}, user) => {
    const finalApproverId = parseId(body.finalApproverId, "final approver");
    const timelineDays = parseDays(body.timelineDays, "Timeline days");
    const remark = parseRemark(body.remark, "Remark", { required: false });

    return await performTransition(ideaIdParam, user, IDEA_TRANSITIONS.managerApprove, async (transaction, idea, base) => {
        const errors = [];
        const approver = await ideaModel.getActiveFinalApprover(transaction, finalApproverId);

        if (!approver) {
            errors.push("Selected final approver is not an active final approver.");
        } else if (finalApproverId === base.actorId) {
            errors.push("You cannot select yourself as the final approver.");
        } else if (finalApproverId === idea.UserID) {
            errors.push("The idea's submitter cannot be its final approver.");
        }

        if (errors.length > 0) {
            throw new AppError("Validation failed.", StatusCodes.BAD_REQUEST, errors);
        }

        return {
            updated: await ideaModel.managerApprove(transaction, { ...base, finalApproverId, timelineDays, remark }),
            logRemark: `Final approver: ${approver.FullName}. Timeline: ${pluralDays(timelineDays)}.${remark ? ` ${remark}` : ""}`,
        };
    });
};

/**
 * Manager Reject (Submitted -> Rejected)
 */
const managerReject = async (ideaIdParam, body = {}, user) => {
    const remark = parseRemark(body.remark, "Remark", { required: true });

    return await performTransition(ideaIdParam, user, IDEA_TRANSITIONS.managerReject, async (transaction, idea, base) => ({
        updated: await ideaModel.managerReject(transaction, {
            ...base,
            remark,
            rejectedStage: IdeaRejectedStage.MANAGER,
        }),
        logRemark: remark,
    }));
};

/**
 * Final Approve (Pending Final Approval -> Active). Target date = today +
 * the timeline days the manager set.
 */
const finalApprove = async (ideaIdParam, body = {}, user) => {
    const remark = parseRemark(body.remark, "Remark", { required: false });

    return await performTransition(ideaIdParam, user, IDEA_TRANSITIONS.finalApprove, async (transaction, idea, base) => {
        const updated = await ideaModel.finalApprove(transaction, { ...base, remark });

        return {
            updated,
            logRemark: updated
                ? `Target date: ${formatDate(updated.TargetDate)}.${remark ? ` ${remark}` : ""}`
                : null,
        };
    });
};

/**
 * Final Reject (Pending Final Approval -> Rejected)
 */
const finalReject = async (ideaIdParam, body = {}, user) => {
    const remark = parseRemark(body.remark, "Remark", { required: true });

    return await performTransition(ideaIdParam, user, IDEA_TRANSITIONS.finalReject, async (transaction, idea, base) => ({
        updated: await ideaModel.finalReject(transaction, {
            ...base,
            remark,
            rejectedStage: IdeaRejectedStage.FINAL,
        }),
        logRemark: remark,
    }));
};

/**
 * Start Implementation (Active -> In Implementation)
 */
const startImplementation = async (ideaIdParam, body = {}, user) => {
    const remark = parseRemark(body.remark, "Remark", { required: false });

    return await performTransition(ideaIdParam, user, IDEA_TRANSITIONS.startImplementation, async (transaction, idea, base) => ({
        updated: await ideaModel.startImplementation(transaction, { ...base, remark }),
        logRemark: remark,
    }));
};

/**
 * Mark Implemented (In Implementation -> Implemented)
 */
const markImplemented = async (ideaIdParam, body = {}, user) => {
    const remark = parseRemark(body.remark, "Remark", { required: false });

    return await performTransition(ideaIdParam, user, IDEA_TRANSITIONS.markImplemented, async (transaction, idea, base) => ({
        updated: await ideaModel.markImplemented(transaction, { ...base, remark }),
        logRemark: remark,
    }));
};

/**
 * Extend Timeline (Active / In Implementation, only when overdue).
 * Status does not change.
 */
const extendTimeline = async (ideaIdParam, body = {}, user) => {
    const additionalDays = parseDays(body.additionalDays, "Additional days");
    const reason = parseRemark(body.reason, "Reason", { required: true });

    return await performTransition(ideaIdParam, user, IDEA_TRANSITIONS.extendTimeline, async (transaction, idea, base) => {
        if (!idea.IsOverdue) {
            throw new AppError(
                `The timeline can only be extended once the idea is overdue. Current target date: ${formatDate(idea.TargetDate)}.`,
                StatusCodes.CONFLICT
            );
        }

        // New target = TargetDate + additionalDays, which must be today or
        // later, i.e. additionalDays >= days the target has already passed.
        const minimumDays = idea.DaysPastTarget;

        if (additionalDays < minimumDays) {
            throw new AppError("Validation failed.", StatusCodes.BAD_REQUEST, [
                `Extending by ${pluralDays(additionalDays)} still leaves the target date in the past. ` +
                `Add at least ${pluralDays(minimumDays)} so the new target date is today or later.`,
            ]);
        }

        const updated = await ideaModel.extendTimeline(transaction, {
            ...base,
            // Only the status that was just read, so the status can't change underneath.
            fromStatuses: [idea.Status],
            additionalDays,
            remark: reason,
        });

        return {
            updated,
            logRemark: updated
                ? `Extended by ${pluralDays(additionalDays)}. New target date: ${formatDate(updated.TargetDate)}. Reason: ${reason}`
                : null,
        };
    });
};

/**
 * ------------------------------------------------------------
 * Team Ideas / All Ideas
 * ------------------------------------------------------------
 */

const IDEA_LIST_PAGE_SIZE_DEFAULT = 20;
const IDEA_LIST_PAGE_SIZE_MAX = 100;

// Statuses a list can contain (Drafts are private to the submitter).
const LIST_STATUSES = IDEA_STATUSES.filter((status) => status !== IdeaStatus.DRAFT);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateKey = (value) => {
    if (!DATE_PATTERN.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

/**
 * Validate the list query string. Unknown or blank values are ignored;
 * invalid ones throw 400 with every problem listed.
 *
 * Query: search, status, purpose, overdueOnly (true/1), submittedFrom,
 * submittedTo (YYYY-MM-DD), memberId (team), department & leadId (all),
 * sortBy, sortDir (asc/desc), page, pageSize.
 */
const parseIdeaListQuery = (query = {}, scope) => {
    const errors = [];
    const text = (value) => (typeof value === "string" ? value.trim() : "");

    const positiveInt = (value, label) => {
        if (value === undefined || value === "") return null;
        const number = Number(value);
        if (!Number.isInteger(number) || number <= 0) {
            errors.push(`${label} must be a positive whole number.`);
            return null;
        }
        return number;
    };

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
        search: text(query.search).slice(0, 200),
        status: text(query.status),
        purpose: text(query.purpose).slice(0, 100),
        overdueOnly: ["true", "1"].includes(text(query.overdueOnly).toLowerCase()),
        submittedFrom: dateKey(query.submittedFrom, "Submitted from"),
        submittedTo: dateKey(query.submittedTo, "Submitted to"),
    };

    if (filters.status && !LIST_STATUSES.includes(filters.status)) {
        errors.push(`Status must be one of: ${LIST_STATUSES.join(", ")}.`);
    }

    if (filters.submittedFrom && filters.submittedTo && filters.submittedFrom > filters.submittedTo) {
        errors.push("Submitted from cannot be after Submitted to.");
    }

    if (scope === "team") {
        filters.memberId = positiveInt(query.memberId, "Team member");
    } else {
        filters.department = text(query.department).slice(0, 150);
        filters.leadId = positiveInt(query.leadId, "Lead");
    }

    const sortBy = text(query.sortBy) || "submittedDate";
    if (!Object.prototype.hasOwnProperty.call(ideaModel.IDEA_SORT_COLUMNS, sortBy)) {
        errors.push(`Sort by must be one of: ${Object.keys(ideaModel.IDEA_SORT_COLUMNS).join(", ")}.`);
    }

    const sortDir = text(query.sortDir).toLowerCase() || "desc";
    if (!["asc", "desc"].includes(sortDir)) {
        errors.push("Sort direction must be asc or desc.");
    }

    const page = positiveInt(query.page, "Page") || 1;
    const pageSize = positiveInt(query.pageSize, "Page size") || IDEA_LIST_PAGE_SIZE_DEFAULT;
    if (pageSize > IDEA_LIST_PAGE_SIZE_MAX) {
        errors.push(`Page size cannot exceed ${IDEA_LIST_PAGE_SIZE_MAX}.`);
    }

    if (errors.length > 0) {
        throw new AppError("Invalid filters.", StatusCodes.BAD_REQUEST, errors);
    }

    return { filters, sortBy, sortDir, page, pageSize };
};

/**
 * Run a list query and shape the response:
 *   { items, total, page, pageSize, totalPages, counts }
 * counts = ideas per status (+ Overdue and Total) for the current filters
 * except status, for the count boxes.
 */
const listIdeas = async (scope, viewerId, query) => {
    const { filters, sortBy, sortDir, page, pageSize } = parseIdeaListQuery(query, scope);
    const pool = await poolPromise;

    const { items, statusCounts } = await ideaModel.searchIdeas(pool, {
        scope,
        viewerId,
        filters,
        sortBy,
        sortDir,
        page,
        pageSize,
    });

    const counts = Object.fromEntries(LIST_STATUSES.map((status) => [status, 0]));
    counts.Overdue = 0;
    counts.Total = 0;

    statusCounts.forEach((row) => {
        counts[row.Status] = row.IdeaCount;
        counts.Overdue += row.OverdueCount;
        counts.Total += row.IdeaCount;
    });

    // The counts query already applies every filter except status, so the
    // list total is that status's count (or all of them).
    const total = filters.status ? counts[filters.status] : counts.Total;

    return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        sortBy,
        sortDir,
        counts,
    };
};

const assertCanViewTeamIdeas = async (user) => {
    const pool = await poolPromise;
    if (!(await ideaModel.hasDirectReports(pool, user.userId))) {
        throw new AppError("Team Ideas is only available to users who have team members.", StatusCodes.FORBIDDEN);
    }
};

const assertCanViewAllIdeas = (user) => {
    if (!IDEA_VIEW_ALL_ROLES.includes(String(user.role || "").toUpperCase())) {
        throw new AppError("All Ideas is only available to CFO and Admin users.", StatusCodes.FORBIDDEN);
    }
};

/**
 * Get Team Ideas (ideas by the viewer's direct reports)
 */
const getTeamIdeas = async (user, query) => {
    await assertCanViewTeamIdeas(user);
    return await listIdeas("team", Number(user.userId), query);
};

const getTeamIdeaFilterOptions = async (user) => {
    await assertCanViewTeamIdeas(user);
    const pool = await poolPromise;
    return await ideaModel.getIdeaListFilterOptions(pool, { scope: "team", viewerId: Number(user.userId) });
};

/**
 * Get All Ideas (CFO / Admin)
 */
const getAllIdeas = async (user, query) => {
    assertCanViewAllIdeas(user);
    return await listIdeas("all", Number(user.userId), query);
};

const getAllIdeaFilterOptions = async (user) => {
    assertCanViewAllIdeas(user);
    const pool = await poolPromise;
    return await ideaModel.getIdeaListFilterOptions(pool, { scope: "all", viewerId: Number(user.userId) });
};

/**
 * Get Ideas Assigned To Me (logged-in user is the reporting manager or the
 * final approver). IsPendingWithMe ideas come first.
 */
const getAssignedIdeas = async (user) => {
    const pool = await poolPromise;
    return await ideaModel.getAssignedIdeas(pool, user.userId);
};

/**
 * Get Logged-in User's Ideas
 */
const getMyIdeas = async (user, status) => {
    if (status && !IDEA_STATUSES.includes(status)) {
        throw new AppError(
            `Status must be one of: ${IDEA_STATUSES.join(", ")}.`,
            StatusCodes.BAD_REQUEST
        );
    }

    const pool = await poolPromise;
    return await ideaModel.getIdeasByUser(pool, user.userId, status);
};

module.exports = {
    getPurposes,
    getLeadOptions,
    getFinalApproverOptions,
    getIdeaById,
    createDraft,
    updateDraft,
    deleteDraft,
    submitIdea,
    getMyIdeas,
    getAssignedIdeas,
    getTeamIdeas,
    getTeamIdeaFilterOptions,
    getAllIdeas,
    getAllIdeaFilterOptions,
    managerApprove,
    managerReject,
    finalApprove,
    finalReject,
    startImplementation,
    markImplemented,
    extendTimeline,
};
