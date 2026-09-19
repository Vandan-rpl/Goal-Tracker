import axios from 'axios';
import api from './api';

const API_URL = 'http://localhost:5000/api/goals';

// Get goals based on logged-in user role
export const getGoals = async (token) => {
    const response = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

export const getGoalHistory = async (goalId) => {
  const response = await api.get(`/goals/${goalId}/history`);
  return response.data;
};
