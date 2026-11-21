const cron = require("node-cron");
const { sql, poolPromise } = require("../config/db");
const { notifyUser } = require("../services/notifyService");
const { sendGoalMail } = require("../services/goalMailService");
const logger = require("../utils/logger");
const {
  GoalMailEvent,
  GoalDueReminderStages,
  GOAL_STATUSES_WITHOUT_DUE_REMINDER,
} = require("../constants/goalConstants");

/**
 * ============================================================
 * Goal Due Reminder Job
 * Emails each goal owner before their goal's end date (Goals.Timeline):
 * once 5 days before and once 2 days before (GoalDueReminderStages).
 *
 * Runs once a day on a cron schedule, and once at server start so a missed
 * day is caught up. A stage is due while the days left are inside its
 * window, e.g. the 5-day reminder for 3-5 days left and the 2-day reminder
 * for 1-2 days left.
 *
 * Each reminder also creates an in-app notification. That row is how a
 * reminder is sent only once: a goal is skipped when it already has one of
 * that type created inside the current window. If the end date is later
 * moved, the old row falls outside the new window and the reminder is
 * sent again for the new date.
 *
 * Config (backend .env):
 *   GOAL_DUE_REMINDER_ENABLED  "false" turns the job off (default on)
 *   GOAL_DUE_REMINDER_CRON     cron expression (default "0 9 * * *", 9:00 AM)
 *   GOAL_DUE_REMINDER_TZ       time zone for the schedule (default Asia/Kolkata)
 * Emails also follow GOAL_MAIL_ENABLED / GOAL_MAIL_REDIRECT_TO.
 * ============================================================
 */

const DEFAULT_CRON = "0 9 * * *";
const DEFAULT_TZ = "Asia/Kolkata";

let running = false;

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

/**
 * Goals that are due the reminder of `stage` today: days left in
 * (minDaysLeft, stage.daysBefore], still running, owner active, and no
 * reminder of this type yet for the current end date.
 */
const getGoalsDueForStage = async (pool, stage, minDaysLeft) => {
  const request = pool.request()
    .input("MaxDays", sql.Int, stage.daysBefore)
    .input("MinDays", sql.Int, minDaysLeft)
    .input("NotificationType", sql.NVarChar(50), stage.notificationType);

  const statusParams = GOAL_STATUSES_WITHOUT_DUE_REMINDER.map((status, index) => {
    request.input(`Status${index}`, sql.VarChar(50), status);
    return `@Status${index}`;
  });

  const result = await request.query(`
    SELECT g.GoalID, g.UserID, g.GoalTitle, g.Timeline,
           DATEDIFF(DAY, CAST(GETDATE() AS DATE), g.Timeline) AS DaysLeft
    FROM dbo.Goals g
    INNER JOIN dbo.Users u ON u.UserID = g.UserID
    WHERE u.IsActive = 1
      AND g.GoalStatus NOT IN (${statusParams.join(", ")})
      AND DATEDIFF(DAY, CAST(GETDATE() AS DATE), g.Timeline) > @MinDays
      AND DATEDIFF(DAY, CAST(GETDATE() AS DATE), g.Timeline) <= @MaxDays
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.Notifications n
        WHERE n.UserId = g.UserID
          AND n.ReferenceType = 'Goal'
          AND n.ReferenceId = g.GoalID
          AND n.NotificationType = @NotificationType
          AND n.CreatedAt >= DATEADD(DAY, -@MaxDays, CAST(g.Timeline AS DATETIME2))
      )
    ORDER BY g.Timeline, g.GoalID
  `);

  return result.recordset;
};

const sendReminder = async (pool, stage, goal) => {
  const daysLeft = Number(goal.DaysLeft);
  const endDate = formatDate(goal.Timeline);
  const dayText = `${daysLeft} day${daysLeft === 1 ? "" : "s"}`;

  // The notification row is the "already sent" record, so it goes first;
  // if it can't be saved, skip the email rather than resend it every day.
  const { notified } = await notifyUser(pool, {
    userId: goal.UserID,
    title: "Goal end date approaching",
    message: `Your goal "${goal.GoalTitle}" ends in ${dayText} (${endDate}).`,
    type: stage.notificationType,
    referenceId: goal.GoalID,
    referenceType: "Goal",
  });

  if (!notified) {
    logger.error(`[GOAL DUE REMINDER FAILED] goal=${goal.GoalID} stage=${stage.daysBefore}: notification not saved, email skipped.`);
    return false;
  }

  const { sent } = await sendGoalMail(GoalMailEvent.DUE_REMINDER, {
    recipientId: goal.UserID,
    goalId: goal.GoalID,
    daysLeft,
    endDate,
  });
  return sent;
};

/**
 * One pass over every stage. Never throws. Returns counts for logging.
 */
const runGoalDueReminders = async () => {
  if (running) {
    logger.warn("[GOAL DUE REMINDER] Previous run still in progress, skipping this one.");
    return { skipped: true };
  }

  running = true;
  const summary = { reminders: 0, emailsSent: 0 };

  try {
    const pool = await poolPromise;
    const stages = [...GoalDueReminderStages].sort((a, b) => b.daysBefore - a.daysBefore);

    for (let i = 0; i < stages.length; i += 1) {
      const stage = stages[i];
      const minDaysLeft = stages[i + 1] ? stages[i + 1].daysBefore : 0;
      const goals = await getGoalsDueForStage(pool, stage, minDaysLeft);

      // One at a time so a large batch doesn't flood the mail server.
      for (const goal of goals) {
        try {
          summary.reminders += 1;
          if (await sendReminder(pool, stage, goal)) summary.emailsSent += 1;
        } catch (error) {
          logger.error(`[GOAL DUE REMINDER FAILED] goal=${goal.GoalID} stage=${stage.daysBefore}: ${error?.message || error}`);
        }
      }
    }

    logger.info(`[GOAL DUE REMINDER] Run finished: ${summary.reminders} reminder(s), ${summary.emailsSent} email(s) sent.`);
  } catch (error) {
    logger.error(`[GOAL DUE REMINDER FAILED] Run aborted: ${error?.message || error}`);
  } finally {
    running = false;
  }

  return summary;
};

/**
 * Schedule the daily run and do one run now. Call once from server.js.
 */
const startGoalDueReminderJob = () => {
  if (String(process.env.GOAL_DUE_REMINDER_ENABLED || "").trim().toLowerCase() === "false") {
    logger.info("[GOAL DUE REMINDER] Job is turned off (GOAL_DUE_REMINDER_ENABLED=false).");
    return null;
  }

  const expression = String(process.env.GOAL_DUE_REMINDER_CRON || "").trim() || DEFAULT_CRON;
  const timezone = String(process.env.GOAL_DUE_REMINDER_TZ || "").trim() || DEFAULT_TZ;

  if (!cron.validate(expression)) {
    logger.error(`[GOAL DUE REMINDER] Invalid GOAL_DUE_REMINDER_CRON "${expression}"; job not scheduled.`);
    return null;
  }

  const task = cron.schedule(expression, runGoalDueReminders, { timezone });
  logger.info(`[GOAL DUE REMINDER] Scheduled "${expression}" (${timezone}).`);

  runGoalDueReminders();
  return task;
};

module.exports = {
  runGoalDueReminders,
  startGoalDueReminderJob,
};
