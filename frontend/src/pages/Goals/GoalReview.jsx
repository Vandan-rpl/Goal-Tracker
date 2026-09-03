import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const GoalReview = () => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [goal, setGoal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const goalId = queryParams.get('goalId');
  const token = queryParams.get('token'); // Optional token from email link

  useEffect(() => {
    if (goalId) {
      fetchGoalDetails();
    }
  }, [goalId]);

  const fetchGoalDetails = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/goals/${goalId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const result = await response.json();
      
      console.log("Goal API Response:", result); // Console ma check karva mate

      // Handle both formats: { success: true, data: {...} } or direct goal object {...}
      if (result.success && result.data) {
        setGoal(result.data);
      } else if (result.GoalID || result.GoalTitle) {
        setGoal(result);
      } else {
        setGoal(null);
      }
    } catch (error) {
      console.error('Error fetching goal details:', error);
    }
  };

 const handleSubmitFeedback = async () => {
  setSubmitting(true);
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/goals/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        goalId,
        token,
        rating,
        comment
      })
    });

    const data = await response.json().catch(() => null);

    if (response.ok) {
      alert('Feedback submitted successfully!');
      navigate('/manager/team-management');
    } else {
      console.error('Submit failed:', response.status, data);
      alert(`Failed to submit feedback: ${data?.message || response.status}`);
    }
  } catch (error) {
    console.error('Error submitting feedback:', error);
    alert('Network error while submitting feedback.');
  } finally {
    setSubmitting(false);
  }
};

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow rounded-lg mt-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Review Employee Goal</h2>

      {goal ? (
        <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
          <h3 className="font-bold text-gray-900">
            #{goal.GoalNumber || goal.GoalID} - {goal.GoalTitle || 'Untitled Goal'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{goal.GoalDescription || 'No description provided.'}</p>
          <div className="mt-2 text-xs text-gray-500 space-x-4">
            <span>Category: <b>{goal.GoalCategory || 'General'}</b></span>
            <span>Weightage: <b>{goal.Weightage || 0}%</b></span>
            <span>Priority: <b>{goal.Priority || 'N/A'}</b></span>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200 text-center text-sm text-gray-500">
          Loading goal details...
        </div>
      )}

      {/* Star Rating Component */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Rating (1 to 5 Stars)</label>
        <div className="flex space-x-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              type="button"
              key={star}
              onClick={() => setRating(star)}
              className={`text-2xl ${star <= rating ? 'text-amber-400' : 'text-gray-300'}`}
            >
              &#9733;
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Comment */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Feedback / Comments</label>
        <textarea
          rows="4"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Provide your feedback or comments here..."
        />
      </div>

      {/* Submit Feedback Button */}
      <div>
        <button
          onClick={handleSubmitFeedback}
          disabled={submitting}
          className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-md hover:bg-indigo-700 font-semibold transition"
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>
    </div>
  );
};

export default GoalReview;