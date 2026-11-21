import { useEffect, useMemo, useState } from "react";
import { Lightbulb, Trash2 } from "lucide-react";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import SearchableSelect from "../SearchableSelect/SearchableSelect";
import {
  addIdeaFinalApprover,
  getIdeaApiError,
  getIdeaFinalApproverSettings,
  removeIdeaFinalApprover,
} from "../../services/ideaService";

const personDetails = (person) =>
  [person.EmployeeCode, person.Designation, person.DepartmentName].filter(Boolean).join(" · ");

/**
 * Admin-only settings card: who can be picked as an Innovation Idea final
 * approver (dbo.IdeaFinalApprovers). Removing someone doesn't touch ideas
 * already sent to them.
 */
export default function IdeaFinalApproverSettings() {
  const [approvers, setApprovers] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", error: false });
  const [removeTarget, setRemoveTarget] = useState(null);

  const apply = (settings) => {
    setApprovers(settings?.approvers || []);
    setCandidates(settings?.candidates || []);
  };

  useEffect(() => {
    let ignore = false;
    getIdeaFinalApproverSettings()
      .then((settings) => !ignore && apply(settings))
      .catch((err) => {
        if (!ignore) setMessage({ text: getIdeaApiError(err, "Unable to load final approvers.").message, error: true });
      })
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, []);

  const candidateOptions = useMemo(
    () =>
      candidates.map((person) => ({
        value: person.UserID,
        label: [person.FullName, person.EmployeeCode, person.DepartmentName].filter(Boolean).join(" – "),
      })),
    [candidates]
  );

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    setMessage({ text: "", error: false });
    try {
      const name = candidates.find((person) => person.UserID === selectedUserId)?.FullName;
      apply(await addIdeaFinalApprover(selectedUserId));
      setSelectedUserId(null);
      setMessage({ text: `${name || "User"} is now a final approver.`, error: false });
    } catch (err) {
      setMessage({ text: getIdeaApiError(err, "Unable to add final approver.").message, error: true });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setSaving(true);
    setMessage({ text: "", error: false });
    try {
      apply(await removeIdeaFinalApprover(removeTarget.UserID));
      setMessage({ text: `${removeTarget.FullName} is no longer a final approver.`, error: false });
      setRemoveTarget(null);
    } catch (err) {
      setMessage({ text: getIdeaApiError(err, "Unable to remove final approver.").message, error: true });
      setRemoveTarget(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    // No overflow-hidden here: it would clip the user dropdown below the search box.
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs lg:col-span-2">
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#2c3e82]/10 text-[#2c3e82]">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Innovation Idea Final Approvers</h2>
          <p className="text-xs text-slate-500">
            Reporting managers choose one of these people as the final approver when they approve an idea.
          </p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-0">
            <SearchableSelect
              id="idea-final-approver-add"
              options={candidateOptions}
              value={selectedUserId}
              onChange={setSelectedUserId}
              placeholder="Search a user by name, code or department"
              disabled={loading || saving}
              loading={loading}
              noOptionsText={loading ? "Loading..." : "No users available"}
              aria-label="User to add as final approver"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedUserId || loading || saving}
            className="shrink-0 rounded-lg bg-[#2c3e82] px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && !removeTarget ? "Adding…" : "Add final approver"}
          </button>
        </div>

        {message.text && (
          <p role="status" className={`text-sm ${message.error ? "text-red-600" : "text-slate-600"}`}>
            {message.text}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading final approvers…</p>
        ) : approvers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            No final approvers yet. Reporting managers can't approve ideas until at least one is added.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {approvers.map((person) => (
              <li key={person.UserID} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <span className="truncate">{person.FullName}</span>
                    {!person.UserIsActive && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Inactive user – not shown to managers
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{personDetails(person)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setRemoveTarget(person)}
                  disabled={saving}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {removeTarget && (
        <ConfirmDialog
          title="Remove final approver?"
          message={`${removeTarget.FullName} will no longer be offered as a final approver. Ideas already waiting for their approval stay with them.`}
          confirmLabel="Remove"
          busyLabel="Removing..."
          tone="danger"
          busy={saving}
          onConfirm={handleRemove}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </section>
  );
}
