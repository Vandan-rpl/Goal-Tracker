import { useEffect, useMemo, useState } from "react";
import { FolderKanban, Trash2 } from "lucide-react";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import SearchableSelect from "../SearchableSelect/SearchableSelect";
import {
  addProjectCreator,
  getProjectCreatorSettings,
  getTaskApiError,
  removeProjectCreator,
} from "../../services/taskService";

const personDetails = (person) =>
  [person.EmployeeCode, person.Designation, person.DepartmentName].filter(Boolean).join(" · ");

/**
 * Admin-only settings card: who besides the CFO can create Task Tracker
 * projects (dbo.ProjectCreators). Same layout as IdeaFinalApproverSettings.
 */
export default function ProjectCreatorSettings() {
  const [creators, setCreators] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", error: false });
  const [removeTarget, setRemoveTarget] = useState(null);

  const apply = (settings) => {
    setCreators(settings?.creators || []);
    setCandidates(settings?.candidates || []);
  };

  useEffect(() => {
    let ignore = false;
    getProjectCreatorSettings()
      .then((settings) => !ignore && apply(settings))
      .catch((err) => {
        if (!ignore) setMessage({ text: getTaskApiError(err, "Unable to load project creators.").message, error: true });
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
      apply(await addProjectCreator(selectedUserId));
      setSelectedUserId(null);
      setMessage({ text: `${name || "User"} can now create projects.`, error: false });
    } catch (err) {
      setMessage({ text: getTaskApiError(err, "Unable to add project creator.").message, error: true });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setSaving(true);
    setMessage({ text: "", error: false });
    try {
      apply(await removeProjectCreator(removeTarget.UserID));
      setMessage({ text: `${removeTarget.FullName} can no longer create projects.`, error: false });
    } catch (err) {
      setMessage({ text: getTaskApiError(err, "Unable to remove project creator.").message, error: true });
    } finally {
      setRemoveTarget(null);
      setSaving(false);
    }
  };

  return (
    // No overflow-hidden here: it would clip the user dropdown below the search box.
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs lg:col-span-2">
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#1976d2]/10 text-[#1976d2]">
          <FolderKanban className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Task Tracker Project Creators</h2>
          <p className="text-xs text-slate-500">
            The CFO can always create projects. Add the other people who can create and run projects.
          </p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-0">
            <SearchableSelect
              id="project-creator-add"
              options={candidateOptions}
              value={selectedUserId}
              onChange={setSelectedUserId}
              placeholder="Search a user by name, code or department"
              disabled={loading || saving}
              loading={loading}
              noOptionsText={loading ? "Loading..." : "No users available"}
              aria-label="User to allow to create projects"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedUserId || loading || saving}
            className="shrink-0 rounded-lg bg-[#1976d2] px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && !removeTarget ? "Adding…" : "Add project creator"}
          </button>
        </div>

        {message.text && (
          <p role="status" className={`text-sm ${message.error ? "text-red-600" : "text-slate-600"}`}>
            {message.text}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading project creators…</p>
        ) : creators.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            No one added yet. Only the CFO can create projects.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {creators.map((person) => (
              <li key={person.UserID} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <span className="truncate">{person.FullName}</span>
                    {!person.UserIsActive && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Inactive user
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
          title="Remove project creator?"
          message={`${removeTarget.FullName} will no longer be able to create projects or manage the projects they created. Those projects and their tasks stay as they are.`}
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
