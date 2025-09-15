/**
 * ApiService class to handle all API communications
 */
class ApiService {
    constructor() {
        this.baseURL = API_CONFIG.BASE_URL;
    }

    /**
     * Get authorization token from localStorage
     */
    getAuthToken() {
        try {
            const userData = localStorage.getItem(API_CONFIG.STORAGE_KEYS.USER_DATA);
            
            if (userData) {
                const user = JSON.parse(userData);
            console.log(user);

                return user.token.accessToken || null;
            }
        } catch (error) {
            console.error('Error getting auth token:', error);
        }
        return null;
    }

    /**
     * Get default headers with authorization
     */
    getHeaders() {
        const headers = {
            'Content-Type': API_CONFIG.HEADERS.CONTENT_TYPE
        };

        const token = this.getAuthToken();
        if (token) {
            headers[API_CONFIG.HEADERS.AUTHORIZATION] = `Bearer ${token}`;
        }

        return headers;
    }

    /**
     * Make HTTP request
     */
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const defaultOptions = {
            headers: this.getHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, defaultOptions);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return {
                success: true,
                data: data,
                status: response.status
            };
        } catch (error) {
            console.error('API request failed:', error);
            return {
                success: false,
                error: error.message,
                status: error.status || 0
            };
        }
    }

    /**
     * Create a new conversation
     */
    async createConversation() {
        return await this.makeRequest(API_CONFIG.ENDPOINTS.CONVERSATION, {
            method: 'POST'
        });
    }

    /**
     * Get conversations with pagination
     */
    async getConversations(skipValue = 0) {
        const endpoint = `${API_CONFIG.ENDPOINTS.CONVERSATION}?skipValue=${skipValue}`;
        return await this.makeRequest(endpoint, {
            method: 'GET'
        });
    }

    /**
     * Get a specific conversation
     */
    async getConversation(conversationId) {
        return await this.makeRequest(`${API_CONFIG.ENDPOINTS.CONVERSATION}/${conversationId}`, {
            method: 'GET'
        });
    }

    /**
     * Update conversation name
     */
    async updateConversationName(conversationId, conversationName) {
        return await this.makeRequest(API_CONFIG.ENDPOINTS.CONVERSATION, {
            method: 'PUT',
            body: JSON.stringify({ 
                conversationId: conversationId,
                conversationName: conversationName 
            })
        });
    }

    /**
     * Delete a conversation
     */
    async deleteConversation(conversationId) {
        return await this.makeRequest(`${API_CONFIG.ENDPOINTS.CONVERSATION}/${conversationId}`, {
            method: 'DELETE'
        });
    }

    /**
     * Get chat messages for a specific conversation with pagination
     * @param {string} conversationId - The conversation ID
     * @param {number} skipValue - Number of messages to skip for pagination
     * @returns {Promise<Object>} Response with chat messages
     */
    async getChats(conversationId, skipValue = 0) {
        const endpoint = `/api/chats?conversationId=${conversationId}&skipValue=${skipValue}`;
        return await this.makeRequest(endpoint, {
            method: 'GET'
        });
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.getAuthToken() !== null;
    }

    /**
     * Get database data for a specific message
     * @param {string} mongoId - The MongoDB document ID
     * @returns {Promise<Object>} Response with database data
     */
    async getDbData(mongoId) {
        const endpoint = `/api/chat/dbdata?chatId=${mongoId}`;
        return await this.makeRequest(endpoint, {
            method: 'GET'
        });
    }

    /**
     * Handle authentication errors
     */
    handleAuthError() {
        // Clear user data and redirect to login
        localStorage.removeItem(API_CONFIG.STORAGE_KEYS.USER_DATA);
        window.location.href = '/';
    }
}
