const { poolPromise, sql } = require("../config/db");

/**
 * Runs `work(transaction)` in one SQL transaction: commits on success,
 * rolls back and rethrows on error. Returns what `work` returns.
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
      console.error("Transaction Rollback Error:", rollbackError);
    }
    throw error;
  }
};

module.exports = withTransaction;
