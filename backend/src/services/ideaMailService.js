const { poolPromise } = require("../config/db");
const ideaModel = require("../models/ideaModel");
const { sendEmail } = require("./notifyService");
const logger = require("../utils/logger");
const { pluralDays, formatDate } = require("../utils/ideaFormat");
const { IdeaMailEvent } = require("../constants/ideaConstants");

/**
 * ============================================================
 * Idea Mail Service
 * Every Innovation Ideas email: who gets it, its subject and its body.
 *
 * sendIdeaMail is called only after the action's transaction has
 * committed, and never throws: a failed or skipped email is logged and the
 * action still succeeds.
 *
 * Config (backend .env):
 *   FRONTEND_URL           base URL for the Idea Details link
 *   IDEA_MAIL_ENABLED      "false" turns idea emails off (default on)
 *   IDEA_MAIL_REDIRECT_TO  test mode: every idea email goes to this address
 *                          instead of the real recipient
 * ============================================================
 */

// Where each recipient's id/name/email/active flag is in getIdeaMailData.
const IdeaMailRecipient = Object.freeze({
    SUBMITTER: { label: "submitter", prefix: "Submitter", idColumn: "SubmitterID" },
    MANAGER: { label: "reporting manager", prefix: "Lead", idColumn: "LeadID" },
    FINAL_APPROVER: { label: "final approver", prefix: "FinalApprover", idColumn: "FinalApproverID" },
});

/**
 * Event -> recipient, subject purpose, action/information, and body text.
 *   message(idea, context)  opening line (plain text)
 *   details(idea, context)  extra [label, value] rows; empty values are left out
 * `context` is what the action passed in (e.g. { remark }).
 */
const IDEA_MAIL_EVENTS = Object.freeze({
    [IdeaMailEvent.SUBMITTED]: {
        recipient: IdeaMailRecipient.MANAGER,
        purpose: "Approval required",
        actionRequired: true,
        message: (idea) =>
            `${idea.SubmitterName} has submitted an idea and selected you as the reporting manager.`,
        details: () => [],
    },
    [IdeaMailEvent.MANAGER_APPROVED]: {
        recipient: IdeaMailRecipient.FINAL_APPROVER,
        purpose: "Approval required",
        actionRequired: true,
        message: (idea) =>
            `${idea.LeadName} (reporting manager) has approved this idea and selected you as the final approver.`,
        details: (idea, context) => [
            ["Timeline", idea.TimelineDays ? pluralDays(idea.TimelineDays) : ""],
            ["Reporting manager's remark", context.remark],
        ],
    },
    [IdeaMailEvent.MANAGER_REJECTED]: {
        recipient: IdeaMailRecipient.SUBMITTER,
        purpose: "Idea rejected",
        actionRequired: false,
        message: (idea) => `Your idea has been rejected by your reporting manager, ${idea.LeadName}.`,
        details: (idea, context) => [["Rejection remark", context.remark]],
    },
    [IdeaMailEvent.FINAL_APPROVED]: {
        recipient: IdeaMailRecipient.SUBMITTER,
        purpose: "Idea approved",
        actionRequired: false,
        message: (idea) =>
            `Your idea has been approved by the final approver, ${idea.FinalApproverName}, and is now Active.`,
        details: (idea, context) => [
            ["Target date", formatDate(idea.TargetDate)],
            ["Final approver's remark", context.remark],
        ],
    },
    [IdeaMailEvent.FINAL_REJECTED]: {
        recipient: IdeaMailRecipient.SUBMITTER,
        purpose: "Idea rejected",
        actionRequired: false,
        message: (idea) => `Your idea has been rejected by the final approver, ${idea.FinalApproverName}.`,
        details: (idea, context) => [["Rejection remark", context.remark]],
    },
});

const ACTION_REQUIRED_NOTE =
    "Action required: please open this idea in Goal Tracker to review it and approve or reject it. " +
    "Approval can only be done in the app.";

const INFORMATION_NOTE = "This email is for your information only. No action is needed.";

const escapeHtml = (value) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const toBool = (value) => value === true || value === 1 || value === "1";

const ideaLink = (ideaId) => {
    const baseUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
    return `${baseUrl}/ideas/view/${ideaId}`;
};

const buildSubject = (definition, idea) => `[${idea.IdeaNumber}] ${definition.purpose}: ${idea.Title}`;

/**
 * Simple HTML body in the same style as the app's other emails (greeting,
 * short text, green button). `testRecipient` adds a test-mode banner naming
 * who would have received it.
 */
