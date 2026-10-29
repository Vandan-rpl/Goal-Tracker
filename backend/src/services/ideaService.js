const { sql, poolPromise } = require("../config/db");
const ideaModel = require("../models/ideaModel");
const AppError = require("../utils/AppError");
const StatusCodes = require("../constants/statusCodes");
const {
    IDEA_PURPOSES,
    IdeaStatus,
    IDEA_STATUSES,
    IdeaAction,
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
    } else if (!(await ideaModel.getActiveUser(db, idea.assignedLeadId))) {
        errors.push("Selected lead is not an active user.");
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

    return (
        idea.UserID === userId ||
        idea.AssignedLeadID === userId ||
        idea.SubmitterReportingManagerID === userId ||
        IDEA_VIEW_ALL_ROLES.includes(role)
    );
};

/**
 * Get Purpose List
 */
const getPurposes = () => IDEA_PURPOSES;

/**
 * Get Lead Options (active users except the logged-in user)
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

    // The reporting manager id is only needed for the access check above.
    const { SubmitterReportingManagerID, ...details } = idea;

    return {
        ...details,
        CanEdit: idea.UserID === Number(user.userId) && idea.Status === IdeaStatus.DRAFT,
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
};
