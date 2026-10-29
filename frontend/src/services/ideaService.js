import api from './api';

// Innovation Ideas API (backend: /api/v1/ideas). Unlike teamService these
// let errors propagate, so pages can show the backend's message; use
// getIdeaApiError() to read it.

export const getIdeaPurposes = async () => {
    const response = await api.get('/ideas/purposes');
    return response.data.data;
};

export const getIdeaLeads = async () => {
    const response = await api.get('/ideas/leads');
    return response.data.data;
};

export const getMyIdeas = async () => {
    const response = await api.get('/ideas/my');
    return response.data.data;
};

export const getAssignedIdeas = async () => {
    const response = await api.get('/ideas/assigned');
    return response.data.data;
};

// Team Ideas / All Ideas: server-side filters, sorting and paging. `params`
// are passed through as the query string (search, status, purpose,
// overdueOnly, submittedFrom, submittedTo, memberId | department, leadId,
// sortBy, sortDir, page, pageSize). Returns { items, total, page, pageSize,
// totalPages, sortBy, sortDir, counts }.
export const getTeamIdeas = async (params) => {
    const response = await api.get('/ideas/team', { params });
    return response.data.data;
};

export const getTeamIdeaFilterOptions = async () => {
    const response = await api.get('/ideas/team/filter-options');
    return response.data.data;
};

export const getAllIdeas = async (params) => {
    const response = await api.get('/ideas/all', { params });
    return response.data.data;
};

export const getAllIdeaFilterOptions = async () => {
    const response = await api.get('/ideas/all/filter-options');
    return response.data.data;
};

// Lead actions. Each returns the updated idea (same shape as getIdea).
export const acceptIdea = async (ideaId, { timelineDays, remark }) => {
    const response = await api.post(`/ideas/${ideaId}/accept`, { timelineDays, remark });
    return response.data.data;
};

export const rejectIdea = async (ideaId, { remark }) => {
    const response = await api.post(`/ideas/${ideaId}/reject`, { remark });
    return response.data.data;
};

export const startIdeaImplementation = async (ideaId, { remark }) => {
    const response = await api.post(`/ideas/${ideaId}/start-implementation`, { remark });
    return response.data.data;
};

export const markIdeaImplemented = async (ideaId, { remark }) => {
    const response = await api.post(`/ideas/${ideaId}/implement`, { remark });
    return response.data.data;
};

export const extendIdeaTimeline = async (ideaId, { additionalDays, reason }) => {
    const response = await api.post(`/ideas/${ideaId}/extend-timeline`, { additionalDays, reason });
    return response.data.data;
};

export const getIdea = async (ideaId) => {
    const response = await api.get(`/ideas/${ideaId}`);
    return response.data.data;
};

export const createIdeaDraft = async (idea) => {
    const response = await api.post('/ideas', idea);
    return response.data.data;
};

export const updateIdeaDraft = async (ideaId, idea) => {
    const response = await api.put(`/ideas/${ideaId}`, idea);
    return response.data.data;
};

export const deleteIdeaDraft = async (ideaId) => {
    const response = await api.delete(`/ideas/${ideaId}`);
    return response.data.data;
};

export const submitIdea = async (ideaId) => {
    const response = await api.post(`/ideas/${ideaId}/submit`);
    return response.data.data;
};

// { status, message, details } from a failed request. `details` holds the
// backend's per-field validation messages, if any.
export const getIdeaApiError = (error, fallback = 'Something went wrong. Please try again.') => {
    const body = error?.response?.data;
    const details = Array.isArray(body?.errors) ? body.errors.filter(Boolean) : [];

    return {
        status: error?.response?.status,
        message: body?.message || (error?.response ? fallback : 'Unable to reach the server. Please check your connection.'),
        details,
    };
};
