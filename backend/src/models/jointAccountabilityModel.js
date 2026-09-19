// Insert multiple joint accountability rows for a goal
const insertJointAccountabilities = async (goalId, jointAccountabilities) => {
  const pool = await poolPromise;

  for (const ja of jointAccountabilities) {
    if (!ja.UserID) continue; // skip empty rows from the frontend

    const request = pool.request();
    request.input("GoalID", sql.Int, goalId);
    request.input("UserID", sql.Int, ja.UserID);
    request.input("ContributionNote", sql.NVarChar(500), ja.ContributionNote || null);
    request.input("Weightage", sql.Decimal(5, 2), ja.Weightage || null);

    await request.query(`
      INSERT INTO dbo.GoalJointAccountability (GoalID, UserID, ContributionNote, Weightage, Status)
      VALUES (@GoalID, @UserID, @ContributionNote, @Weightage, 'Pending')
    `);
  }
};

// Get joint accountability rows for a goal, with employee names joined
const getJointAccountabilitiesByGoalId = async (goalId) => {
  const pool = await poolPromise;
  const request = pool.request();
  request.input("GoalID", sql.Int, goalId);

  const result = await request.query(`
    SELECT ja.*, u.FirstName, u.LastName, u.Designation
    FROM dbo.GoalJointAccountability ja
    JOIN dbo.Users u ON u.UserID = ja.UserID
    WHERE ja.GoalID = @GoalID
  `);
  return result.recordset;
};

// Goals where the given user is a joint accountability participant
const getJointGoalsForUser = async (userId) => {
  const pool = await poolPromise;
  const request = pool.request();
  request.input("UserID", sql.Int, userId);

  const result = await request.query(`
    SELECT
      g.*,
      ja.JointAccountabilityID,
      ja.ContributionNote,
      ja.Weightage AS JointWeightage,
      ja.Status AS JointStatus,
      owner.FirstName AS OwnerFirstName,
      owner.LastName AS OwnerLastName
    FROM dbo.GoalJointAccountability ja
    JOIN dbo.Goals g ON g.GoalID = ja.GoalID
    JOIN dbo.Users owner ON owner.UserID = g.UserID
    WHERE ja.UserID = @UserID
    ORDER BY g.CreatedDate DESC
  `);
  return result.recordset;
};

// Replace all joint accountability rows for a goal (used on goal update)
const replaceJointAccountabilities = async (goalId, jointAccountabilities) => {
  const pool = await poolPromise;
  const deleteRequest = pool.request();
  deleteRequest.input("GoalID", sql.Int, goalId);
  await deleteRequest.query(`DELETE FROM dbo.GoalJointAccountability WHERE GoalID = @GoalID`);

  await insertJointAccountabilities(goalId, jointAccountabilities);
};

// Accept / Decline — scoped to the logged-in user's own row
const updateJointAccountabilityStatus = async (jointAccountabilityId, userId, status) => {
  const pool = await poolPromise;
  const request = pool.request();
  request.input("ID", sql.Int, jointAccountabilityId);
  request.input("UserID", sql.Int, userId);
  request.input("Status", sql.NVarChar(20), status);

  const result = await request.query(`
    UPDATE dbo.GoalJointAccountability
    SET Status = @Status, ModifiedDate = GETDATE()
    OUTPUT INSERTED.*
    WHERE JointAccountabilityID = @ID AND UserID = @UserID
  `);
  return result.recordset[0];
};

module.exports = {
  insertJointAccountabilities,
  getJointAccountabilitiesByGoalId,
  getJointGoalsForUser,
  replaceJointAccountabilities,
  updateJointAccountabilityStatus,
};