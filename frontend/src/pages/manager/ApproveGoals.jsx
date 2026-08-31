import React, { useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { getTeamMembers, getUserGoalsByManager, updateGoalStatus } from '../../services/teamService';

const ApproveGoals = () => {
  const { user } = useAuth();
  const token = user?.token || localStorage.getItem('token');
  
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userGoals, setUserGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const response = await getTeamMembers(token);
        if (response.success) {
          setTeamMembers(response.data);
        }
      } catch (error) {
        console.error("Error fetching team members:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
  }, [token]);

  const handleSelectMember = async (member) => {
    setSelectedUser(member);
    setGoalsLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const response = await getUserGoalsByManager(member.UserID, token);
      if (response.success) {
        setUserGoals(response.data);
      }
    } catch (error) {
      console.error("Error fetching user goals:", error);
    } finally {
      setGoalsLoading(false);
    }
  };

  const handleStatusChange = async (goalId, newStatus) => {
    try {
      const response = await updateGoalStatus(goalId, newStatus, token);
      if (response.success) {
        setMessage({ text: `Goal successfully updated to ${newStatus}`, type: 'success' });
        const updatedGoals = await getUserGoalsByManager(selectedUser.UserID, token);
        if (updatedGoals.success) {
          setUserGoals(updatedGoals.data);
        }
      }
    } catch (error) {
      console.error("Error updating goal status:", error);
      setMessage({ text: 'Failed to update goal status.', type: 'error' });
    }
  };

  if (loading) {
    return <div className="flex-1 bg-gray-50 min-h-screen flex items-center justify-center text-gray-500">Loading team hierarchy...</div>;
  }

  const roleTitle = user?.Role === 'BusinessHead' || user?.role === 'BusinessHead' ? 'Managers Team View' : 'Team Members Goal Review';

  return (
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900">{roleTitle}</h1>
          <p className="text-sm text-gray-500 mt-1">Review and manage submitted performance goals of your team members.</p>
        </div>

        {message.text && (
          <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Team Members List Card */}
          <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              Team Members
            </h2>
            {teamMembers.length === 0 ? (
              <p className="text-gray-500 text-sm">No members found under your hierarchy.</p>
            ) : (
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <div 
                    key={member.UserID}
                    onClick={() => handleSelectMember(member)}
                    className={`p-4 rounded-xl cursor-pointer transition border ${
                      selectedUser?.UserID === member.UserID 
                        ? 'bg-indigo-50 border-indigo-200 shadow-xs' 
                        : 'bg-white border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <p className={`font-bold ${selectedUser?.UserID === member.UserID ? 'text-indigo-900' : 'text-gray-900'}`}>
                      {member.FirstName} {member.LastName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{member.Designation || member.Role}</p>
                    <span className="inline-block mt-3 px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                      Submitted Goals: {member.TotalGoals}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Member Goals View & Approval Actions */}
          <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              {selectedUser ? `Submitted Goals for ${selectedUser.FirstName} ${selectedUser.LastName}` : 'Select a Team Member'}
            </h2>

            {goalsLoading ? (
              <p className="text-gray-500 text-sm py-8 text-center">Loading submitted goals...</p>
            ) : !selectedUser ? (
              <div className="text-center py-12 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                Click on any team member from the left panel to display and review their submitted goals.
              </div>
            ) : userGoals.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                No submitted goals found for this user. (Draft goals are hidden).
              </div>
            ) : (
              <div className="space-y-4">
                {userGoals.map((goal) => (
                  <div key={goal.GoalID} className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Goal #{goal.GoalNumber}</span>
                        <h3 className="font-bold text-gray-900 text-base mt-0.5">{goal.GoalTitle}</h3>
                      </div>
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                        {goal.GoalStatus}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600">{goal.GoalDescription || 'No description provided.'}</p>
                    
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 bg-white p-3 rounded-lg border border-gray-100">
                      <div>Priority: <span className="font-semibold text-gray-800">{goal.Priority}</span></div>
                      <div>Weightage: <span className="font-semibold text-gray-800">{goal.Weightage}%</span></div>
                      <div>Timeline: <span className="font-semibold text-gray-800">{goal.Timeline ? new Date(goal.Timeline).toLocaleDateString() : 'N/A'}</span></div>
                    </div>

                    {/* Approval / Rejection Action Buttons */}
                    <div className="flex space-x-3 pt-3 border-t border-gray-200">
                      <button 
                        onClick={() => handleStatusChange(goal.GoalID, user?.Role === 'BusinessHead' || user?.role === 'BusinessHead' ? 'Business Head Approved' : 'HOD Approved')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition"
                      >
                        Approve Goal
                      </button>
                      <button 
                        onClick={() => handleStatusChange(goal.GoalID, 'Rejected')}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition"
                      >
                        Reject Goal
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ApproveGoals;