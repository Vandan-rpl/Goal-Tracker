import api from './api';

export const getTeamMembers = async () => {
    try {
        const response = await api.get('/teams/members');
        return response.data;
    } catch (error) {
        console.error("Error fetching team members:", error);
        return { success: false, data: [] };
    }
};

export const getUserGoalsByManager = async (userId) => {
    try {
        const response = await api.get(`/teams/user-goals/${userId}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching user goals:", error);
        return { success: false, data: [] };
    }
};

export const updateGoalStatus = async (goalId, goalStatus) => {
    try {
        const response = await api.put(`/teams/goal-status/${goalId}`, { goalStatus });
        return response.data;
    } catch (error) {
        console.error("Error updating goal status:", error);
        return { success: false };
    }
};