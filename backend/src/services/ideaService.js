const { sql, poolPromise } = require("../config/db");
const ideaModel = require("../models/ideaModel");
const AppError = require("../utils/AppError");
const StatusCodes = require("../constants/statusCodes");
const {
    IDEA_PURPOSES,
    IdeaStatus,
    IDEA_STATUSES,
    IdeaAction,
    IDEA_TIMELINE_DAYS_MIN,
    IDEA_TIMELINE_DAYS_MAX,
    IDEA_LEAD_REMARK_MAX_LENGTH,
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
 * Draft, and submit only moves an idea that is currently Draft.
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
 * '' (Title/Description/Purpose are NOT NULL in dbo.Ideas) or null (lead).
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
        if (requireAll) errors.push("Lead is required.");
    } else if (!Number.isInteger(idea.assignedLeadId) || idea.assignedLeadId <= 0) {
        errors.push("Invalid lead.");
    } else if (idea.assignedLeadId === Number(userId)) {
        errors.push("You cannot assign yourself as the lead.");
    } else if (!(await ideaModel.getLeadUser(db, idea.assignedLeadId))) {
        errors.push("Selected lead must be an active Manager or HOD.");
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
 * Get Lead Options (active Managers and HODs except the logged-in user)
 */
const getLeadOptions = async (userId) => {
    const pool = await poolPromise;
    return await ideaModel.getLeadOptions(pool, userId);
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

    const isSubmitter = idea.UserID === Number(user.userId);

    return {
        ...details,
        IsSubmitter: isSubmitter,
        IsLead: idea.AssignedLeadID === Number(user.userId),
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
 * Validates the saved draft, not the request body. IdeaNumber is a
 * computed column on the IDENTITY IdeaID, so it's already unique.
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
 * Lead actions
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

/**
 * Shared flow for every lead action, in one transaction:
 *   lock the idea -> must exist (404) -> caller must be its lead (403)
 *   -> status must allow the action (409) -> `apply` updates the idea
 *   -> one IdeaActivityLog row.
 *
 * `apply(transaction, idea)` returns { updated, logRemark }, where
 * `updated` is the model's result (null if the guarded UPDATE matched nothing).
 */
const performLeadAction = async (ideaIdParam, user, { allowedStatuses, statusError, action, apply }) => {
    const ideaId = parseId(ideaIdParam, "idea id");
    const leadId = Number(user.userId);

    await withTransaction(async (transaction) => {
        // UPDLOCK holds the row until commit, so two actions on the same idea
        // run one after the other and the second sees the new status.
        const idea = await ideaModel.getIdeaRow(transaction, ideaId, true);

        if (!idea) {
            throw new AppError("Idea not found.", StatusCodes.NOT_FOUND);
        }

        if (idea.AssignedLeadID !== leadId) {
            throw new AppError("Only the idea's lead can perform this action.", StatusCodes.FORBIDDEN);
        }

        if (!allowedStatuses.includes(idea.Status)) {
            throw new AppError(`${statusError} This idea is ${idea.Status}.`, StatusCodes.CONFLICT);
        }

        const { updated, logRemark } = await apply(transaction, idea, leadId);

        if (!updated) {
            throw new AppError("This idea was just changed. Refresh and try again.", StatusCodes.CONFLICT);
        }

        await ideaModel.insertActivity(transaction, {
            ideaId,
            actionBy: leadId,
            action,
            fromStatus: idea.Status,
            toStatus: updated.Status,
            remark: logRemark,
        });
    });

    return await getIdeaById(ideaId, user);
};

/**
 * Accept Idea (Submitted -> Accepted)
 */
const acceptIdea = async (ideaIdParam, body = {}, user) => {
    const timelineDays = parseDays(body.timelineDays, "Timeline days");
    const remark = parseRemark(body.remark, "Remark", { required: false });

    return await performLeadAction(ideaIdParam, user, {
        allowedStatuses: [IdeaStatus.SUBMITTED],
        statusError: "Only Submitted ideas can be accepted.",
        action: IdeaAction.ACCEPTED,
        apply: async (transaction, idea, leadId) => ({
            updated: await ideaModel.acceptIdea(transaction, {
                ideaId: idea.IdeaID,
                leadId,
                timelineDays,
                remark,
            }),
            logRemark: `Timeline: ${pluralDays(timelineDays)}.${remark ? ` ${remark}` : ""}`,
        }),
    });
};

/**
 * Reject Idea (Submitted -> Rejected)
 */
const rejectIdea = async (ideaIdParam, body = {}, user) => {
    const remark = parseRemark(body.remark, "Remark", { required: true });

    return await performLeadAction(ideaIdParam, user, {
        allowedStatuses: [IdeaStatus.SUBMITTED],
        statusError: "Only Submitted ideas can be rejected.",
        action: IdeaAction.REJECTED,
        apply: async (transaction, idea, leadId) => ({
            updated: await ideaModel.rejectIdea(transaction, { ideaId: idea.IdeaID, leadId, remark }),
            logRemark: remark,
        }),
    });
};

/**
 * Start Implementation (Accepted -> In Implementation)
 */
const startImplementation = async (ideaIdParam, body = {}, user) => {
    const remark = parseRemark(body.remark, "Remark", { required: false });

    return await performLeadAction(ideaIdParam, user, {
        allowedStatuses: [IdeaStatus.ACCEPTED],
        statusError: "Implementation can only be started on Accepted ideas.",
        action: IdeaAction.IMPLEMENTATION_STARTED,
        apply: async (transaction, idea, leadId) => ({
            updated: await ideaModel.startImplementation(transaction, { ideaId: idea.IdeaID, leadId, remark }),
            logRemark: remark,
        }),
    });
};

/**
 * Mark Implemented (In Implementation -> Implemented)
 */
const markImplemented = async (ideaIdParam, body = {}, user) => {
    const remark = parseRemark(body.remark, "Remark", { required: false });

    return await performLeadAction(ideaIdParam, user, {
        allowedStatuses: [IdeaStatus.IN_IMPLEMENTATION],
        statusError: "Only ideas In Implementation can be marked as implemented.",
        action: IdeaAction.IMPLEMENTED,
        apply: async (transaction, idea, leadId) => ({
            updated: await ideaModel.markImplemented(transaction, { ideaId: idea.IdeaID, leadId, remark }),
            logRemark: remark,
        }),
    });
};

/**
 * Extend Timeline (Accepted / In Implementation, only when overdue).
 * Status does not change.
 */
const extendTimeline = async (ideaIdParam, body = {}, user) => {
    const additionalDays = parseDays(body.additionalDays, "Additional days");
    const reason = parseRemark(body.reason, "Reason", { required: true });

    return await performLeadAction(ideaIdParam, user, {
        allowedStatuses: [IdeaStatus.ACCEPTED, IdeaStatus.IN_IMPLEMENTATION],
        statusError: "The timeline can only be extended on Accepted or In Implementation ideas.",
        action: IdeaAction.TIMELINE_EXTENDED,
        apply: async (transaction, idea, leadId) => {
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
                ideaId: idea.IdeaID,
                leadId,
                additionalDays,
                remark: reason,
                fromStatus: idea.Status,
            });

            return {
                updated,
                logRemark: updated
                    ? `Extended by ${pluralDays(additionalDays)}. New target date: ${formatDate(updated.TargetDate)}. Reason: ${reason}`
                    : null,
            };
        },
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
 * Get Ideas Assigned To Me (logged-in user is the lead)
 */
const getAssignedIdeas = async (user) => {
    const pool = await poolPromise;
    return await ideaModel.getIdeasByLead(pool, user.userId);
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
    acceptIdea,
    rejectIdea,
    startImplementation,
    markImplemented,
    extendTimeline,
};
