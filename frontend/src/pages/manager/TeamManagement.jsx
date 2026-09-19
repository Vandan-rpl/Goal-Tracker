import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Recursive row component: renders one user, and — if expanded — renders
// its own direct reports as nested TeamRow instances underneath it.
const TeamRow = ({ user, depth, onViewGoals }) => {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [fetchedOnce, setFetchedOnce] = useState(false);

  const toggleExpand = async () => {
    if (!expanded && !fetchedOnce) {
      setLoadingChildren(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/teams/members/${user.UserID}`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server returned non-JSON response.');
        }

        const result = await response.json();
        if (result.success) {
          setChildren(result.data);
        }
        setFetchedOnce(true);
      } catch (error) {
        console.error('Error fetching sub-team:', error);
      } finally {
        setLoadingChildren(false);
      }
    }
    setExpanded((prev) => !prev);
  };

  return (
    <>
      <tr className="hover:bg-gray-50 transition">
        <td
          className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
          style={{ paddingLeft: `${depth * 24 + 24}px` }}
        >
          {user.HasDirectReports ? (
            <button
              onClick={toggleExpand}
              className="mr-2 w-4 inline-block text-gray-500 hover:text-gray-800"
            >
              {expanded ? '▾' : '▸'}
            </button>
          ) : (
            <span className="mr-2 w-4 inline-block"></span>
          )}
          {user.FirstName} {user.LastName}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {user.Designation || user.Role}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold">
            {user.TotalGoals} Submitted
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <button
            onClick={() => onViewGoals(user.UserID, `${user.FirstName} ${user.LastName}`)}
            className="text-indigo-600 hover:text-indigo-900 font-semibold bg-indigo-50 px-3 py-1.5 rounded-md transition hover:bg-indigo-100 cursor-pointer"
          >
            View Goals
          </button>
        </td>
      </tr>

      {loadingChildren && (
        <tr>
          <td colSpan="4" className="px-6 py-2 text-center text-xs text-gray-400">
            Loading team...
          </td>
        </tr>
      )}

      {expanded &&
        children.map((child) => (
          <TeamRow key={child.UserID} user={child} depth={depth + 1} onViewGoals={onViewGoals} />
        ))}
    </>
  );
};

const TeamManagement = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchTeamUsers();
  }, []);

  const fetchTeamUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/teams/members`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response (HTML page). Check backend route or URL.');
      }

      const result = await response.json();
      if (result.success) {
        setUsers(result.data);
      } else {
        setErrorMsg(result.message || 'Failed to fetch team members');
      }
    } catch (error) {
      console.error('Error fetching team users:', error);
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewGoals = async (userId, userName) => {
    setSelectedUser({ id: userId, name: userName });
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/teams/user-goals/${userId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response for user goals.');
      }

      const result = await response.json();

      if (result.success) {
        setGoals(result.data);
      } else {
        setGoals([]);
      }
    } catch (error) {
      console.error('Error fetching user goals:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Team Management & Goals Review</h2>
      </div>

      {errorMsg && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md text-sm">{errorMsg}</div>
      )}

      {!selectedUser ? (
        <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                    User Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                    Post / Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                    Submitted Goals
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-sm text-gray-500">
                      Loading team members...
                    </td>
                  </tr>
                ) : users.length > 0 ? (
                  users.map((user) => (
                    <TeamRow key={user.UserID} user={user} depth={0} onViewGoals={handleViewGoals} />
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-sm text-gray-500">
                      No team members found under your management.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700">
              Goals for: <span className="text-indigo-600">{selectedUser.name}</span>
            </h3>
            <div className="flex items-center gap-3">
              <Link
                to={`/goals/final-evaluation/${selectedUser.id}`}
                className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md hover:bg-indigo-100 font-semibold transition"
              >
                View Final Evaluation
              </Link>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setGoals([]);
                }}
                className="text-sm bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-300 font-medium transition"
              >
                &larr; Back to Team List
              </button>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/75">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Goal No / Title
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Weightage
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Priority
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-sm text-gray-500">
                        Loading goals...
                      </td>
                    </tr>
                  ) : goals.length > 0 ? (
                    goals.map((goal) => (
                      <tr key={goal.GoalID} className="hover:bg-gray-50/50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">
                            #{goal.GoalNumber} - {goal.GoalTitle}
                          </div>
                          <div className="text-xs text-gray-400">
                            Timeline: {goal.Timeline ? new Date(goal.Timeline).toLocaleDateString() : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {goal.GoalCategory || 'General'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">
                          {goal.Weightage}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              goal.Priority === 'High'
                                ? 'bg-orange-100 text-orange-800'
                                : goal.Priority === 'Medium'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {goal.Priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-100 text-emerald-800">
                            {goal.GoalStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                          <Link to={`/goals/view/${goal.GoalID}`} className="text-indigo-600 hover:text-indigo-900 font-semibold">
                            View
                          </Link>
                          <Link
                            to={`/goals/review?goalId=${goal.GoalID}`}
                            className="text-emerald-600 hover:text-emerald-900 font-semibold bg-emerald-50 px-3 py-1.5 rounded-md transition hover:bg-emerald-100"
                          >
                            Review
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-sm text-gray-500">
                        No active goals found for this user.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;