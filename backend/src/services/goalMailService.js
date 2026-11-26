const { poolPromise } = require("../config/db");
const goalModel = require("../models/goalModel");
const { sendEmail } = require("./notifyService");
const logger = require("../utils/logger");
const { PORTAL_NAME } = require("../constants/portalConstants");
const { getFiscalQuarterBoundsFromLabel } = require("../utils/fiscalQuarter");
const { GoalMailEvent, GoalWindow } = require("../constants/goalConstants");

/**
 * ============================================================
 * Goal Mail Service
 * Every Goal email: who gets it, its subject and its body.
 *
 * Controllers still create the in-app notification with notifyUser (no
 * email fields); the email goes through sendGoalMail. Call it only after
 * the action's transaction has committed. It never throws: a failed or
 * skipped email is logged and the action still succeeds. It resolves to
 * { sent, reason } for callers that report how many emails went out.
 *
 * Config (backend .env):
 *   FRONTEND_URL           base URL for the View Goal link
 *   GOAL_MAIL_ENABLED      "false" turns goal emails off (default on)
 *   GOAL_MAIL_REDIRECT_TO  test mode: every goal email goes to this address
 *                          instead of the real recipient
 * ============================================================
 */

const redirectAddress = () => String(process.env.GOAL_MAIL_REDIRECT_TO || "").trim();

/**
 * Called once at startup (server.js).
 */
const logGoalMailMode = () => {
  const redirectTo = redirectAddress();

  if (redirectTo) {
    logger.warn(`[GOAL MAIL] Redirect is ON: every goal email goes to ${redirectTo} (GOAL_MAIL_REDIRECT_TO).`);
  } else {
    logger.info("[GOAL MAIL] Redirect is OFF: goal emails go to the real recipients.");
  }
};

// Window reminder text per window (context.window).
const GOAL_WINDOW_TEXT = Object.freeze({
  [GoalWindow.ADD_GOAL]: {
    name: "Add Goal window",
    action: "add and submit your goals",
    link: "/goals/add",
    linkText: "Add Goals",
  },
  [GoalWindow.MANAGER_HOD_APPROVAL]: {
    name: "Manager/HOD goal approval window",
    action: "review and approve or reject the goals your team members have submitted",
    link: "/manager/team-management",
    linkText: "Review Team Goals",
  },
  [GoalWindow.CFO_APPROVAL]: {
    name: "CFO goal approval window",
    action: "give final approval to the goals waiting for you",
    link: "/manager/team-management",
    linkText: "Review Goals",
  },
});

const windowText = (context) => GOAL_WINDOW_TEXT[context.window] || GOAL_WINDOW_TEXT[GoalWindow.ADD_GOAL];

const noComment = (value, fallback) => (value && String(value).trim()) || fallback;

/**
 * Event -> subject purpose, action/information, and body text.
 *   message(goal, context)  opening line (plain text)
 *   details(goal, context)  extra [label, value] rows; empty values are left out
 *   needsGoal               false = not about one goal (no goal rows, own link)
 *   link(context)           path of the button link when needsGoal is false
 * `context` is what the caller passed in (e.g. { rating, comment }).
 */
