import api from "./api"; // src/services/api.js — baseURL already includes /api/v1

// ---------------------------------------------------------------------------
// Goal Dashboard API calls — mapped to routes in goalRoutes.js
// getGoals controller returns: { success, data: [...] } — a FLAT array of
// dbo.Goals rows (joined with Users for name/username), ORDER BY CreatedDate
// DESC. It does NOT include GoalSubGoal rows. Every function below unwraps
// res.data.data to hand components a plain array/object, not the envelope.
// ---------------------------------------------------------------------------

const BASE = "/goals";

/**
 * Fetch the logged-in employee's own goals.
 * Route: GET /api/v1/goals -> getGoals (reads UserID from JWT)
 * NOTE: response rows have NO sub-goals attached — see GoalSubGoal note below.
 */
export async function getEmployeeGoals() {
  const res = await api.get(BASE);
  return res.data.data;
}

/**
 * Fetch a single goal by id.
 * Route: GET /api/v1/goals/:id -> getGoalById
 * Unconfirmed whether this controller joins GoalSubGoal rows or not —
 * check before relying on a .SubGoals field being present in the response.
 */
export async function getGoalById(goalId) {
  const res = await api.get(`${BASE}/${goalId}`);
  return res.data.data ?? res.data;
}

/**
 * Create a new goal — used by the existing "Create New Goal" form.
 * Route: POST /api/v1/goals -> createGoal
 */
export async function createGoal(goalData, status) {
  const res = await api.post(BASE, { ...goalData, GoalStatus: status });
  return res.data.data ?? res.data;
}

/**
 * Update a goal's own fields (title, description, weightage, etc).
 * Route: PUT /api/v1/goals/:id -> updateGoal
 */
export async function updateGoal(goalId, payload) {
  const res = await api.put(`${BASE}/${goalId}`, payload);
  return res.data.data ?? res.data;
}

/**
 * Change a goal's workflow status (Draft / Submitted / HOD Approved /
 * Reviewed By HOD / Business Head Approved / Review By Business Head /
 * Rejected / Completed / Cancelled / Running / Approved / Postpone).
 * Route: PUT /api/v1/goals/status/:id -> changeGoalStatus
 */
export async function changeGoalStatus(goalId, status) {
  const res = await api.put(`${BASE}/status/${goalId}`, { GoalStatus: status });
  return res.data.data ?? res.data;
}

/**
 * Delete a goal.
 * Route: DELETE /api/v1/goals/:id -> deleteGoal
 */
export async function deleteGoal(goalId) {
  const res = await api.delete(`${BASE}/${goalId}`);
  return res.data;
}

/**
 * Submit HOD / Business Head review on a goal.
 * Route: POST /api/v1/goals/review -> submitGoalReview
 * Not used by the employee self-tracking dashboard.
 */
export async function submitGoalReview(reviewData) {
  const res = await api.post(`${BASE}/review`, reviewData);
  return res.data.data ?? res.data;
}

/**
 * Fetch all employee goals (CFO-level view across the org).
 * Route: GET /api/v1/goals/all-employee-goals -> getAllEmployeeGoals
 * Not used by the employee self-tracking dashboard.
 */
export async function getAllEmployeeGoals() {
  const res = await api.get(`${BASE}/all-employee-goals`);
  return res.data.data ?? res.data;
}

// ---------------------------------------------------------------------------
// PENDING — no route confirmed/built yet:
// - Fetching a goal's GoalSubGoal rows (getGoals doesn't join them; unclear
//   if getGoalById does either).
// - Updating a single sub-goal's Status ('Pending' | 'In Progress' |
//   'Completed' | 'Cancelled'), which is what should drive a goal's rolled-up
//   progress %. Needs e.g. PUT /api/v1/goals/sub-goals/:subGoalId/status
//   once you've checked whether it exists.
// ---------------------------------------------------------------------------