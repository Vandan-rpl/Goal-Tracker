import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../services/api";

const REMARK_MAX_LENGTH = 500;

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString() : "N/A";

// Goals awaiting completion approval from the logged-in Reporting Manager
// (or HOD). The caller decides visibility; the backend re-checks the approver.
export default function CompletionRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyGoalId, setBusyGoalId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [remark, setRemark] = useState("");

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await api.get("/goals/completion-requests/pending");
        if (response.data.success) {
          setRequests(response.data.data || []);
        } else {
          toast.error(
            response.data.message || "Failed to load completion requests.",
          );
        }
      } catch (err) {
        toast.error(
          err.response?.data?.message ||
            "Server error while loading completion requests.",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  const removeRequest = (goalId) =>
    setRequests((prev) => prev.filter((r) => r.GoalID !== goalId));

  const handleApprove = async (request) => {
    const confirmed = window.confirm(
      `Approve completion of "${request.GoalTitle}" for ${request.EmployeeName}?\n\nThe goal will be marked Completed.`,
    );
    if (!confirmed) return;

    try {
      setBusyGoalId(request.GoalID);
      const response = await api.post(
        `/goals/${request.GoalID}/completion/approve`,
      );
      if (response.data.success) {
        toast.success(response.data.message || "Goal completion approved.");
        removeRequest(request.GoalID);
      } else {
        toast.error(response.data.message || "Failed to approve completion.");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          "Server error while approving goal completion.",
      );
    } finally {
      setBusyGoalId(null);
    }
  };

  const openReject = (request) => {
    setRejectTarget(request);
    setRemark("");
  };

  const closeReject = () => {
    if (busyGoalId) return;
    setRejectTarget(null);
    setRemark("");
  };

  const handleReject = async (event) => {
    event.preventDefault();
    const trimmedRemark = remark.trim();
    if (!trimmedRemark || !rejectTarget) return;

    try {
      setBusyGoalId(rejectTarget.GoalID);
      const response = await api.post(
        `/goals/${rejectTarget.GoalID}/completion/reject`,
        { CompletionRemark: trimmedRemark },
      );
      if (response.data.success) {
        toast.success(response.data.message || "Goal completion rejected.");
        removeRequest(rejectTarget.GoalID);
        setRejectTarget(null);
        setRemark("");
      } else {
        toast.error(response.data.message || "Failed to reject completion.");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          "Server error while rejecting goal completion.",
      );
    } finally {
      setBusyGoalId(null);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-700">
          Completion Requests{" "}
          {!loading && (
            <span className="ml-1 px-2.5 py-0.5 inline-flex text-xs font-semibold rounded-full bg-sky-100 text-sky-800 align-middle">
              ({requests.length})
            </span>
          )}
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                Goal
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                Weightage
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                Quarter
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                Requested
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                Progress
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td
                  colSpan="7"
                  className="px-6 py-12 text-center text-sm text-gray-500"
                >
                  Loading completion requests...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td
                  colSpan="7"
                  className="px-6 py-12 text-center text-sm text-gray-500"
                >
                  No goals are awaiting completion approval.
                </td>
              </tr>
            ) : (
              requests.map((request) => {
                const subGoalCount = Number(request.SubGoalCount || 0);
                const isBusy = busyGoalId === request.GoalID;
                return (
                  <tr
                    key={request.GoalID}
                    className="hover:bg-gray-50/50 transition"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {request.EmployeeName}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        to={`/goals/view/${request.GoalID}`}
                        className="font-bold text-gray-900 hover:text-indigo-600"
                      >
                        #{request.GoalNumber} - {request.GoalTitle}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">
                      {request.Weightage}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {request.Quarter || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(request.CompletionRequestedDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {subGoalCount > 0
                        ? `${Number(request.CompletedSubGoalCount || 0)}/${subGoalCount} steps done`
                        : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(request)}
                        disabled={busyGoalId !== null}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isBusy && !rejectTarget ? "Approving..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openReject(request)}
                        disabled={busyGoalId !== null}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleReject}
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden"
          >
            <div className="bg-slate-900 px-6 py-4 text-white">
              <h3 className="text-lg font-bold">Reject Completion</h3>
              <p className="text-xs text-slate-300">
                {rejectTarget.EmployeeName} · #{rejectTarget.GoalNumber} -{" "}
                {rejectTarget.GoalTitle}
              </p>
            </div>
            <div className="p-6 space-y-2">
              <label
                htmlFor="completion-remark"
                className="block text-xs font-semibold text-slate-700"
              >
                Remark <span className="text-red-500">*</span>
              </label>
              <textarea
                id="completion-remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                maxLength={REMARK_MAX_LENGTH}
                rows={4}
                required
                autoFocus
                placeholder="Explain why the goal is not complete yet."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-slate-800"
              />
              <p className="text-right text-xs text-slate-500">
                {remark.length}/{REMARK_MAX_LENGTH}
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeReject}
                disabled={busyGoalId !== null}
                className="text-sm bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!remark.trim() || busyGoalId !== null}
                className="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busyGoalId !== null ? "Rejecting..." : "Reject Completion"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