const GOAL_MAIL_EVENTS = Object.freeze({
  [GoalMailEvent.SUBMITTED]: {
    purpose: "Approval required",
    actionRequired: true,
    message: (goal) => `${goal.OwnerName} has submitted a goal for your approval.`,
    details: () => [],
  },
  [GoalMailEvent.APPROVED]: {
    purpose: "Goal approved",
    actionRequired: false,
    message: () => "Your goal has been approved.",
    details: () => [],
  },
  [GoalMailEvent.REJECTED]: {
    purpose: "Goal rejected",
    actionRequired: false,
    message: () => "Your goal has been rejected.",
    details: () => [],
  },
  [GoalMailEvent.REVIEWED]: {
    purpose: "Goal reviewed",
    actionRequired: false,
    message: () => "Your goal has been reviewed.",
    details: (goal, context) => [
      ["Rating", `${context.rating}/5`],
      ["Comment", noComment(context.comment, "No comment provided")],
    ],
  },
  [GoalMailEvent.CFO_REVIEWED]: {
    purpose: "Goal reviewed by CFO",
    actionRequired: false,
    message: () => "Your goal has been reviewed by the CFO.",
    details: (goal, context) => [
      ["Rating", `${context.rating}/5`],
      ["Comment", noComment(context.comment, "No comment provided")],
    ],
  },
  [GoalMailEvent.CFO_REVIEWED_APPROVER]: {
    purpose: "Goal reviewed by CFO",
    actionRequired: false,
    message: (goal) =>
      `The goal of ${goal.OwnerName}, which you approved, has now been reviewed by the CFO.`,
    details: (goal, context) => [
      ["Rating", `${context.rating}/5`],
      ["Comment", noComment(context.comment, "No comment provided")],
    ],
  },
  [GoalMailEvent.COMPLETION_REQUESTED]: {
    purpose: "Completion approval required",
    actionRequired: true,
    message: (goal) =>
      `${goal.OwnerName} has requested completion of this goal and it is awaiting your approval.`,
    details: () => [],
  },
  [GoalMailEvent.COMPLETION_APPROVED]: {
    purpose: "Completion approved",
    actionRequired: false,
    message: () => "Completion of your goal has been approved.",
    details: () => [],
  },
  [GoalMailEvent.COMPLETION_REJECTED]: {
    purpose: "Completion rejected",
    actionRequired: false,
    message: () => "Completion of your goal was not approved.",
    details: (goal, context) => [["Remark", context.remark]],
  },
  [GoalMailEvent.QUARTERLY_UPDATE_SUBMITTED]: {
    purpose: "Quarterly update submitted",
    actionRequired: false,
    message: (goal) => `${goal.OwnerName} has submitted a quarterly progress update for this goal.`,
    details: (goal, context) => [
      ["Update quarter", context.quarter],
      ["Progress", context.progressPercentage != null ? `${context.progressPercentage}%` : ""],
    ],
  },
  [GoalMailEvent.HOD_RATING_SUBMITTED]: {
    purpose: "HOD rating submitted",
    actionRequired: false,
    message: () => "Your goal has received an HOD rating.",
    details: (goal, context) => [
      ["Rating", `${context.rating}/5`],
      ["Feedback", noComment(context.feedback, "No feedback provided")],
    ],
  },
  // Sent by jobs/goalWindowReminderJob.js the day before a goal window opens
  // and 2 days before it closes. context: { window, stage ("opening" |
  // "closing"), startDate, endDate (display text), targetQuarter }.
  [GoalMailEvent.WINDOW_REMINDER]: {
    needsGoal: false,
    purpose: "Reminder",
    actionRequired: false,
    subjectTitle: (context) =>
      `${windowText(context).name} ${context.stage === "closing" ? `closes on ${context.endDate}` : `opens on ${context.startDate}`}`,
    message: (goal, context) =>
      context.stage === "closing"
        ? `The ${windowText(context).name} closes in 2 days, on ${context.endDate}. ` +
          `Please ${windowText(context).action} in ${PORTAL_NAME} before it closes.`
        : `The ${windowText(context).name} opens tomorrow, ${context.startDate}, and stays open until ${context.endDate}. ` +
          `Please ${windowText(context).action} in ${PORTAL_NAME} during this window.`,
    details: (goal, context) => [
      ["Window", `${context.startDate} to ${context.endDate}`],
      ["Goals for", context.targetQuarter ? formatQuarter(context.targetQuarter) : ""],
    ],
    note: (context) =>
      `${PORTAL_NAME} allows this only from ${context.startDate} to ${context.endDate}.`,
    link: (context) => windowText(context).link,
    linkText: (context) => windowText(context).linkText,
  },
  [GoalMailEvent.DUE_REMINDER]: {
    purpose: "Goal end date approaching",
    actionRequired: false,
    message: (goal, context) =>
      `This is a reminder that your goal ends in ${context.daysLeft} day${context.daysLeft === 1 ? "" : "s"}. ` +
      `Please make sure it is completed and updated in ${PORTAL_NAME} before the end date.`,
    details: (goal, context) => [["End date", context.endDate]],
  },
});

