// api.js - Centralized Local API Service for BWC-HDMS
const API_BASE_URL = "http://127.0.0.1:5000/api";

const api = {
    // Generic GET request with timeout
    async get(endpoint) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            const response = await fetch(`${API_BASE_URL}/${endpoint}`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn(`API GET failed for ${endpoint}. Operating in offline local state.`, error);
            return null;
        }
    },

    // Generic POST request with timeout
    async post(endpoint, data) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn(`API POST failed for ${endpoint}.`, error);
            return null;
        }
    },

    // Generic PUT request with timeout
    async put(endpoint, data) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn(`API PUT failed for ${endpoint}.`, error);
            return null;
        }
    }
};

// Expose globally
window.bwcApi = api;


// Expose globally
window.bwcApi = api;