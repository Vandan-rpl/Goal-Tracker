import { useCallback, useEffect, useState } from "react";
import { FolderCog, Pencil } from "lucide-react";
import { toast } from "react-toastify";
import ProjectMemberPicker from "../ProjectMemberPicker/ProjectMemberPicker";
import {
  addProjectMembers,
  getProject,
  getProjectMemberOptions,
  getProjects,
  getTaskApiError,
  removeProjectMember,
  updateProject,
} from "../../services/taskService";

const PROJECT_NAME_MAX = 200;
const PROJECT_DESCRIPTION_MAX = 2000;

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2c3e82]/40 disabled:opacity-60";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1";

/**
 * Settings card: every project the user runs (CanManage from GET
 * /tasks/projects - projects they created; for the CFO also those another
 * Business Head created), each editable: name, description and members.
 * The backend checks the same right on each PUT / POST / DELETE.
 *
 * `refreshKey` changes when a project is created, so the list reloads.
 */
export default function ManageProjectsSettings({ refreshKey = 0 }) {
  const [projects, setProjects] = useState([]);
  const [memberOptions, setMemberOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Project being edited: { projectId, projectName, description, memberIds, originalMemberIds, original }
  const [editing, setEditing] = useState(null);
  const [loadingProjectId, setLoadingProjectId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const loadProjects = useCallback(async () => {
    const data = await getProjects();
    setProjects((data?.projects || []).filter((project) => project.CanManage));
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.all([getProjects(), getProjectMemberOptions()])
      .then(([data, options]) => {
        if (ignore) return;
        setProjects((data?.projects || []).filter((project) => project.CanManage));
        setMemberOptions(options || []);
        setError("");
      })
      .catch((err) => {
        if (!ignore) setError(getTaskApiError(err, "Failed to load projects.").message);
      })
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const startEdit = async (projectId) => {
    try {
      setLoadingProjectId(projectId);
      setEditError("");
      const { project, members } = await getProject(projectId);
      const memberIds = (members || []).map((member) => member.UserID);
      setEditing({
        projectId,
        projectName: project.ProjectName || "",
        description: project.Description || "",
        memberIds,
        originalMemberIds: memberIds,
        original: { projectName: project.ProjectName || "", description: project.Description || "" },
      });
    } catch (err) {
      toast.error(getTaskApiError(err, "Failed to load the project.").message);
    } finally {
      setLoadingProjectId(null);
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditError("");
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    const projectName = editing.projectName.trim();
    const description = editing.description.trim();
    if (!projectName) {
      setEditError("Project Name is required.");
      return;
    }

    const { projectId, memberIds, originalMemberIds, original } = editing;
    const toAdd = memberIds.filter((id) => !originalMemberIds.includes(id));
    const toRemove = originalMemberIds.filter((id) => !memberIds.includes(id));
    const detailsChanged = projectName !== original.projectName.trim() || description !== original.description.trim();

    if (!detailsChanged && toAdd.length === 0 && toRemove.length === 0) {
      cancelEdit();
      return;
    }

    try {
      setSaving(true);
      setEditError("");
      if (detailsChanged) await updateProject(projectId, { projectName, description });
      if (toAdd.length > 0) await addProjectMembers(projectId, toAdd);
      for (const userId of toRemove) {
        await removeProjectMember(projectId, userId);
      }
      toast.success(`Project "${projectName}" updated.`);
      setEditing(null);
    } catch (err) {
      const apiError = getTaskApiError(err, "Failed to update the project.");
      setEditError([apiError.message, ...apiError.details].join(" "));
    } finally {
      setSaving(false);
      // Some steps may have gone through even if a later one failed.
      loadProjects().catch(() => {});
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs lg:col-span-2">
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#2c3e82]/10 text-[#2c3e82]">
          <FolderCog className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Manage Projects</h2>
          <p className="text-xs text-slate-500">
            Edit the name and description of the projects you run, and add or remove their members.
          </p>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <p className="text-sm text-slate-500">Loading projects…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-red-600">{error}</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-slate-500">You have no projects yet. Create one above.</p>
        ) : (
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {projects.map((project) => {
              const isEditing = editing?.projectId === project.ProjectID;
              return (
                <li key={project.ProjectID} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 wrap-break-word">{project.ProjectName}</p>
                      {project.Description && (
                        <p className="mt-0.5 text-xs text-slate-500 wrap-break-word line-clamp-2">{project.Description}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        {project.MemberCount} member{project.MemberCount === 1 ? "" : "s"} · {project.TaskCount} task
                        {project.TaskCount === 1 ? "" : "s"}
                        {project.CreatedByName ? ` · Created by ${project.CreatedByName}` : ""}
                      </p>
                    </div>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => startEdit(project.ProjectID)}
                        disabled={Boolean(editing) || loadingProjectId !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {loadingProjectId === project.ProjectID ? "Loading…" : "Edit"}
                      </button>
                    )}
                  </div>

                  {isEditing && (
                    <form onSubmit={saveEdit} className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="space-y-4">
                          <div>
                            <label htmlFor={`edit-project-name-${project.ProjectID}`} className={labelClass}>
                              Project Name *
                            </label>
                            <input
                              id={`edit-project-name-${project.ProjectID}`}
                              type="text"
                              value={editing.projectName}
                              maxLength={PROJECT_NAME_MAX}
                              onChange={(e) => setEditing((s) => ({ ...s, projectName: e.target.value }))}
                              disabled={saving}
                              className={`${inputClass} bg-white`}
                            />
                          </div>
                          <div>
                            <label htmlFor={`edit-project-description-${project.ProjectID}`} className={labelClass}>
                              Description
                            </label>
                            <textarea
                              id={`edit-project-description-${project.ProjectID}`}
                              rows={5}
                              value={editing.description}
                              maxLength={PROJECT_DESCRIPTION_MAX}
                              onChange={(e) => setEditing((s) => ({ ...s, description: e.target.value }))}
                              disabled={saving}
                              className={`${inputClass} bg-white resize-y`}
                            />
                          </div>
                        </div>
                        <div>
                          <p className={labelClass}>Members</p>
                          <ProjectMemberPicker
                            options={memberOptions}
                            selected={editing.memberIds}
                            onChange={(memberIds) => setEditing((s) => ({ ...s, memberIds }))}
                            disabled={saving}
                          />
                          <p className="mt-1.5 text-xs text-slate-500">
                            Removed members keep their existing tasks; added members get only tasks assigned from now on.
                          </p>
                        </div>
                      </div>

                      {editError && (
                        <p role="alert" className="text-sm text-red-600">{editError}</p>
                      )}

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={saving}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-lg bg-[#2c3e82] px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save Changes"}
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