const ACTION_REQUIRED_NOTE =
  `Action required: please open this goal in ${PORTAL_NAME} to review it and approve or reject it. ` +
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

const appLink = (path) => {
  const baseUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
  return `${baseUrl}${path}`;
};

const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "Q4-2027" (fiscal year end year) -> "March Quarter F.Y. 2026-27": the
// quarter is named after its last month.
const formatQuarter = (label) => {
  const bounds = getFiscalQuarterBoundsFromLabel(label);
  if (!bounds) return label || "";
  const [, startMonth] = bounds.startKey.split("-").map(Number);
  const fyEndYear = Number(String(label).split("-")[1]);
  const fiscalYear = `${fyEndYear - 1}-${String(fyEndYear % 100).padStart(2, "0")}`;
  return `${FULL_MONTHS[(startMonth + 1) % 12]} Quarter F.Y. ${fiscalYear}`;
};

const buildSubject = (definition, goal, context) =>
  definition.needsGoal === false
    ? `${definition.purpose}: ${definition.subjectTitle(context)}`
    : `${definition.purpose}: ${goal.GoalTitle}`;

/**
 * Simple HTML body in the same style as the idea and task emails (greeting,
 * short text, details table, note, green button). `testRecipient` adds a
 * test-mode banner naming who would have received it.
 */
const buildHtml = (definition, goal, context, recipient, testRecipient) => {
  // The owner row only helps approvers; the owner's own emails (approved,
  // rejected, due reminder, completion result...) leave it out.
  const recipientIsOwner =
    goal && recipient.userId != null && Number(recipient.userId) === Number(goal.OwnerID);
  const goalRows = goal
    ? [
        ["Goal", goal.GoalTitle],
        ["Quarter", formatQuarter(goal.Quarter)],
        ...(recipientIsOwner ? [] : [["Goal owner", goal.OwnerName]]),
      ]
    : [];
  const rows = [...goalRows, ...definition.details(goal, context)].filter(
    ([, value]) => value !== undefined && value !== null && String(value).trim() !== "",
  );

  const rowHtml = rows
    .map(([label, value]) => `
                    <tr>
                        <td style="padding: 6px 12px 6px 0; color: #555; vertical-align: top; white-space: nowrap;">${escapeHtml(label)}</td>
                        <td style="padding: 6px 0; white-space: pre-wrap;"><strong>${escapeHtml(value)}</strong></td>
                    </tr>`)
    .join("");

  const note = definition.note
    ? `<p style="padding: 10px 12px; background-color: #fff4e5; border-left: 4px solid #f59e0b;"><strong>${escapeHtml(definition.note(context))}</strong></p>`
    : definition.actionRequired
    ? `<p style="padding: 10px 12px; background-color: #fff4e5; border-left: 4px solid #f59e0b;"><strong>${escapeHtml(ACTION_REQUIRED_NOTE)}</strong></p>`
    : `<p style="padding: 10px 12px; background-color: #eef6ee; border-left: 4px solid #4CAF50;">${escapeHtml(INFORMATION_NOTE)}</p>`;

  const testBanner = testRecipient
    ? `<p style="padding: 10px 12px; background-color: #fde8e8; border: 1px dashed #d33;">TEST MODE: this email would have been sent to ${escapeHtml(testRecipient.name)} &lt;${escapeHtml(testRecipient.email)}&gt;.</p>`
    : "";

  const link = goal ? appLink(`/goals/view/${goal.GoalID}`) : appLink(definition.link(context));
  const linkText =
    (typeof definition.linkText === "function" ? definition.linkText(context) : definition.linkText) ||
    "View Goal";

  return `
            <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;">
                ${testBanner}
                <h3>Hello ${escapeHtml(recipient.firstName || recipient.name || "there")},</h3>
                <p>${escapeHtml(definition.message(goal, context))}</p>
                <table style="border-collapse: collapse; margin: 12px 0;">${rowHtml}
                </table>
                ${note}
                <a href="${escapeHtml(link)}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">${escapeHtml(linkText)}</a>
                <p style="margin-top: 20px;">Regards,<br/>Automation Team</p>
            </div>
        `;
};

