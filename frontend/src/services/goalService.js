import axios from 'axios';

const API_URL = 'http://localhost:5000/api/goals';

// Get goals based on logged-in user role
export const getGoals = async (token) => {
    const response = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};