const buildHtml = (definition, idea, context, recipient, testRecipient) => {
    const rows = [
        ["Idea number", idea.IdeaNumber],
        ["Title", idea.Title],
        ["Submitted by", idea.SubmitterName],
        ["Current status", idea.Status],
        ...definition.details(idea, context),
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");

    const rowHtml = rows
        .map(([label, value]) => `
                    <tr>
                        <td style="padding: 6px 12px 6px 0; color: #555; vertical-align: top; white-space: nowrap;">${escapeHtml(label)}</td>
                        <td style="padding: 6px 0; white-space: pre-wrap;"><strong>${escapeHtml(value)}</strong></td>
                    </tr>`)
        .join("");

    const note = definition.actionRequired
        ? `<p style="padding: 10px 12px; background-color: #fff4e5; border-left: 4px solid #f59e0b;"><strong>${escapeHtml(ACTION_REQUIRED_NOTE)}</strong></p>`
        : `<p style="padding: 10px 12px; background-color: #eef6ee; border-left: 4px solid #4CAF50;">${escapeHtml(INFORMATION_NOTE)}</p>`;

    const testBanner = testRecipient
        ? `<p style="padding: 10px 12px; background-color: #fde8e8; border: 1px dashed #d33;">TEST MODE: this email would have been sent to ${escapeHtml(testRecipient.name)} &lt;${escapeHtml(testRecipient.email)}&gt; (${escapeHtml(testRecipient.label)}).</p>`
        : "";

    return `
            <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;">
                ${testBanner}
                <h3>Hello ${escapeHtml(recipient.name || "there")},</h3>
                <p>${escapeHtml(definition.message(idea, context))}</p>
                <table style="border-collapse: collapse; margin: 12px 0;">${rowHtml}
                </table>
                ${note}
                <a href="${escapeHtml(ideaLink(idea.IdeaID))}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Idea Details</a>
            </div>
        `;
};

/**
 * Send the email for `event` about an idea. Call it only after the action's
 * transaction has committed. Never throws.
 *
 * @param {string} event              IdeaMailEvent value
 * @param {object} context
 * @param {number} context.ideaId
 * @param {string} [context.remark]   remark entered with the action
 */
const sendIdeaMail = async (event, context = {}) => {
    const definition = IDEA_MAIL_EVENTS[event];
    let logTag = `idea=${context.ideaId} event=${event}`;

    try {
        if (!definition) {
            logger.error(`[IDEA MAIL FAILED] ${logTag}: unknown event.`);
            return;
        }

        if (String(process.env.IDEA_MAIL_ENABLED || "").trim().toLowerCase() === "false") {
            logger.info(`[IDEA MAIL SKIPPED] ${logTag}: idea emails are turned off (IDEA_MAIL_ENABLED=false).`);
            return;
        }

        const pool = await poolPromise;
        const idea = await ideaModel.getIdeaMailData(pool, context.ideaId);

        if (!idea) {
            logger.error(`[IDEA MAIL FAILED] ${logTag}: idea not found.`);
            return;
        }

        const { prefix, idColumn, label } = definition.recipient;
        const recipient = {
            id: idea[idColumn],
            name: idea[`${prefix}Name`],
            email: String(idea[`${prefix}Email`] || "").trim(),
            isActive: toBool(idea[`${prefix}IsActive`]),
            label,
        };

        logTag = `idea=${idea.IdeaNumber} event=${event} recipient=${label} userId=${recipient.id ?? "none"} email=${recipient.email || "none"}`;

        if (!recipient.id) {
            logger.warn(`[IDEA MAIL SKIPPED] ${logTag}: the idea has no ${label}.`);
            return;
        }

        if (!recipient.isActive) {
            logger.warn(`[IDEA MAIL SKIPPED] ${logTag}: recipient is inactive.`);
            return;
        }

        if (!recipient.email) {
            logger.warn(`[IDEA MAIL SKIPPED] ${logTag}: recipient has no email.`);
            return;
        }

        const redirectTo = String(process.env.IDEA_MAIL_REDIRECT_TO || "").trim();
        const subject = buildSubject(definition, idea);

        await sendEmail({
            to: redirectTo || recipient.email,
            subject: redirectTo ? `[TEST] ${subject}` : subject,
            html: buildHtml(definition, idea, context, recipient, redirectTo ? recipient : null),
        });

        logger.info(`[IDEA MAIL SENT] ${logTag}${redirectTo ? ` redirectedTo=${redirectTo}` : ""}`);
    } catch (error) {
        logger.error(`[IDEA MAIL FAILED] ${logTag}: ${error && error.message ? error.message : error}`);
    }
};

module.exports = {
    IDEA_MAIL_EVENTS,
    sendIdeaMail,
};