/**
 * Send the email for `event`. Call it only after the action's transaction
 * has committed. Never throws.
 *
 * @param {string} event                 GoalMailEvent value
 * @param {object} context
 * @param {number} context.recipientId   UserID who gets the email
 * @param {number} [context.goalId]      the goal (every event except
 *                                       WINDOW_REMINDER)
 * @param {*} [context.rating] / comment / remark / quarter /
 *            progressPercentage / feedback / window / stage /
 *            startDate / endDate / daysLeft  event-specific values
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
const sendGoalMail = async (event, context = {}) => {
  const definition = GOAL_MAIL_EVENTS[event];
  let logTag = `goal=${context.goalId ?? "none"} event=${event} userId=${context.recipientId ?? "none"}`;

  try {
    if (!definition) {
      logger.error(`[GOAL MAIL FAILED] ${logTag}: unknown event.`);
      return { sent: false, reason: "unknown event" };
    }

    if (String(process.env.GOAL_MAIL_ENABLED || "").trim().toLowerCase() === "false") {
      logger.info(`[GOAL MAIL SKIPPED] ${logTag}: goal emails are turned off (GOAL_MAIL_ENABLED=false).`);
      return { sent: false, reason: "disabled" };
    }

    if (!context.recipientId) {
      logger.warn(`[GOAL MAIL SKIPPED] ${logTag}: no recipient.`);
      return { sent: false, reason: "no recipient" };
    }

    const pool = await poolPromise;
    const needsGoal = definition.needsGoal !== false;
    const [goal, user] = await Promise.all([
      needsGoal ? goalModel.getGoalMailData(pool, context.goalId) : null,
      goalModel.getUserMailData(pool, context.recipientId),
    ]);

    if (needsGoal && !goal) {
      logger.error(`[GOAL MAIL FAILED] ${logTag}: goal not found.`);
      return { sent: false, reason: "goal not found" };
    }

    if (!user) {
      logger.warn(`[GOAL MAIL SKIPPED] ${logTag}: recipient not found.`);
      return { sent: false, reason: "recipient not found" };
    }

    const recipient = {
      userId: context.recipientId,
      firstName: user.FirstName,
      name: user.FullName,
      email: String(user.Email || "").trim(),
    };
    logTag = `${logTag} email=${recipient.email || "none"}`;

    if (!toBool(user.IsActive)) {
      logger.warn(`[GOAL MAIL SKIPPED] ${logTag}: recipient is inactive.`);
      return { sent: false, reason: "recipient inactive" };
    }

    if (!recipient.email) {
      logger.warn(`[GOAL MAIL SKIPPED] ${logTag}: recipient has no email.`);
      return { sent: false, reason: "no email" };
    }

    const redirectTo = redirectAddress();
    const subject = buildSubject(definition, goal, context);

    await sendEmail({
      to: redirectTo || recipient.email,
      subject: redirectTo ? `[TEST] ${subject}` : subject,
      html: buildHtml(definition, goal, context, recipient, redirectTo ? recipient : null),
    });

    logger.info(`[GOAL MAIL SENT] ${logTag}${redirectTo ? ` redirectedTo=${redirectTo}` : ""}`);
    return { sent: true };
  } catch (error) {
    logger.error(`[GOAL MAIL FAILED] ${logTag}: ${error && error.message ? error.message : error}`);
    return { sent: false, reason: "send failed" };
  }
};

module.exports = {
  GOAL_MAIL_EVENTS,
  buildSubject,
  buildHtml,
  logGoalMailMode,
  sendGoalMail,
};
