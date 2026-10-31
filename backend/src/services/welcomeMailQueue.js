const crypto = require("crypto");
const { sendWelcomeMail } = require("./authMailService");
const logger = require("../utils/logger");

/**
 * ============================================================
 * Welcome Mail Queue
 *
 * Every welcome email (single add, both bulk uploads, Resend Credentials)
 * goes through this queue so the mailbox stays under Microsoft 365's limit
 * of 30 messages per minute: one send every 2 seconds, one at a time.
 *
 * - Bulk uploads enqueue a batch and return immediately; the admin polls
 *   getBatchStatus(batchId) for sent / failed counts.
 * - Single add and Resend Credentials enqueue with priority and await the
 *   result, so the admin can be told when the mail failed.
 *
 * In-memory only: a backend restart drops unsent mails (their batch status
 * is lost too). Those users can be sent Resend Credentials.
 *
 * Temporary passwords are held only until their mail is attempted, and are
 * never logged or included in a batch status.
 * ============================================================
 */

const MAILS_PER_MINUTE = 30;
const SEND_INTERVAL_MS = Math.ceil(60000 / MAILS_PER_MINUTE);

// Finished batches are kept this long so the admin can still read the summary.
const BATCH_RETENTION_MS = 24 * 60 * 60 * 1000;

const queue = [];
const batches = new Map();
let draining = false;
let lastSendAt = 0;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const errorMessage = (error) => (error && error.message) || String(error);

// Name and IDs only: what the admin needs to act on a failure.
const describeUser = (user) => ({
  userId: user.UserID,
  username: user.Username,
  employeeCode: user.EmployeeCode || null,
  name: [user.FirstName, user.LastName].filter(Boolean).join(" ").trim(),
  email: user.Email,
});

const pruneBatches = () => {
  const cutoff = Date.now() - BATCH_RETENTION_MS;
  for (const [id, batch] of batches) {
    if (batch.finishedAt && batch.finishedAt < cutoff) batches.delete(id);
  }
};

const drain = async () => {
  if (draining) return;
  draining = true;

  try {
    while (queue.length) {
      const delay = lastSendAt + SEND_INTERVAL_MS - Date.now();
      if (delay > 0) await wait(delay);

      const job = queue.shift();
      lastSendAt = Date.now();

      try {
        await sendWelcomeMail({ user: job.user, temporaryPassword: job.temporaryPassword });
        logger.info(`[WELCOME MAIL] Sent: userId=${job.user.UserID} source=${job.source}`);
        job.onDone(null);
      } catch (error) {
        logger.error(`[WELCOME MAIL] Failed: userId=${job.user.UserID} source=${job.source} error=${errorMessage(error)}`);
        job.onDone(error);
      } finally {
        job.temporaryPassword = null;
      }
    }
  } finally {
    draining = false;
  }
};

const push = (job, { priority = false } = {}) => {
  if (priority) queue.unshift(job);
  else queue.push(job);
  drain();
};

/**
 * Single add / Resend Credentials: jumps ahead of any bulk batch (still
 * throttled) and resolves once the mail is sent; rejects if it failed.
 */
const sendNow = ({ user, temporaryPassword, source }) =>
  new Promise((resolve, reject) => {
    push(
      { user, temporaryPassword, source, onDone: (error) => (error ? reject(error) : resolve()) },
      { priority: true },
    );
  });

/**
 * Bulk upload: queue one mail per created user and return at once.
 * @param {Array<{ user: object, temporaryPassword: string }>} items
 * @returns {string|null} batchId for getBatchStatus, or null if nothing was queued
 */
const enqueueBatch = (items, { source }) => {
  if (!items.length) return null;
  pruneBatches();

  const batchId = crypto.randomUUID();
  const batch = {
    batchId,
    source,
    createdAt: Date.now(),
    finishedAt: null,
    total: items.length,
    sent: 0,
    failed: [],
  };
  batches.set(batchId, batch);

  items.forEach(({ user, temporaryPassword }) => {
    push({
      user,
      temporaryPassword,
      source,
      onDone: (error) => {
        if (error) batch.failed.push({ ...describeUser(user), reason: errorMessage(error) });
        else batch.sent++;
        if (batch.sent + batch.failed.length === batch.total) batch.finishedAt = Date.now();
      },
    });
  });

  logger.info(`[WELCOME MAIL] Batch queued: batchId=${batchId} source=${source} mails=${items.length}`);
  return batchId;
};

const getBatchStatus = (batchId) => {
  const batch = batches.get(batchId);
  if (!batch) return null;

  const done = batch.sent + batch.failed.length;
  return {
    batchId: batch.batchId,
    source: batch.source,
    total: batch.total,
    sent: batch.sent,
    failed: batch.failed.length,
    pending: batch.total - done,
    finished: done === batch.total,
    failures: batch.failed,
    createdAt: new Date(batch.createdAt).toISOString(),
    finishedAt: batch.finishedAt ? new Date(batch.finishedAt).toISOString() : null,
  };
};

module.exports = {
  sendNow,
  enqueueBatch,
  getBatchStatus,
  MAILS_PER_MINUTE,
};
