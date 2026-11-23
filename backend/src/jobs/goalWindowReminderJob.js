const cron = require("node-cron");
const { sql, poolPromise } = require("../config/db");
const { notifyUser } = require("../services/notifyService");
const { sendGoalMail } = require("../services/goalMailService");
const logger = require("../utils/logger");
const {
  getGoalCreationWindow,
  getManagerHodApprovalWindow,
  getCfoApprovalWindow,
  getFiscalQuarter,
  getNextFiscalQuarter,
} = require("../utils/fiscalQuarter");
const {
  GoalMailEvent,
  GoalWindow,
  GoalWindowReminderStage,
} = require("../constants/goalConstants");

/**
 * ============================================================
 * Goal Window Reminder Job
 * Emails people about the goal windows (last month of each quarter, see
 * utils/fiscalQuarter.js), e.g. for Jan-Mar goals:
 *   Add Goal 1-7 Dec            -> every active user except Admin
 *   Manager/HOD approval 8-15   -> every active user with team members
 *                                  (Reporting Manager or HOD of someone),
 *                                  except the CFO and Admin
 *   CFO approval 16-31          -> every active CFO (Business Head)
 * Each gets one email the day before the window opens (30 Nov, 7 Dec,
 * 15 Dec) and one 2 days before it closes (5 Dec, 13 Dec, 29 Dec).
 *
 * Runs once a day on a cron schedule and once at server start. Each email
 * also creates an in-app notification; that row is how a reminder is sent
 * only once (type GOAL_WINDOW_<WINDOW>_<STAGE>, ReferenceType 'GoalWindow',
 * ReferenceId = the window's start date as YYYYMMDD). A day the server was
 * down is not caught up: an "opens tomorrow" email sent late would be wrong.
 *
 * Config (backend .env):
 *   GOAL_WINDOW_REMINDER_ENABLED  "false" turns the job off (default on)
 *   GOAL_WINDOW_REMINDER_CRON     cron expression (default "0 9 * * *", 9:00 AM)
 *   GOAL_WINDOW_REMINDER_TZ       time zone for the schedule (default Asia/Kolkata)
 * Emails also follow GOAL_MAIL_ENABLED / GOAL_MAIL_REDIRECT_TO.
 * ============================================================
 */

const DEFAULT_CRON = "0 9 * * *";
const DEFAULT_TZ = "Asia/Kolkata";
const REFERENCE_TYPE = "GoalWindow";

const WINDOWS = [
  { key: GoalWindow.ADD_GOAL, typeName: "ADD_GOAL", getWindow: getGoalCreationWindow },
  { key: GoalWindow.MANAGER_HOD_APPROVAL, typeName: "MANAGER_HOD", getWindow: getManagerHodApprovalWindow },
  { key: GoalWindow.CFO_APPROVAL, typeName: "CFO", getWindow: getCfoApprovalWindow },
];

// In-app notification title per window.
const WINDOW_TITLES = {
  [GoalWindow.ADD_GOAL]: "Add Goal window",
  [GoalWindow.MANAGER_HOD_APPROVAL]: "Goal approval window (Manager/HOD)",
  [GoalWindow.CFO_APPROVAL]: "Goal approval window (CFO)",
};

let running = false;

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

const formatDate = (date) =>
  date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const dateNumber = (date) =>
  date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

/**
 * Reminders due on `today`: [{ window, stage, startDate, endDate }].
 * Opening: the window that starts tomorrow. Closing: the open window that
 * ends in 2 days. Uses the same window functions the app enforces, so a
 * temporary reopening is reminded about too.
 */
const getDueReminders = (today) => {
  const due = [];
  const opensOn = addDays(today, GoalWindowReminderStage.OPENING.daysBeforeStart);
  const closesOn = addDays(today, GoalWindowReminderStage.CLOSING.daysBeforeEnd);

  for (const window of WINDOWS) {
    const upcoming = window.getWindow(opensOn);
    if (sameDay(upcoming.startDate, opensOn)) {
      due.push({ window, stage: GoalWindowReminderStage.OPENING, ...upcoming });
    }

    const current = window.getWindow(today);
    if (current.isOpen && sameDay(current.endDate, closesOn)) {
      due.push({ window, stage: GoalWindowReminderStage.CLOSING, ...current });
    }
  }

  return due;
};

const recipientFilter = (windowKey) => {
  switch (windowKey) {
    case GoalWindow.MANAGER_HOD_APPROVAL:
      return `
        AND UPPER(u.Role) NOT IN ('ADMIN', 'BUSINESSHEAD')
        AND EXISTS (
          SELECT 1 FROM dbo.Users sub
          WHERE sub.IsActive = 1
            AND sub.UserID <> u.UserID
            AND (sub.ReportingManagerID = u.UserID OR sub.HODID = u.UserID)
        )`;
    case GoalWindow.CFO_APPROVAL:
      return "AND UPPER(u.Role) = 'BUSINESSHEAD'";
    default:
      return "AND UPPER(u.Role) <> 'ADMIN'";
  }
};

/**
 * Active users who get this reminder and haven't had it yet.
 */
