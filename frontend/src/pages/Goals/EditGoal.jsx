import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';

const EditGoal = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    GoalNumber: 1,
    GoalTitle: '',
    GoalDescription: '',
    Measurability: '',
    JointAccountability: '',
    Weightage: '',
    Priority: 'Medium',
    Timeline: '',
    MeetPerformance: '',
    ExceedPerformance: '',
    ValidationSource: '',
    CrossFunctionalGoal: false,
    GoalCategory: '',
    GoalStatus: 'Draft'
  });

  const [subGoals, setSubGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Field-level SMART validation errors from the backend — same 400 shape
  // as AddGoal.jsx: { success:false, message, errors: { Field: "message" } }
  const [fieldErrors, setFieldErrors] = useState({});

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentRole = String(
    currentUser.Role || currentUser.role || currentUser.userRole || '',
  ).toUpperCase();
  const canManageAllGoals =
    currentRole === 'CFO' ||
    currentRole === 'BUSINESSHEAD' ||
    currentRole === 'ADMIN';

  useEffect(() => {
    fetchGoal();
  }, [id]);

  const fetchGoal = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/goals/${id}`);
      if (res.data.success) {
        const goal = res.data.data;
        setFormData({
          GoalNumber: goal.GoalNumber || 1,
          GoalTitle: goal.GoalTitle || '',
          GoalDescription: goal.GoalDescription || '',
          Measurability: goal.Measurability || '',
          JointAccountability: goal.JointAccountability || '',
          Weightage: goal.Weightage || '',
          Priority: goal.Priority || 'Medium',
          Timeline: goal.Timeline ? goal.Timeline.split('T')[0] : '',
          MeetPerformance: goal.MeetPerformance || '',
          ExceedPerformance: goal.ExceedPerformance || '',
          ValidationSource: goal.ValidationSource || '',
          CrossFunctionalGoal: Boolean(goal.CrossFunctionalGoal),
          GoalCategory: goal.GoalCategory || '',
          GoalStatus: goal.GoalStatus || 'Draft'
        });

        if (goal.SubGoals && goal.SubGoals.length > 0) {
          setSubGoals(goal.SubGoals.map(sub => ({
            SubGoalNo: sub.SubGoalNo,
            SubGoalTitle: sub.SubGoalTitle || '',
            SubGoalDescription: sub.SubGoalDescription || '',
            Weightage: sub.Weightage || '',
            Target: sub.Target || ''
          })));
        } else {
          setSubGoals([{ SubGoalNo: 1, SubGoalTitle: '', SubGoalDescription: '', Weightage: '', Target: '' }]);
        }
      }
    } catch (err) {
      console.error('Failed to load goal', err);
      setError('Failed to load goal details.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubGoalChange = (index, e) => {
    const { name, value } = e.target;
    const updated = [...subGoals];
    updated[index][name] = value;
    setSubGoals(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        SubGoals: subGoals
      };

      const res = await api.put(`/goals/${id}`, payload);
      if (res.data.success) {
        navigate('/goals');
      } else {
        setError(res.data.message || 'Failed to update goal.');
        if (res.data.errors) {
          setFieldErrors(res.data.errors);
        }
      }
    } catch (err) {
      // SMART validation failures come back as a 400 with this exact
      // shape: { success:false, message, errors: { Field: "message" } }.
      const data = err.response?.data;
      setError(data?.message || 'Server error while updating goal.');
      if (data?.errors) {
        setFieldErrors(data.errors);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex-1 bg-gray-50 min-h-screen flex items-center justify-center text-gray-500">Loading goal for editing...</div>;
  }

  const isSubmitted = formData.GoalStatus === 'Submitted';
  const isRejected = formData.GoalStatus === 'Rejected';
  const isDraft = formData.GoalStatus === 'Draft';
  const isRestrictedEdit =
    !canManageAllGoals && !isDraft && !isSubmitted && !isRejected;

  if ((isSubmitted || isRejected) && !canManageAllGoals) {
    return (
      <div className="flex-1 bg-gray-50 min-h-screen p-8 text-center">
        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl max-w-md mx-auto mb-4 font-medium">
          {isSubmitted ? 'This goal is currently Submitted and cannot be edited by the user.' : 'This goal has been Rejected and cannot be edited.'}
        </div>
        <button onClick={() => navigate('/goals')} className="text-indigo-600 font-semibold underline">&larr; Back to Goals</button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10">
        
        <div className="flex justify-between items-center pb-6 border-b mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Goal</h1>
            <p className="text-sm text-gray-500 mt-1">Modify goal targets, metrics, and status.</p>
          </div>
          <button 
            type="button" 
            onClick={() => navigate('/goals')}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            &larr; Back to Goals
          </button>
        </div>

        {error && <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Goal No *</label>
              <input 
                type="number" 
                name="GoalNumber" 
                required 
                disabled={isRestrictedEdit}
                value={formData.GoalNumber} 
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500" 
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Goal Title *</label>
              <input 
                type="text" 
                name="GoalTitle" 
                required 
                disabled={isRestrictedEdit}
                value={formData.GoalTitle} 
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 ${fieldErrors.GoalTitle ? 'border-red-400' : ''}`}
              />
              {fieldErrors.GoalTitle && <p className="text-red-600 text-xs mt-1">{fieldErrors.GoalTitle}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input 
                type="text" 
                name="GoalCategory" 
                disabled={isRestrictedEdit}
                value={formData.GoalCategory} 
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 ${fieldErrors.GoalCategory ? 'border-red-400' : ''}`}
              />
              {fieldErrors.GoalCategory && <p className="text-red-600 text-xs mt-1">{fieldErrors.GoalCategory}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority *</label>
              <select 
                name="Priority" 
                value={formData.Priority} 
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weightage (%) *</label>
              <input 
                type="number" 
                step="0.01" 
                name="Weightage" 
                required 
                value={formData.Weightage} 
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white ${fieldErrors.Weightage ? 'border-red-400' : ''}`}
              />
              {fieldErrors.Weightage && <p className="text-red-600 text-xs mt-1">{fieldErrors.Weightage}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeline *</label>
              <input 
                type="date" 
                name="Timeline" 
                required 
                value={formData.Timeline} 
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white ${fieldErrors.Timeline ? 'border-red-400' : ''}`}
              />
              {fieldErrors.Timeline && <p className="text-red-600 text-xs mt-1">{fieldErrors.Timeline}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Goal Status</label>
              <select 
                name="GoalStatus" 
                value={formData.GoalStatus} 
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {isDraft && <option value="Draft">Draft</option>}
                {['Submitted', 'HOD Approved', 'Approved', 'Rejected'].includes(formData.GoalStatus) && (
                  <option value={formData.GoalStatus}>{formData.GoalStatus}</option>
                )}
                <option value="Running">Running</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Postpone">Postpone</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Goal Description</label>
              <textarea 
                name="GoalDescription" 
                rows="3" 
                disabled={isRestrictedEdit}
                value={formData.GoalDescription} 
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 ${fieldErrors.GoalDescription ? 'border-red-400' : ''}`}
              />
              {fieldErrors.GoalDescription && <p className="text-red-600 text-xs mt-1">{fieldErrors.GoalDescription}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Measurability *</label>
              <textarea 
                name="Measurability" 
                rows="3" 
                required
                value={formData.Measurability} 
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white ${fieldErrors.Measurability ? 'border-red-400' : ''}`}
              />
              {fieldErrors.Measurability && <p className="text-red-600 text-xs mt-1">{fieldErrors.Measurability}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meet Performance Target</label>
              <textarea 
                name="MeetPerformance" 
                rows="2" 
                disabled={isRestrictedEdit}
                value={formData.MeetPerformance} 
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 ${fieldErrors.MeetPerformance ? 'border-red-400' : ''}`}
              />
              {fieldErrors.MeetPerformance && <p className="text-red-600 text-xs mt-1">{fieldErrors.MeetPerformance}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exceed Performance Target</label>
              <textarea 
                name="ExceedPerformance" 
                rows="2" 
                disabled={isRestrictedEdit}
                value={formData.ExceedPerformance} 
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Validation Source</label>
              <input 
                type="text" 
                name="ValidationSource" 
                disabled={isRestrictedEdit}
                value={formData.ValidationSource} 
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Joint Accountability</label>
              <input 
                type="text" 
                name="JointAccountability" 
                disabled={isRestrictedEdit}
                value={formData.JointAccountability} 
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500" 
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input 
              type="checkbox" 
              name="CrossFunctionalGoal" 
              id="CrossFunctionalGoal"
              disabled={isRestrictedEdit}
              checked={formData.CrossFunctionalGoal} 
              onChange={handleChange}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 disabled:opacity-50" 
            />
            <label htmlFor="CrossFunctionalGoal" className="text-sm font-medium text-gray-700">Is this a Cross-Functional Goal?</label>
          </div>

          <hr className="my-6" />

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Sub-Goals</h3>
            </div>

            {subGoals.map((sub, index) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 relative space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-indigo-600 uppercase">Sub-Goal #{index + 1}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <input 
                      type="text" 
                      name="SubGoalTitle" 
                      placeholder="Sub-Goal Title *" 
                      required
                      disabled={isRestrictedEdit}
                      value={sub.SubGoalTitle} 
                      onChange={(e) => handleSubGoalChange(index, e)}
                      className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white disabled:bg-gray-100" 
                    />
                  </div>
                  <div>
                    <input 
                      type="text" 
                      name="Target" 
                      placeholder="Target Description" 
                      disabled={isRestrictedEdit}
                      value={sub.Target} 
                      onChange={(e) => handleSubGoalChange(index, e)}
                      className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white disabled:bg-gray-100" 
                    />
                  </div>
                  <div>
                    <input 
                      type="number" 
                      step="0.01" 
                      name="Weightage" 
                      placeholder="Weightage (%)" 
                      disabled={isRestrictedEdit}
                      value={sub.Weightage} 
                      onChange={(e) => handleSubGoalChange(index, e)}
                      className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white disabled:bg-gray-100" 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4 border-t">
            <button 
              type="button" 
              onClick={() => navigate('/goals')}
              className="px-5 py-2 border rounded-xl text-gray-700 hover:bg-gray-100 font-medium text-sm transition"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={submitting}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm shadow-md transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Goal'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default EditGoal;