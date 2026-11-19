import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import SearchableSelect from "../../components/SearchableSelect/SearchableSelect";
import ProjectMemberPicker from "../../components/ProjectMemberPicker/ProjectMemberPicker";
import TaskWorkbookFrame, {
  taskFilterControlClass as inputClass,
  taskFilterLabelClass as labelClass,
  taskSecondaryButtonClass,
} from "../../components/TaskWorkbookFrame/TaskWorkbookFrame";
import {
  createProject,
  getProjectMemberOptions,
  getProjects,
  getTaskApiError,
} from "../../services/taskService";

const PROJECT_NAME_MAX = 200;
const PROJECT_DESCRIPTION_MAX = 2000;

const EMPTY_FORM = { projectName: "", description: "", memberIds: [] };

/**
 * Task Tracker > Projects. The Business Head and Managers create projects
 * (name, description, first members - a Manager picks from their
 * reportees). The Business Head and Admin see every project; a Manager sees
 * the ones they created; a member sees the ones they belong to. Counts
 * cover every task where the viewer sees all of them (SeesAllTasks),
 * otherwise only the viewer's own.
 */
const Projects = () => {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [memberOptions, setMemberOptions] = useState([]);

  useEffect(() => {
    let ignore = false;
    getProjects()
      .then((result) => {
        if (ignore) return;
        setProjects(result?.projects || []);
        setCanCreate(Boolean(result?.canCreate));
        setError("");
      })
      .catch((err) => {
        if (!ignore) setError(getTaskApiError(err, "Failed to load projects.").message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const projectOptions = useMemo(
    () => projects.map((project) => ({ value: project.ProjectID, label: project.ProjectName })),
    [projects],
  );

  const openCreate = async () => {
    setCreating(true);
    setForm(EMPTY_FORM);
    setFormError("");
    if (memberOptions.length === 0) {
      try {
        setMemberOptions((await getProjectMemberOptions()) || []);
      } catch (err) {
        setFormError(getTaskApiError(err, "Failed to load employees.").message);
      }
    }
  };

  const submitCreate = async (event) => {
    event.preventDefault();
    const projectName = form.projectName.trim();
    if (!projectName) {
      setFormError("Project Name is required.");
      return;
    }

    try {
      setSaving(true);
      const result = await createProject({
        projectName,
        description: form.description.trim(),
        memberIds: form.memberIds,
      });
      toast.success(`Project "${projectName}" created.`);
      navigate(`/tasks/projects/${result.project.ProjectID}`);
    } catch (err) {
      const apiError = getTaskApiError(err, "Failed to create the project.");
      setFormError([apiError.message, ...apiError.details].join(" "));
    } finally {
      setSaving(false);
    }
  };

  return (
    <TaskWorkbookFrame
      barSubtitle="Projects"
      badge="PROJECTS"
      title="Projects"
      description={
        canCreate
          ? "Create projects, add members and assign tasks to one member."
          : "Projects you are a member of. Open one to see and add your tasks."
      }
      actions={
        canCreate && !creating && (
          <button type="button" onClick={openCreate} className={taskSecondaryButtonClass}>
            + New Project
          </button>
        )
      }
    >
      {creating && (
        <form onSubmit={submitCreate} className="mb-6 border border-[#cbd4e2] bg-[#f4f6fa] p-4">
          <h2 className="mb-3 text-sm font-bold text-[#30415f]">New Project</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label htmlFor="project-name" className={labelClass}>Project Name *</label>
                <input
                  id="project-name"
                  type="text"
                  value={form.projectName}
                  maxLength={PROJECT_NAME_MAX}
                  onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
                  disabled={saving}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="project-description" className={labelClass}>Description</label>
                <textarea
                  id="project-description"
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
              <ProjectMemberPicker
                options={memberOptions}
                selected={form.memberIds}
                onChange={(memberIds) => setForm((f) => ({ ...f, memberIds }))}
                disabled={saving}
              />
            </div>
          </div>
          {formError && <p className="mt-3 text-xs font-medium text-[#b3403f]">{formError}</p>}
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreating(false)}
              disabled={saving}
              className="cursor-pointer border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="cursor-pointer bg-[#2c3e82] px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1f2c61] disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
      )}

      <div className="border border-[#aeb9cc] bg-[#f4f6fa] p-6">
        <div className="max-w-xl">
          <label htmlFor="project-select" className={labelClass}>Select Project</label>
          {!loading && projects.length === 0 ? (
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {canCreate ? "No projects yet. Create one with + New Project." : "You are not a member of any project."}
            </p>
          ) : (
            <SearchableSelect
              id="project-select"
              options={projectOptions}
              value={null}
              onChange={(projectId) => projectId && navigate(`/tasks/projects/${projectId}`)}
              placeholder="Search a project by name"
              loading={loading}
            />
          )}
          <p className="mt-2 text-xs text-slate-500">Pick a project to open its tasks.</p>
        </div>
      </div>
    </TaskWorkbookFrame>
  );
};

export default Projects;
