import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import api from '../../services/api';

// Quarters this form supports — matches the `Quarter` values the backend's
// MERGE INTO QuarterlyUpdates keys off of (see ratingController.js).
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

const QuarterlyUpdate = () => {
  const { id } = useParams(); // GoalID
  const navigate = useNavigate();

  const [goal, setGoal] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    quarter: 'Q1',
    progressPercentage: '',
    achievements: '',
    challenges: '',
    evidenceUrl: '',
  });

  // Same trick used for role detection elsewhere in this file family
  // (ViewGoal.jsx) — the stored `user` object in localStorage doesn't
  // actually include a numeric user id (see authController.js's login
  // response), so we decode the JWT itself to get `userId` reliably.
  let loggedInUserId = null;
  try {
    const token = localStorage.getItem('token');
    if (token) {
      loggedInUserId = jwtDecode(token).userId;
    }
  } catch (e) {
    loggedInUserId = null;
  }

  useEffect(() => {
    fetchGoalAndHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchGoalAndHistory = async () => {
    try {
      setLoading(true);
      setError('');

      const goalRes = await api.get(`/goals/${id}`);
      if (goalRes.data.success) {
        setGoal(goalRes.data.data);
      }

      // Quarterly history — new endpoint added alongside this page
      // (GET /ratings/quarterly-updates/:goalId), since nothing previously
      // exposed a way to read this back.
      try {
        const historyRes = await api.get(`/ratings/quarterly-updates/${id}`);
        if (historyRes.data.success) {
          setHistory(historyRes.data.data || []);
        }
      } catch (historyErr) {
        // Non-fatal — the update form still works even if history fails to load.
        console.error('Failed to load quarterly update history', historyErr);
      }
    } catch (err) {
      console.error('Failed to load goal', err);
      setError('Failed to load goal details.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // When the user switches the quarter dropdown, prefill the form with
  // whatever was already submitted for that quarter (the backend MERGEs
  // on GoalId + Quarter, so resubmitting the same quarter overwrites it).
  const handleQuarterChange = (e) => {
    const quarter = e.target.value;
    const existing = history.find((item) => item.Quarter === quarter);

    setFormData({
      quarter,
      progressPercentage: existing ? String(existing.ProgressPercentage ?? '') : '',
      achievements: existing?.Achievements || '',
      challenges: existing?.Challenges || '',
      evidenceUrl: existing?.EvidenceUrl || '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const progress = Number(formData.progressPercentage);
    if (formData.progressPercentage === '' || Number.isNaN(progress) || progress < 0 || progress > 100) {
      setError('Progress % must be a number between 0 and 100.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        goalId: id,
        quarter: formData.quarter,
        progressPercentage: progress,
        achievements: formData.achievements,
        challenges: formData.challenges,
        evidenceUrl: formData.evidenceUrl,
      };

      const res = await api.post('/ratings/quarterly-update', payload);

      if (res.data.success) {
        setSuccessMessage(res.data.message || 'Quarterly update submitted successfully.');
        await fetchGoalAndHistory();
      } else {
        setError(res.data.message || 'Failed to submit quarterly update.');
      }
    } catch (err) {
      console.error('Error submitting quarterly update:', err);
      setError(err.response?.data?.message || 'Server error while submitting quarterly update.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-gray-50 min-h-screen flex items-center justify-center text-gray-500">
        Loading goal details...
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="flex-1 bg-gray-50 min-h-screen p-8 text-center">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl max-w-md mx-auto mb-4">
          {error || 'Goal not found.'}
        </div>
        <button onClick={() => navigate(-1)} className="text-indigo-600 font-semibold underline">
          &larr; Back
        </button>
      </div>
    );
  }

  const isOwner = loggedInUserId != null && Number(goal.UserID) === Number(loggedInUserId);

  // "Goal status allows updates" — the goal needs to have been approved
  // (at any stage of the approval/review chain) before an employee logs
  // quarterly progress against it. There's no single canonical "approved
  // and active" status used consistently across this codebase (see the
  // flags from earlier prompts), so this is a judgment call covering every
  // status past initial approval.
  const eligibleStatuses = [
    'HOD Approved',
    'Manager Approved',
    'Business Head Approved',
    'Approved',
    'Reviewed By HOD',
    'Review By Business Head',
  ];
  const statusAllowsUpdate = eligibleStatuses.includes(goal.GoalStatus);

  if (!isOwner || !statusAllowsUpdate) {
    return (
      <div className="flex-1 bg-gray-50 min-h-screen p-8 text-center">
        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl max-w-md mx-auto mb-4 font-medium">
          {!isOwner
            ? 'Only the goal owner can submit a quarterly update for this goal.'
            : `This goal's current status ("${goal.GoalStatus}") does not allow quarterly updates yet.`}
        </div>
        <Link to={`/goals/view/${id}`} className="text-indigo-600 font-semibold underline">
          &larr; Back to Goal
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10">

        <div className="flex justify-between items-center pb-6 border-b mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quarterly Progress Update</h1>
            <p className="text-sm text-gray-500 mt-1">
              Goal #{goal.GoalNumber} &mdash; <span className="font-medium text-gray-700">{goal.GoalTitle}</span>
            </p>
          </div>
          <Link
            to={`/goals/view/${id}`}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            &larr; Back to Goal
          </Link>
        </div>

        {error && <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">{error}</div>}
        {successMessage && (
          <div className="mb-6 bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm font-medium">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quarter *</label>
              <select
                name="quarter"
                required
                value={formData.quarter}
                onChange={handleQuarterChange}
                className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {QUARTERS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                    {history.some((item) => item.Quarter === q) ? ' (already submitted — editing)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Progress % (0-100) *</label>
              <input
                type="number"
                name="progressPercentage"
                min="0"
                max="100"
                step="0.01"
                required
                placeholder="e.g. 65"
                value={formData.progressPercentage}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Achievements</label>
            <textarea
              name="achievements"
              rows="3"
              placeholder="What did you accomplish against this goal this quarter?"
              value={formData.achievements}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Challenges</label>
            <textarea
              name="challenges"
              rows="3"
              placeholder="Any blockers or challenges faced this quarter?"
              value={formData.challenges}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Evidence URL</label>
            <input
              type="url"
              name="evidenceUrl"
              placeholder="Link to a report, drive folder, dashboard, etc."
              value={formData.evidenceUrl}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
            {/*
              NOTE: there's no generic "upload a file, get back a URL"
              endpoint anywhere in this backend — the only existing upload
              pattern (uploadController.js / uploadService.js /
              uploadRoutes.js) is a single-purpose .xlsx bulk-employee
              importer with a hardcoded file-type filter. Reusing it here
              would either misuse it or require building a new dedicated
              evidence-upload endpoint, which is out of scope for this
              request. This field matches exactly what the backend's
              `evidenceUrl` param already expects (see ratingController.js).
              Say the word if you want real file attachments instead of a
              link and I'll build a small dedicated upload endpoint next.
            */}
            <p className="text-xs text-gray-400 mt-1">
              Paste a link to supporting evidence (drive folder, report, dashboard, etc.).
            </p>
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4 border-t">
            <Link
              to={`/goals/view/${id}`}
              className="px-5 py-2 border rounded-xl text-gray-700 hover:bg-gray-100 font-medium text-sm transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm shadow-md transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Update'}
            </button>
          </div>

        </form>

        {/* Quarterly History */}
        {history.length > 0 && (
          <>
            <hr className="my-8" />
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4">Previous Updates</h3>
              <div className="space-y-3">
                {history.map((item) => (
                  <div key={item.Quarter} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-indigo-600 uppercase">{item.Quarter}</span>
                      <span className="text-xs font-semibold bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full">
                        {item.ProgressPercentage}% Progress
                      </span>
                    </div>
                    {item.Achievements && (
                      <p className="text-sm text-gray-700 mt-1">
                        <span className="font-semibold">Achievements: </span>
                        {item.Achievements}
                      </p>
                    )}
                    {item.Challenges && (
                      <p className="text-sm text-gray-700 mt-1">
                        <span className="font-semibold">Challenges: </span>
                        {item.Challenges}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default QuarterlyUpdate;
