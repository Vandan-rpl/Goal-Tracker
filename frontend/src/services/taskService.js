import api from './api';

// Task Tracker API (backend: /api/v1/tasks). Like ideaService these let
// errors propagate, so pages can show the backend's message; use
// getTaskApiError() to read it.

// { isBusinessHead, canViewAll, hasDirectReports, hasProjects, unseenCount }
export const getTaskAccess = async () => {
    const response = await api.get('/tasks/access');
    return response.data.data;
};

export const getTaskUnseenCount = async () => {
    const response = await api.get('/tasks/unseen-count');
    return response.data.data.count;
};

// List params (blank ones are ignored by the backend): status, priority,
// dueFrom, dueTo (YYYY-MM-DD), source (self | assigned), employeeId (team,
// all), department (all). With no status, Done tasks older than 30 days are
// left out.
export const getMyTasks = async (params) => {
    const response = await api.get('/tasks/my', { params });
    return response.data.data;
};

// Returns { updated, unseenCount }.
export const markTasksSeen = async (taskIds) => {
    const response = await api.post('/tasks/my/mark-seen', { taskIds });
    return response.data.data;
};

export const getTeamTasks = async (params) => {
    const response = await api.get('/tasks/team', { params });
    return response.data.data;
};

// { employees }
export const getTeamTaskFilterOptions = async () => {
    const response = await api.get('/tasks/team/filter-options');
    return response.data.data;
};

export const getAllTasks = async (params) => {
    const response = await api.get('/tasks/all', { params });
    return response.data.data;
};

// { employees, departments }
export const getAllTaskFilterOptions = async () => {
    const response = await api.get('/tasks/all/filter-options');
    return response.data.data;
};

// All Tasks Employees view: every active user, with or without tasks
// (UserID, EmployeeCode, FullName, Designation, DepartmentName, OpenCount,
// OverdueCount, DoneRecentCount, AssignedOpenCount).
export const getEmployeeTaskSummary = async () => {
    const response = await api.get('/tasks/all/employees');
    return response.data.data;
};

// Active users for Assign Task (UserID, EmployeeCode, FullName, Designation,
// DepartmentName).
export const getAssignableEmployees = async () => {
    const response = await api.get('/tasks/employees');
    return response.data.data;
};

// { taskName, priority, dueDate, status, userRemarks }
export const createTask = async (task) => {
    const response = await api.post('/tasks', task);
    return response.data.data;
};

// Only send the fields that changed; the backend refuses (403) any field
// the user may not change.
export const updateTask = async (taskId, changes) => {
    const response = await api.put(`/tasks/${taskId}`, changes);
    return response.data.data;
};

export const deleteTask = async (taskId) => {
    const response = await api.delete(`/tasks/${taskId}`);
    return response.data.data;
};

// Business Head. Both return { task, mailSent, mailWarning }; mailWarning
// is set when the change was saved but the email could not be sent.
export const assignTask = async ({ employeeId, taskName, priority, dueDate, cfoRemarks }) => {
    const response = await api.post('/tasks/assign', { employeeId, taskName, priority, dueDate, cfoRemarks });
    return response.data.data;
};

export const submitCFORemarks = async (taskId, cfoRemarks) => {
    const response = await api.post(`/tasks/${taskId}/cfo-remarks`, { cfoRemarks });
    return response.data.data;
};

// Projects. Business Head / Admin get every project, members their own:
// { canManage, projects: [{ ProjectID, ProjectName, Description,
// MemberCount, TaskCount, OpenCount, OverdueCount, ... }] }.
export const getProjects = async () => {
    const response = await api.get('/tasks/projects');
    return response.data.data;
};

// Active users the Business Head can add as members.
export const getProjectMemberOptions = async () => {
    const response = await api.get('/tasks/projects/member-options');
    return response.data.data;
};

// The project calls below return the project page data:
// { project, members, tasks, canManage, canAddOwnTasks } (addMembers also
// { added, reactivated, already }).
export const createProject = async ({ projectName, description, memberIds }) => {
    const response = await api.post('/tasks/projects', { projectName, description, memberIds });
    return response.data.data;
};

export const getProject = async (projectId) => {
    const response = await api.get(`/tasks/projects/${projectId}`);
    return response.data.data;
};

export const updateProject = async (projectId, { projectName, description }) => {
    const response = await api.put(`/tasks/projects/${projectId}`, { projectName, description });
    return response.data.data;
};

export const addProjectMembers = async (projectId, userIds) => {
    const response = await api.post(`/tasks/projects/${projectId}/members`, { userIds });
    return response.data.data;
};

export const removeProjectMember = async (projectId, userId) => {
    const response = await api.delete(`/tasks/projects/${projectId}/members/${userId}`);
    return response.data.data;
};

// Member: own task in the project, same fields as createTask.
export const createProjectTask = async (projectId, task) => {
    const response = await api.post(`/tasks/projects/${projectId}/tasks`, task);
    return response.data.data;
};

// Business Head. assignTo = a member's UserID or "all". Returns
// { assignmentGroupId, assignedCount, mailSent, mailWarning }.
export const assignProjectTask = async (projectId, { assignTo, responsiblePersonId, taskName, priority, dueDate, cfoRemarks }) => {
    const response = await api.post(`/tasks/projects/${projectId}/assign`, {
        assignTo, responsiblePersonId, taskName, priority, dueDate, cfoRemarks,
    });
    return response.data.data;
};

// Business Head: an "All members" task, every copy at once. Send only the
// changed fields (taskName, priority, dueDate, responsiblePersonId).
export const updateProjectGroup = async (projectId, groupId, changes) => {
    const response = await api.put(`/tasks/projects/${projectId}/groups/${groupId}`, changes);
    return response.data.data;
};

export const deleteProjectGroup = async (projectId, groupId) => {
    const response = await api.delete(`/tasks/projects/${projectId}/groups/${groupId}`);
    return response.data.data;
};

// { status, message, details } from a failed request. `details` holds the
// backend's per-field validation messages, if any.
export const getTaskApiError = (error, fallback = 'Something went wrong. Please try again.') => {
    const body = error?.response?.data;
    const details = Array.isArray(body?.errors) ? body.errors.filter(Boolean) : [];

    return {
        status: error?.response?.status,
        message: body?.message || (error?.response ? fallback : 'Unable to reach the server. Please check your connection.'),
        details,
    };
};
