import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import api from '../../services/api';

// Simple hand-rolled SVG gauge — no charting library needed, keeps this
// page consistent with the rest of the (plain Tailwind, zero-extra-deps)
// Goals page family instead of introducing a new visual toolkit.
const ScoreGauge = ({ score }) => {
  const max = 5; // Ratings in this app are on a 1-5 scale (see submitGoalReview/submitHODRating)
  const clamped = score == null ? 0 : Math.max(0, Math.min(max, score));
  const pct = clamped / max;

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  const color =
    score == null ? '#9CA3AF' /* gray-400 */ :
    score >= 4 ? '#059669' /* emerald-600 */ :
    score >= 3 ? '#4F46E5' /* indigo-600 */ :
    score >= 2 ? '#D97706' /* amber-600 */ : '#DC2626' /* red-600 */;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="14" />
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 90 90)"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-black text-gray-900">
          {score != null ? score.toFixed(2) : 'N/A'}
        </span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">out of 5</span>
      </div>
    </div>
  );
};

const statusBadgeClass = (status) => {
  if (status === 'Completed') return 'bg-emerald-100 text-emerald-800';
  if (status === 'In Progress') return 'bg-indigo-100 text-indigo-800';
  return 'bg-gray-100 text-gray-800';
};

const FinalEvaluation = () => {
  const { userId: userIdParam } = useParams();
  const navigate = useNavigate();

  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cycle, setCycle] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeMessage, setFinalizeMessage] = useState('');

  // Same jwt-decode approach used in ViewGoal.jsx / QuarterlyUpdate.jsx —
  // the stored `user` object in localStorage has no numeric id, so we
  // decode the JWT itself when we need "who am I" reliably.
  let loggedInUserId = null;
  try {
    const token = localStorage.getItem('token');
    if (token) {
      loggedInUserId = jwtDecode(token).userId;
    }
  } catch (e) {
    loggedInUserId = null;
  }

  // Route supports both /goals/final-evaluation (self) and
  // /goals/final-evaluation/:userId (viewing someone else's, e.g. an HOD
  // looking at a direct report).
  const targetUserId = userIdParam ? Number(userIdParam) : loggedInUserId;
  const isSelf = targetUserId != null && loggedInUserId != null && Number(targetUserId) === Number(loggedInUserId);

  useEffect(() => {
    if (targetUserId != null) {
      fetchEvaluation();
    } else {
      setLoading(false);
      setError('Could not determine which user to show — please log in again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId, cycle]);

  const fetchEvaluation = async () => {
    try {
      setLoading(true);
      setError('');
      const query = cycle ? `?cycle=${encodeURIComponent(cycle)}` : '';
      const res = await api.get(`/evaluation/${targetUserId}${query}`);
      if (res.data.success) {
        setEvaluation(res.data.data);
      } else {
        setError(res.data.message || 'Failed to load final evaluation.');
      }
    } catch (err) {
      console.error('Error loading final evaluation', err);
      setError(err.response?.data?.message || 'Failed to load final evaluation.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    try {
      setFinalizing(true);
      setFinalizeMessage('');
      const res = await api.post(`/evaluation/${targetUserId}/finalize`, { cycle: cycle || undefined });
      if (res.data.success) {
        setFinalizeMessage(res.data.message || 'Final evaluation generated and employee notified.');
        setEvaluation(res.data.data);
      } else {
        setFinalizeMessage(res.data.message || 'Failed to finalize evaluation.');
      }
    } catch (err) {
      console.error('Error finalizing evaluation', err);
      setFinalizeMessage(err.response?.data?.message || 'Server error while finalizing evaluation.');
    } finally {
      setFinalizing(false);
    }
  };

  const totalWeightageRated = useMemo(() => {
    if (!evaluation) return 0;
    return evaluation.Goals.filter((g) => g.Rating != null).reduce((sum, g) => sum + g.Weightage, 0);
  }, [evaluation]);

  if (loading) {
    return (
      <div className="flex-1 bg-gray-50 min-h-screen flex items-center justify-center text-gray-500">
        Loading final evaluation...
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="flex-1 bg-gray-50 min-h-screen p-8 text-center">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl max-w-md mx-auto mb-4">
          {error || 'Evaluation not found.'}
        </div>
        <button onClick={() => navigate(-1)} className="text-indigo-600 font-semibold underline">
          &larr; Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Final Evaluation{isSelf ? '' : `: ${evaluation.User.FirstName} ${evaluation.User.LastName}`}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isSelf ? 'Your' : `${evaluation.User.FirstName}'s`} weighted score across all rated goals.
            </p>
          </div>
          <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold">
            &larr; Back
          </button>
        </div>

        {/* Cycle filter — see the note in evaluationController.js: there is
            no real "review cycle" concept in this schema, so this is a
            best-effort year filter against each goal's Timeline. */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Cycle (year, optional):</label>
          <input
            type="number"
            placeholder="e.g. 2026"
            value={cycle}
            onChange={(e) => setCycle(e.target.value)}
            className="w-32 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-xs text-gray-400">
            (No formal review-cycle field exists yet — this filters goals by year.)
          </span>
        </div>

        {/* Score + Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center bg-gray-50 p-6 rounded-xl border border-gray-100">
          <div className="flex justify-center">
            <ScoreGauge score={evaluation.WeightedScore} />
          </div>
          <div className="space-y-3 text-center sm:text-left">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Goal Completion Status</span>
              <div className="mt-1">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusBadgeClass(evaluation.GoalCompletionStatus)}`}>
                  {evaluation.GoalCompletionStatus}
                </span>
              </div>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Rated Weightage Coverage</span>
              <p className="text-sm font-semibold text-gray-700 mt-1">
                {totalWeightageRated}% of goal weightage has a rating so far.
              </p>
            </div>
          </div>
        </div>

        {/* Goal Breakdown Table */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-4">Goal Breakdown</h3>
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Goal</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Weightage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Contribution</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {evaluation.Goals.length > 0 ? (
                  evaluation.Goals.map((g) => (
                    <tr key={g.GoalID} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">#{g.GoalNumber} {g.GoalTitle}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2.5 py-1 inline-flex text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          {g.GoalStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-700">
                        {g.Weightage}%
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-700">
                        {g.Rating != null ? `${g.Rating} / 5` : <span className="text-gray-400 font-normal">Not rated</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-indigo-600">
                        {g.Contribution != null ? g.Contribution : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-sm text-gray-500">
                      No goals found{cycle ? ` for ${cycle}` : ''}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overall Feedback */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3">Overall Feedback</h3>
          <div className="bg-amber-50/50 p-5 rounded-xl border border-amber-100 text-sm text-gray-700 leading-relaxed">
            {evaluation.OverallFeedback}
          </div>
        </div>

        {/* Finalize action — HOD/reporting manager/Business Head only;
            enforced server-side, this button just isn't shown for a
            self-view since finalizing your own evaluation doesn't apply. */}
        {!isSelf && (
          <div className="pt-4 border-t">
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md transition disabled:opacity-50"
            >
              {finalizing ? 'Finalizing...' : 'Finalize & Notify Employee'}
            </button>
            {finalizeMessage && (
              <p className="text-sm text-gray-600 mt-2">{finalizeMessage}</p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              This computes the same figures shown above and notifies the employee — it does not lock in a permanent record (see the note in evaluationController.js if you want that).
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default FinalEvaluation;
