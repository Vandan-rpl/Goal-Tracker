import { useEffect, useState } from "react";
import { FolderPlus } from "lucide-react";
import { toast } from "react-toastify";
import ProjectMemberPicker from "../ProjectMemberPicker/ProjectMemberPicker";
import { createProject, getProjectMemberOptions, getTaskApiError } from "../../services/taskService";

const PROJECT_NAME_MAX = 200;
const PROJECT_DESCRIPTION_MAX = 2000;

const EMPTY_FORM = { projectName: "", description: "", memberIds: [] };

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2c3e82]/40 disabled:opacity-60";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1";

/**
 * Settings card: create a Task Tracker project (name, description, first
 * members). Shown only to people who may create projects (the CFO and
 * anyone Admin added as a project creator); the backend checks the same
 * right on POST /tasks/projects.
 */
export default function CreateProjectSettings() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [memberOptions, setMemberOptions] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    getProjectMemberOptions()
      .then((list) => !ignore && setMemberOptions(list || []))
      .catch((err) => {
        if (!ignore) setError(getTaskApiError(err, "Failed to load employees.").message);
      })
      .finally(() => !ignore && setLoadingMembers(false));
    return () => {
      ignore = true;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const projectName = form.projectName.trim();
    if (!projectName) {
      setError("Project Name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await createProject({
        projectName,
        description: form.description.trim(),
        memberIds: form.memberIds,
      });
      toast.success(`Project "${projectName}" created.`);
      setForm(EMPTY_FORM);
    } catch (err) {
      const apiError = getTaskApiError(err, "Failed to create the project.");
      setError([apiError.message, ...apiError.details].join(" "));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs lg:col-span-2">
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#2c3e82]/10 text-[#2c3e82]">
          <FolderPlus className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Create Project</h2>
          <p className="text-xs text-slate-500">
            Create a Task Tracker project and add its members. Tasks can then be assigned to members from Assign Task.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label htmlFor="settings-project-name" className={labelClass}>
                Project Name *
              </label>
              <input
                id="settings-project-name"
                type="text"
                value={form.projectName}
                maxLength={PROJECT_NAME_MAX}
                onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
                disabled={saving}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="settings-project-description" className={labelClass}>
                Description
              </label>
              <textarea
                id="settings-project-description"
                rows={5}
                value={form.description}
                maxLength={PROJECT_DESCRIPTION_MAX}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                disabled={saving}
                className={`${inputClass} resize-y`}
              />
            </div>
          </div>
          <div>
            <p className={labelClass}>Members</p>
            {loadingMembers ? (
              <p className="text-sm text-slate-500">Loading employees…</p>
            ) : (
              <ProjectMemberPicker
                options={memberOptions}
                selected={form.memberIds}
                onChange={(memberIds) => setForm((f) => ({ ...f, memberIds }))}
                disabled={saving}
              />
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#2c3e82] px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Project"}
          </button>
        </div>
      </form>
    </section>
  );
}
