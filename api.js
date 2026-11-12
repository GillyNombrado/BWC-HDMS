// api.js - Centralized Local API Service for BWC-HDMS
const API_BASE_URL = "http://127.0.0.1:5000/api";

const api = {
    // Generic GET request
    async get(endpoint) {
        try {
            const response = await fetch(`${API_BASE_URL}/${endpoint}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn(`API GET failed for ${endpoint}. Falling back to local/mock state.`, error);
            return null;
        }
    },

    // Generic POST request
    async post(endpoint, data) {
        try {
            const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn(`API POST failed for ${endpoint}.`, error);
            throw error;
        }
    }
};