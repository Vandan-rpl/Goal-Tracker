import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import ProjectMemberPicker from "../../components/ProjectMemberPicker/ProjectMemberPicker";
import TaskSheet from "../../components/TaskSheet/TaskSheet";
import TaskWorkbookFrame, {
  taskFilterControlClass as inputClass,
  taskFilterLabelClass as labelClass,
  taskSecondaryButtonClass,
} from "../../components/TaskWorkbookFrame/TaskWorkbookFrame";
import {
  addProjectMembers,
  getProject,
  getProjectMemberOptions,
  getTaskApiError,
  markTasksSeen,
  removeProjectMember,
  updateProject,
} from "../../services/taskService";
import { taskUnseenCountReceived } from "../../redux/slices/taskSlice";

const PROJECT_NAME_MAX = 200;
const PROJECT_DESCRIPTION_MAX = 2000;

const primaryButtonClass =
  "cursor-pointer bg-[#2c3e82] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1f2c61] disabled:cursor-not-allowed disabled:opacity-50";
const cancelButtonClass =
  "cursor-pointer border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

const apiErrorText = (err, fallback) => {
  const apiError = getTaskApiError(err, fallback);
  return [apiError.message, ...apiError.details].join(" ");
};

/**
 * One project.
 *   Creator       - (canManage: the Manager who created it, or the Business
 *                   Head on a Business Head project) edit name / description,
 *                   add / remove members (a Manager: their reportees), and
 *                   the task sheet in assign mode: every task of the project
 *                   (removed members' tasks too), new rows assigned to one
 *                   member or All members, "All members" tasks shown with
 *                   per-member progress, "Manager / CFO Remarks" per task.
 *   Business Head - on a Manager's project: every task, remarks only.
 *   Admin         - every task, view only.
 *   Member        - their own tasks in the project, added and updated like
 *                   My Tasks; new assignments are highlighted and marked seen.
 */
