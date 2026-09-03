import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import api from '../../services/api';
import GoalStatusStepper from '../../components/GoalStatusStepper/GoalStatusStepper';

const ViewGoal = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Quarterly update history for this goal (see QuarterlyUpdate.jsx and the
  // new GET /ratings/quarterly-updates/:goalId endpoint).
  const [quarterlyUpdates, setQuarterlyUpdates] = useState([]);
  const [expandedQuarter, setExpandedQuarter] = useState(null);

  // Review form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // ============================================
  // ROBUST ROLE DETECTION
  // Checks every likely key name and normalizes
  // casing/spacing so 'HOD', 'hod', 'Hod', 'hod ' 
  // all match the same way.
  // ============================================
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const rawRole =
    user.role ||
    user.Role ||
    user.userRole ||
    user.UserRole ||
    user.designation ||
    user.Designation ||
    '';

  // Normalize: lowercase, trim, collapse multiple spaces, remove underscores
  const normalizedRole = String(rawRole)
    .toLowerCase()
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');

  const approverRoles = ['hod', 'cfo', 'businesshead', 'business head', 'business_head', 'manager'];
  const isAuthorizedApprover = approverRoles.includes(normalizedRole);

  const getApprovalStatusForRole = () => {
    if (['businesshead', 'business head', 'business_head'].includes(normalizedRole)) {
      return 'Business Head Approved';
    }
    return 'HOD Approved';
  };

  const approvalStatus = getApprovalStatusForRole();

  // Statuses at which a review (rating + comment) can be submitted
  const reviewableStatuses = ['HOD Approved', 'Reviewed By HOD'];
  const canSubmitReview = isAuthorizedApprover && goal && reviewableStatuses.includes(goal.GoalStatus);

  // ============================================
  // OWNERSHIP CHECK for the Quarterly Update link
  // ============================================
  // NOTE: the `user` object stored in localStorage doesn't actually
  // include a numeric user id — authController.js's login response only
  // returns { token, isPasswordChanged, defaultPasswordFlag, username,
  // email, role }, no userId/UserID field. The id DOES exist inside the
  // JWT payload itself though, so we decode the token (jwt-decode is
  // already a dependency, just unused elsewhere) to get it reliably.
  let loggedInUserId = null;
  try {
    const token = localStorage.getItem('token');
    if (token) {
      loggedInUserId = jwtDecode(token).userId;
    }
  } catch (e) {
    loggedInUserId = null;
  }

  const isGoalOwner = goal && loggedInUserId != null && Number(goal.UserID) === Number(loggedInUserId);
  const canShowApproveReject =
    isAuthorizedApprover &&
    !isGoalOwner &&
    goal &&
    ['Submitted', 'HOD Approved', 'Reviewed By HOD'].includes(goal.GoalStatus);

  // "Goal status allows updates" — mirrors the same judgment call made in
  // QuarterlyUpdate.jsx: any status from initial approval onward, since
  // there's no single canonical "approved and active" status used
  // consistently across this codebase.
  const quarterlyUpdateEligibleStatuses = [
    'HOD Approved',
    'Business Head Approved',
    'Approved',
    'Reviewed By HOD',
    'Review By Business Head',
  ];
  const canLogQuarterlyUpdate =
    isGoalOwner && goal && quarterlyUpdateEligibleStatuses.includes(goal.GoalStatus);

  // TEMP DEBUG — remove once confirmed working
  useEffect(() => {
    console.log('=== ROLE DEBUG ===');
    console.log('Raw user object from localStorage:', user);
    console.log('rawRole detected as:', JSON.stringify(rawRole));
    console.log('normalizedRole:', JSON.stringify(normalizedRole));
    console.log('isAuthorizedApprover:', isAuthorizedApprover);
    console.log('==================');
  }, []);

  useEffect(() => {
    fetchGoalDetails();
  }, [id]);

  const fetchGoalDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/goals/${id}`);
      if (res.data.success) {
        setGoal(res.data.data);
      }
    } catch (err) {
      console.error('Error loading goal details', err);
      setError('Failed to load goal details.');
    } finally {
      setLoading(false);
    }

    // Quarterly update history — non-fatal if it fails, the rest of the
    // page (goal details, review actions) still works without it.
    try {
      const historyRes = await api.get(`/ratings/quarterly-updates/${id}`);
      if (historyRes.data.success) {
        setQuarterlyUpdates(historyRes.data.data || []);
      }
    } catch (historyErr) {
      console.error('Error loading quarterly update history', historyErr);
    }
  };

  // Manager / HOD / CFO Action Handler (Approve / Reject)
  const handleGoalAction = async (newStatus) => {
    try {
      setActionLoading(true);
      const response = await api.put(`/goals/status/${id}`, { goalStatus: newStatus });
      if (response.data.success) {
        alert(`Goal successfully ${newStatus.toLowerCase()}!`);
        setGoal((prev) => ({ ...prev, GoalStatus: newStatus }));
      } else {
        alert(response.data.message || 'Failed to update status.');
      }
    } catch (err) {
      console.error('Error updating goal status:', err);
      alert('Server error while updating status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Rating + Comment Review Handler
  const handleSubmitReview = async () => {
    try {
      setReviewSubmitting(true);
      const response = await api.post(`/goals/review`, {
        goalId: id,
        rating: reviewRating,
        comment: reviewComment
      });

      if (response.data.success) {
        alert(response.data.message || 'Review submitted successfully!');
        await fetchGoalDetails();
        setReviewComment('');
        setReviewRating(5);
      } else {
        alert(response.data.message || 'Failed to submit review.');
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      alert(err.response?.data?.message || 'Server error while submitting review.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex-1 bg-gray-50 min-h-screen flex items-center justify-center text-gray-500">Loading goal details...</div>;
  }

  if (error || !goal) {
    return (
      <div className="flex-1 bg-gray-50 min-h-screen p-8 text-center">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl max-w-md mx-auto mb-4">{error || 'Goal not found.'}</div>
        <button onClick={() => navigate(-1)} className="text-indigo-600 font-semibold underline">&larr; Back</button>
      </div>
    );
  }

  const isApproved = goal.GoalStatus === 'Approved' || 
                     goal.GoalStatus === 'HOD Approved' || 
                     goal.GoalStatus === 'Business Head Approved';

  return (
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10 space-y-6">
        
        {/* Navigation & Status Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b">
          <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center">
            &larr; Back
          </button>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
              isApproved ? 'bg-emerald-100 text-emerald-800' :
              goal.GoalStatus === 'Submitted' ? 'bg-indigo-100 text-indigo-800' :
              goal.GoalStatus === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {goal.GoalStatus || 'Draft'}
            </span>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
              Priority: {goal.Priority}
            </span>
          </div>
        </div>

        {/* Workflow Progress — visualizes where this goal sits in the
            8-step process instead of just the plain status text above */}
        <div className="py-2">
          <GoalStatusStepper status={goal.GoalStatus || 'Draft'} />
        </div>

        {/* Goal Main Title & Number */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Goal #{goal.GoalNumber}</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{goal.GoalTitle}</h1>
          <p className="text-sm text-gray-500 mt-1">Category: <span className="font-medium text-gray-700">{goal.GoalCategory || 'General'}</span></p>
        </div>

        {/* Metric Grid Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase">Weightage</p>
            <p className="text-lg font-bold text-gray-800">{goal.Weightage}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase">Timeline</p>
            <p className="text-sm font-bold text-gray-800">{goal.Timeline ? new Date(goal.Timeline).toLocaleDateString() : 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase">Cross-Functional</p>
            <p className="text-sm font-bold text-gray-800">{goal.CrossFunctionalGoal ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase">Draft Version</p>
            <p className="text-sm font-bold text-gray-800">v{goal.DraftVersion || 1}</p>
          </div>
        </div>

        {/* Description & Measurability */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
            <h4 className="font-semibold text-gray-800 mb-2 text-sm uppercase tracking-wider">Goal Description</h4>
            <p className="text-gray-600 text-sm leading-relaxed">{goal.GoalDescription || 'No description provided.'}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
            <h4 className="font-semibold text-gray-800 mb-2 text-sm uppercase tracking-wider">Measurability & Validation</h4>
            <p className="text-gray-600 text-sm leading-relaxed">{goal.Measurability || 'N/A'}</p>
            {goal.ValidationSource && <p className="text-xs text-indigo-600 mt-2 font-medium">Source: {goal.ValidationSource}</p>}
          </div>
        </div>

        {/* Performance Criteria (Meet vs Exceed) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100">
            <h4 className="font-semibold text-emerald-900 mb-2 text-sm uppercase tracking-wider">Meet Performance</h4>
            <p className="text-emerald-800 text-sm">{goal.MeetPerformance || 'Not specified'}</p>
          </div>
          <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100">
            <h4 className="font-semibold text-indigo-900 mb-2 text-sm uppercase tracking-wider">Exceed Performance</h4>
            <p className="text-indigo-800 text-sm">{goal.ExceedPerformance || 'Not specified'}</p>
          </div>
        </div>

        {goal.JointAccountability && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm">
            <span className="font-semibold text-gray-700">Joint Accountability: </span>
            <span className="text-gray-600">{goal.JointAccountability}</span>
          </div>
        )}

        <hr className="my-6" />

        {/* Quarterly Progress Updates */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Quarterly Progress</h3>
            {canLogQuarterlyUpdate && (
              <Link
                to={`/goals/quarterly-update/${goal.GoalID}`}
                className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-semibold transition"
              >
                + Log Quarterly Update
              </Link>
            )}
          </div>

          {quarterlyUpdates.length > 0 ? (
            <div className="space-y-3">
              {quarterlyUpdates.map((update) => {
                const isOpen = expandedQuarter === update.Quarter;
                return (
                  <div key={update.Quarter} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedQuarter(isOpen ? null : update.Quarter)}
                      className="w-full flex justify-between items-center p-4 hover:bg-gray-50 transition text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-indigo-600 uppercase">{update.Quarter}</span>
                        <span className="text-xs font-semibold bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full">
                          {update.ProgressPercentage}% Progress
                        </span>
                      </div>
                      <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
                    </button>

                    {isOpen && (
                      <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-2">
                        <div>
                          <span className="text-xs font-semibold text-gray-500 uppercase">Achievements</span>
                          <p className="text-sm text-gray-700 mt-0.5">{update.Achievements || 'None recorded.'}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-gray-500 uppercase">Challenges</span>
                          <p className="text-sm text-gray-700 mt-0.5">{update.Challenges || 'None recorded.'}</p>
                        </div>
                        {update.EvidenceUrl && (
                          <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">Evidence</span>
                            <p className="text-sm mt-0.5">
                              <a
                                href={update.EvidenceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:text-indigo-800 underline break-all"
                              >
                                {update.EvidenceUrl}
                              </a>
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500 bg-gray-50 p-6 rounded-xl text-center border border-dashed border-gray-200">
              No quarterly updates logged yet for this goal.
            </div>
          )}
        </div>

        <hr className="my-6" />

        {/* Sub-Goals Section */}
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-4">Associated Sub-Goals</h3>
          
          {goal.SubGoals && goal.SubGoals.length > 0 ? (
            <div className="space-y-3">
              {goal.SubGoals.map((sub, index) => (
                <div key={sub.SubGoalID || index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-xl bg-white shadow-xs gap-2">
                  <div>
                    <span className="text-xs font-bold text-indigo-600 uppercase">Sub-Goal #{sub.SubGoalNo || index + 1}</span>
                    <h4 className="text-sm font-bold text-gray-900">{sub.SubGoalTitle}</h4>
                    {sub.Target && <p className="text-xs text-gray-500 mt-0.5">Target: {sub.Target}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                      Weightage: {sub.Weightage}%
                    </span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      sub.Status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {sub.Status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 bg-gray-50 p-6 rounded-xl text-center border border-dashed border-gray-200">
              No sub-goals added for this goal.
            </div>
          )}
        </div>

        {/* Existing Reviewer Feedback */}
        {goal.ManagerRating && (
          <>
            <hr className="my-6" />
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">Reviewer Feedback</h3>
              <div className="bg-amber-50/50 p-5 rounded-xl border border-amber-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`text-xl ${star <= goal.ManagerRating ? 'text-amber-400' : 'text-gray-300'}`}
                      >
                        &#9733;
                      </span>
                    ))}
                    <span className="ml-2 text-sm font-semibold text-gray-700">
                      {goal.ManagerRating} / 5
                    </span>
                  </div>
                  {goal.ReviewedDate && (
                    <span className="text-xs text-gray-500">
                      Reviewed on {new Date(goal.ReviewedDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {goal.ManagerComment || 'No comments provided.'}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Submit Review Form */}
        {canSubmitReview && (
          <>
            <hr className="my-6" />
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">Submit Your Review</h3>
              <div className="bg-indigo-50/40 p-5 rounded-xl border border-indigo-100 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Rating (1 to 5 Stars)</label>
                  <div className="flex space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className={`text-2xl ${star <= reviewRating ? 'text-amber-400' : 'text-gray-300'}`}
                      >
                        &#9733;
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Comments</label>
                  <textarea
                    rows="4"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Provide your feedback or comments here..."
                  />
                </div>

                <button
                  onClick={handleSubmitReview}
                  disabled={reviewSubmitting}
                  className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-md hover:bg-indigo-700 font-semibold transition disabled:opacity-50"
                >
                  {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Footer Actions / Status Banner */}
        <div className="flex justify-between items-center pt-4 border-t">
          {goal.GoalStatus === 'Draft' ? (
            <Link 
              to={`/goals/edit/${goal.GoalID}`} 
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md transition ml-auto"
            >
              Edit Goal
            </Link>
          ) : isApproved && !reviewableStatuses.includes(goal.GoalStatus) ? (
            <div className="w-full flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-800 py-3 px-4 rounded-xl font-semibold text-sm">
              ✓ This goal has been successfully {goal.GoalStatus}.
            </div>
          ) : canShowApproveReject ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-gray-500">Review and take action on this goal:</span>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleGoalAction('Rejected')}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm shadow-md transition disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Reject Goal'}
                </button>
                <button
                  onClick={() => handleGoalAction(approvalStatus)}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow-md transition disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Approve Goal'}
                </button>
              </div>
            </div>
          ) : canSubmitReview ? (
            <div className="w-full text-center text-sm text-gray-500 py-2">
              Please submit your review above to proceed.
            </div>
          ) : (
            <div className="w-full text-center text-sm text-gray-500 py-2">
              {goal.GoalStatus === 'Rejected' 
                ? 'This goal has been rejected.' 
                : 'Goal is currently pending review.'}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ViewGoal;