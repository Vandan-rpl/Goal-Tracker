const { poolPromise } = require("../config/db");
const taskModel = require("../models/taskModel");
const { sendEmail } = require("./notifyService");
const logger = require("../utils/logger");
const { formatDate } = require("../utils/ideaFormat");
const { TaskMailEvent } = require("../constants/taskConstants");

/**
 * ============================================================
 * Task Mail Service
 * Task Tracker emails to the employee: a task assigned by the Business
 * Head, and a new or changed CFO's Remark.
 *
 * sendTaskMail is called only after the change has committed and never
 * throws. Unlike idea emails it is awaited and reports { sent, reason }, so
 * the Business Head can be warned when the email did not go out; the DB
 * change stands either way.
 *
 * Config (backend .env):
 *   FRONTEND_URL           base URL for the My Tasks link
 *   TASK_MAIL_REDIRECT_TO  test mode: every task email goes to this address
 *                          instead of the real recipient, who is named in
 *                          the subject and body. Empty = real recipients.
 * ============================================================
 */

const redirectAddress = () => String(process.env.TASK_MAIL_REDIRECT_TO || "").trim();

/**
 * Called once at startup (server.js).
 */
const logTaskMailMode = () => {
    const redirectTo = redirectAddress();

    if (redirectTo) {
        logger.warn(`[TASK MAIL] Redirect is ON: every task assigned and CFO remark email goes to ${redirectTo} (TASK_MAIL_REDIRECT_TO).`);
    } else {
        logger.info("[TASK MAIL] Redirect is OFF: task assigned and CFO remark emails go to the real recipients.");
    }
};

/**
 * Event -> subject, opening line and detail rows ([label, value]; empty
 * values are left out).
 */
const TASK_MAIL_EVENTS = Object.freeze({
    [TaskMailEvent.ASSIGNED]: {
        subject: "New task assigned to you by Business Head",
        message: () => "The Business Head has assigned a new task to you.",
        details: (task) => [
            ["Task Name", task.TaskName],
            ["Priority", task.Priority],
            ["Due Date", formatDate(task.DueDate)],
            ["CFO's Remarks", task.CFORemarks],
        ],
    },
    [TaskMailEvent.CFO_REMARK]: {
        subject: "Business Head added a remark on your task",
        message: () => "The Business Head has added a remark on your task.",
        details: (task) => [
            ["Task Name", task.TaskName],
            ["Remark", task.CFORemarks],
        ],
    },
});

const escapeHtml = (value) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const toBool = (value) => value === true || value === 1 || value === "1";

const myTasksLink = () => {
    const baseUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
    return `${baseUrl}/tasks/my-tasks`;
};

const buildHtml = (definition, task, testRecipient) => {
    const rows = definition.details(task)
        .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");

    const rowHtml = rows
        .map(([label, value]) => `
                    <tr>
                        <td style="padding: 6px 12px 6px 0; color: #555; vertical-align: top; white-space: nowrap;">${escapeHtml(label)}</td>
                        <td style="padding: 6px 0; white-space: pre-wrap;"><strong>${escapeHtml(value)}</strong></td>
                    </tr>`)
        .join("");

    const testBanner = testRecipient
        ? `<p style="padding: 10px 12px; background-color: #fde8e8; border: 1px dashed #d33;">TEST MODE: this email would have been sent to ${escapeHtml(testRecipient.name)} &lt;${escapeHtml(testRecipient.email)}&gt;.</p>`
        : "";

    return `
            <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;">
                ${testBanner}
                <h3>Dear ${escapeHtml(task.EmployeeName || "there")},</h3>
                <p>${escapeHtml(definition.message(task))}</p>
                <table style="border-collapse: collapse; margin: 12px 0;">${rowHtml}
                </table>
                <a href="${escapeHtml(myTasksLink())}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Open My Tasks</a>
                <p style="margin-top: 20px;">Regards,<br/>IT Team<br/>Rubamin Pvt. Ltd.</p>
            </div>
        `;
};

/**
 * Send the email for `event` about a task to its employee. Call it only
 * after the change has committed. Never throws.
 *
 * @param {string} event    TaskMailEvent value
 * @param {number} taskId
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
const sendTaskMail = async (event, taskId) => {
    const definition = TASK_MAIL_EVENTS[event];
    let logTag = `task=${taskId} event=${event}`;

    try {
        if (!definition) {
            logger.error(`[TASK MAIL FAILED] ${logTag}: unknown event.`);
            return { sent: false, reason: "unknown email event" };
        }

        const pool = await poolPromise;
        const task = await taskModel.getTaskMailData(pool, taskId);

        if (!task) {
            logger.error(`[TASK MAIL FAILED] ${logTag}: task not found.`);
            return { sent: false, reason: "task not found" };
        }

        const recipient = {
            name: task.EmployeeName,
            email: String(task.EmployeeEmail || "").trim(),
        };

        logTag = `${logTag} userId=${task.EmployeeID} email=${recipient.email || "none"}`;

        if (!toBool(task.EmployeeIsActive)) {
            logger.warn(`[TASK MAIL SKIPPED] ${logTag}: recipient is inactive.`);
            return { sent: false, reason: "the employee is inactive" };
        }

        if (!recipient.email) {
            logger.warn(`[TASK MAIL SKIPPED] ${logTag}: recipient has no email.`);
            return { sent: false, reason: "the employee has no email address" };
        }

        const redirectTo = redirectAddress();

        await sendEmail({
            to: redirectTo || recipient.email,
            subject: redirectTo ? `[TEST] ${definition.subject} (for ${recipient.email})` : definition.subject,
            html: buildHtml(definition, task, redirectTo ? recipient : null),
        });

        logger.info(`[TASK MAIL SENT] ${logTag}${redirectTo ? ` redirectedTo=${redirectTo}` : ""}`);
        return { sent: true };
    } catch (error) {
        logger.error(`[TASK MAIL FAILED] ${logTag}: ${error && error.message ? error.message : error}`);
        return { sent: false, reason: "the mail server returned an error" };
    }
};

module.exports = {
    TASK_MAIL_EVENTS,
    logTaskMailMode,
    sendTaskMail,
};