const ProjectDetails = () => {
  const { projectId } = useParams();
  const dispatch = useDispatch();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [newTaskIds, setNewTaskIds] = useState(() => new Set());

  // Edit name / description.
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ projectName: "", description: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Add / remove members.
  const [adding, setAdding] = useState(false);
  const [memberOptions, setMemberOptions] = useState([]);
  const [pickedIds, setPickedIds] = useState([]);
  const [memberError, setMemberError] = useState("");
  const [memberSaving, setMemberSaving] = useState(false);
  const [removing, setRemoving] = useState(null);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let ignore = false;

    getProject(projectId)
      .then((result) => {
        if (ignore) return;
        setData(result);
        setError("");

        // A member's own new assignments: highlight and mark seen, as on
        // My Tasks.
        if (!result.seesAllTasks) {
          const unseenIds = (result.tasks || [])
            .filter((task) => !task.IsSeenByUser && task.CanEditStatus)
            .map((task) => task.TaskID);
          if (unseenIds.length > 0) {
            setNewTaskIds((current) => new Set([...current, ...unseenIds]));
            markTasksSeen(unseenIds)
              .then((seen) => dispatch(taskUnseenCountReceived(seen?.unseenCount)))
              .catch(() => {
                // Stays unseen; it is marked on the next visit.
              });
          }
        }
      })
      .catch((err) => {
        if (!ignore) setError(getTaskApiError(err, "Failed to load the project.").message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [projectId, reloadKey, dispatch]);

  const project = data?.project;
  const members = useMemo(() => data?.members || [], [data]);
  const tasks = useMemo(() => data?.tasks || [], [data]);
  const canManage = Boolean(data?.canManage);

  const openCount = tasks.filter((t) => t.Status !== "Done").length;
  const overdueCount = tasks.filter((t) => t.IsOverdue).length;

  const startEdit = () => {
    setForm({ projectName: project.ProjectName || "", description: project.Description || "" });
    setFormError("");
    setEditing(true);
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    const projectName = form.projectName.trim();
    if (!projectName) {
      setFormError("Project Name is required.");
      return;
    }
    try {
      setSaving(true);
      setData(await updateProject(projectId, { projectName, description: form.description.trim() }));
      setEditing(false);
      toast.success("Project updated.");
    } catch (err) {
      setFormError(apiErrorText(err, "Failed to update the project."));
    } finally {
      setSaving(false);
    }
  };

  const startAdding = async () => {
    setAdding(true);
    setPickedIds([]);
    setMemberError("");
    try {
      setMemberOptions((await getProjectMemberOptions()) || []);
    } catch (err) {
      setMemberError(getTaskApiError(err, "Failed to load employees.").message);
    }
  };

  const memberIds = useMemo(() => new Set(members.map((m) => m.UserID)), [members]);
  const addableOptions = memberOptions.filter((user) => !memberIds.has(user.UserID));

  const submitMembers = async () => {
    if (pickedIds.length === 0) {
      setMemberError("Select at least one member to add.");
      return;
    }
    try {
      setMemberSaving(true);
      const result = await addProjectMembers(projectId, pickedIds);
      setData(result);
      setAdding(false);
      const added = (result?.added || 0) + (result?.reactivated || 0);
      toast.success(`${added} ${added === 1 ? "member" : "members"} added.`);
    } catch (err) {
      setMemberError(apiErrorText(err, "Failed to add members."));
    } finally {
      setMemberSaving(false);
    }
  };

  const confirmRemove = async () => {
    try {
      setMemberSaving(true);
      setData(await removeProjectMember(projectId, removing.UserID));
      toast.success(`${removing.FullName} removed from the project. Their tasks stay listed.`);
      setRemoving(null);
    } catch (err) {
      toast.error(apiErrorText(err, "Failed to remove the member."));
    } finally {
      setMemberSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <TaskWorkbookFrame barSubtitle="Projects" title="Project">
        <p className="border border-[#aeb9cc] px-4 py-8 text-center text-sm text-slate-500">Loading project...</p>
      </TaskWorkbookFrame>
    );
  }

  if (!project) {
    return (
      <TaskWorkbookFrame barSubtitle="Projects" title="Project">
        <div className="border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error || "Project not found."}</div>
        <Link to="/tasks/projects" className="mt-4 inline-block text-sm font-semibold text-[#2c3e82] hover:underline">
          ← Back to Projects
        </Link>
      </TaskWorkbookFrame>
    );
  }

  const sheetEmployee = { UserID: `project-${project.ProjectID}`, FullName: project.ProjectName };
  // Creator, Business Head or Admin: every task, "All members" tasks
  // grouped. Otherwise the member's own tasks.
  const viewsAll = Boolean(data?.seesAllTasks);
  const canAdd = canManage ? members.length > 0 : !viewsAll && Boolean(data?.canAddOwnTasks);

  return (
    <TaskWorkbookFrame
      barSubtitle="Projects"
      badge="PROJECT"
      title={project.ProjectName}
      description={project.Description || (canManage ? "No description." : "")}
      actions={
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Link to="/tasks/projects" className="font-semibold text-slate-600 hover:text-[#2c3e82]">← Projects</Link>
          <span className="text-slate-600"><strong className="text-[#2c3e82]">{openCount}</strong> open</span>
          {overdueCount > 0 && <span className="text-[#b3403f]"><strong>{overdueCount}</strong> overdue</span>}
          {canManage && !editing && (
            <button type="button" onClick={startEdit} className={taskSecondaryButtonClass}>Edit Project</button>
          )}
        </div>
      }
      footer={
        canManage
          ? "Assigned To = one member or All members (a separate copy for each current member; members added later don't get it). Each member updates their own Status and User's Remarks. Expand an All members task to see each member's copy and add Manager / CFO Remarks per member."
          : viewsAll
            ? "Every task in this project. Expand an All members task to see each member's copy."
            : "On tasks assigned to you, you can change only Status and User's Remarks. These tasks also appear in My Tasks."
      }
    >
      {editing && (
        <form onSubmit={submitEdit} className="mb-6 border border-[#cbd4e2] bg-[#f4f6fa] p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label htmlFor="edit-project-name" className={labelClass}>Project Name *</label>
              <input
                id="edit-project-name"
                type="text"
                value={form.projectName}
                maxLength={PROJECT_NAME_MAX}
                onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
                disabled={saving}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="edit-project-description" className={labelClass}>Description</label>
              <textarea
                id="edit-project-description"
                rows={3}
                value={form.description}
                maxLength={PROJECT_DESCRIPTION_MAX}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                disabled={saving}
                className={`${inputClass} resize-y`}
              />
            </div>
          </div>
          {formError && <p className="mt-3 text-xs font-medium text-[#b3403f]">{formError}</p>}
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className={cancelButtonClass}>Cancel</button>
            <button type="submit" disabled={saving} className={primaryButtonClass}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      )}

      {/* Members */}
      <div className="mb-6 border border-[#cbd4e2] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#cbd4e2] bg-[#e5eaf3] px-3 py-2">
          <p className="text-sm font-bold text-[#30415f]">Members ({members.length})</p>
          {canManage && !adding && (
            <button type="button" onClick={startAdding} className="cursor-pointer text-xs font-semibold text-[#2c3e82] hover:underline">
              + Add members
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 p-3">
          {members.length === 0 ? (
            <p className="text-xs text-slate-500">No members yet.</p>
          ) : (
            members.map((member) => (
              <span
                key={member.UserID}
                className="inline-flex items-center gap-2 border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-[#2c3e82]"
              >
                <span className="font-semibold">{member.FullName}</span>
                {member.DepartmentName && <span className="text-slate-500">{member.DepartmentName}</span>}
                {!member.UserIsActive && <span className="text-[10px] text-slate-500">(inactive user)</span>}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setRemoving(member)}
                    aria-label={`Remove ${member.FullName}`}
                    className="cursor-pointer font-bold text-[#b3403f] hover:text-red-800"
                  >
                    ×
                  </button>
                )}
              </span>
            ))
          )}
        </div>
        {adding && (
          <div className="border-t border-[#cbd4e2] bg-[#f4f6fa] p-3">
            <ProjectMemberPicker options={addableOptions} selected={pickedIds} onChange={setPickedIds} disabled={memberSaving} />
            {memberError && <p className="mt-2 text-xs font-medium text-[#b3403f]">{memberError}</p>}
            <div className="mt-3 flex justify-end gap-3">
              <button type="button" onClick={() => setAdding(false)} disabled={memberSaving} className={cancelButtonClass}>Cancel</button>
              <button type="button" onClick={submitMembers} disabled={memberSaving} className={primaryButtonClass}>
                {memberSaving ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
      )}

      <TaskSheet
        // Edits on another project don't carry over.
        key={project.ProjectID}
        mode={viewsAll ? "assign" : "own"}
        project={{ ProjectID: project.ProjectID, members }}
        groups={[{ employee: sheetEmployee, tasks, canAdd }]}
        blankRows={viewsAll ? 2 : 3}
        showGroupHeaders={false}
        newTaskIds={newTaskIds}
        onSaved={reload}
      />

      {removing && (
        <ConfirmDialog
          title="Remove member?"
          message={`${removing.FullName} will be removed from "${project.ProjectName}". Their existing tasks stay as they are and stay visible on this page.`}
          confirmLabel="Remove"
          busyLabel="Removing..."
          tone="danger"
          busy={memberSaving}
          onConfirm={confirmRemove}
          onCancel={() => setRemoving(null)}
        />
      )}
    </TaskWorkbookFrame>
  );
};

export default ProjectDetails;