const getRecipients = async (pool, reminder, notificationType, referenceId) => {
  const result = await pool.request()
    .input("NotificationType", sql.NVarChar(50), notificationType)
    .input("ReferenceType", sql.NVarChar(50), REFERENCE_TYPE)
    .input("ReferenceId", sql.Int, referenceId)
    .query(`
      SELECT u.UserID
      FROM dbo.Users u
      WHERE u.IsActive = 1
        ${recipientFilter(reminder.window.key)}
        AND NOT EXISTS (
          SELECT 1 FROM dbo.Notifications n
          WHERE n.UserId = u.UserID
            AND n.NotificationType = @NotificationType
            AND n.ReferenceType = @ReferenceType
            AND n.ReferenceId = @ReferenceId
        )
      ORDER BY u.UserID
    `);
  return result.recordset.map((row) => row.UserID);
};

const sendReminder = async (pool, reminder, userId, notificationType, referenceId, context) => {
  const title = WINDOW_TITLES[reminder.window.key];
  const message = reminder.stage === GoalWindowReminderStage.CLOSING
    ? `${title} closes in 2 days, on ${context.endDate}.`
    : `${title} opens tomorrow, ${context.startDate}, until ${context.endDate}.`;

  // The notification row is the "already sent" record, so it goes first;
  // if it can't be saved, skip the email rather than resend it every day.
  const { notified } = await notifyUser(pool, {
    userId,
    title: reminder.stage === GoalWindowReminderStage.CLOSING ? `${title} closing soon` : `${title} opens tomorrow`,
    message,
    type: notificationType,
    referenceId,
    referenceType: REFERENCE_TYPE,
  });

  if (!notified) {
    logger.error(`[GOAL WINDOW REMINDER FAILED] user=${userId} ${notificationType}: notification not saved, email skipped.`);
    return false;
  }

  const { sent } = await sendGoalMail(GoalMailEvent.WINDOW_REMINDER, { recipientId: userId, ...context });
  return sent;
};

/**
 * One pass for `now` (default: today). Never throws. Returns counts for logging.
 */
const runGoalWindowReminders = async (now = new Date()) => {
  if (running) {
    logger.warn("[GOAL WINDOW REMINDER] Previous run still in progress, skipping this one.");
    return { skipped: true };
  }

  running = true;
  const summary = { reminders: 0, emailsSent: 0 };

  try {
    const today = startOfDay(now);
    const due = getDueReminders(today);
    if (due.length === 0) {
      logger.info("[GOAL WINDOW REMINDER] No window opens tomorrow or closes in 2 days.");
      return summary;
    }

    const pool = await poolPromise;

    for (const reminder of due) {
      const notificationType = `GOAL_WINDOW_${reminder.window.typeName}_${reminder.stage.key.toUpperCase()}`;
      const referenceId = dateNumber(reminder.startDate);
      const context = {
        window: reminder.window.key,
        stage: reminder.stage.key,
        startDate: formatDate(reminder.startDate),
        endDate: formatDate(reminder.endDate),
        // Goals added / approved in a window are for the next quarter.
        targetQuarter: getNextFiscalQuarter(getFiscalQuarter(reminder.startDate).quarterEndDate).label,
      };

      const userIds = await getRecipients(pool, reminder, notificationType, referenceId);
      logger.info(`[GOAL WINDOW REMINDER] ${notificationType} (${context.startDate} - ${context.endDate}): ${userIds.length} recipient(s).`);

      // One at a time so a large batch doesn't flood the mail server.
      for (const userId of userIds) {
        try {
          summary.reminders += 1;
          if (await sendReminder(pool, reminder, userId, notificationType, referenceId, context)) {
            summary.emailsSent += 1;
          }
        } catch (error) {
          logger.error(`[GOAL WINDOW REMINDER FAILED] user=${userId} ${notificationType}: ${error?.message || error}`);
        }
      }
    }

    logger.info(`[GOAL WINDOW REMINDER] Run finished: ${summary.reminders} reminder(s), ${summary.emailsSent} email(s) sent.`);
  } catch (error) {
    logger.error(`[GOAL WINDOW REMINDER FAILED] Run aborted: ${error?.message || error}`);
  } finally {
    running = false;
  }

  return summary;
};

/**
 * Schedule the daily run and do one run now. Call once from server.js.
 */
const startGoalWindowReminderJob = () => {
  if (String(process.env.GOAL_WINDOW_REMINDER_ENABLED || "").trim().toLowerCase() === "false") {
    logger.info("[GOAL WINDOW REMINDER] Job is turned off (GOAL_WINDOW_REMINDER_ENABLED=false).");
    return null;
  }

  const expression = String(process.env.GOAL_WINDOW_REMINDER_CRON || "").trim() || DEFAULT_CRON;
  const timezone = String(process.env.GOAL_WINDOW_REMINDER_TZ || "").trim() || DEFAULT_TZ;

  if (!cron.validate(expression)) {
    logger.error(`[GOAL WINDOW REMINDER] Invalid GOAL_WINDOW_REMINDER_CRON "${expression}"; job not scheduled.`);
    return null;
  }

  const task = cron.schedule(expression, () => runGoalWindowReminders(), { timezone });
  logger.info(`[GOAL WINDOW REMINDER] Scheduled "${expression}" (${timezone}).`);

  runGoalWindowReminders();
  return task;
};

module.exports = {
  getDueReminders,
  runGoalWindowReminders,
  startGoalWindowReminderJob,
};
