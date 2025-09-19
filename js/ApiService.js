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
                // Check for token expiration
                if (this.isTokenExpired(response, data)) {
                    console.log('Token expired detected, handling authentication error');
                    this.handleAuthError();
                    return {
                        success: false,
                        error: 'Session expired. Please log in again.',
                        status: response.status,
                        isTokenExpired: true
                    };
                }
                
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return {
                success: true,
                data: data,
                status: response.status
            };
        } catch (error) {
            console.error('API request failed:', error);
            
            // Check if error indicates token expiration
            if (this.isTokenExpiredError(error)) {
                console.log('Token expiration error detected');
                this.handleAuthError();
                return {
                    success: false,
                    error: 'Session expired. Please log in again.',
                    status: 401,
                    isTokenExpired: true
                };
            }
            
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
     * Check if response indicates token expiration
     */
    isTokenExpired(response, data) {
        // Check HTTP status codes that typically indicate authentication issues
        if (response.status == 401 || response.status == 500) {
            return true;
        }
        
        // Check response data for token expiration indicators
        if (data && typeof data === 'object') {
            const message = (data.message || data.error || '').toLowerCase();
            return message.includes('token') && 
                   (message.includes('expired') || message.includes('invalid') || message.includes('expire'));
        }
        
        return false;
    }

    /**
     * Check if error indicates token expiration
     */
    isTokenExpiredError(error) {
        if (!error) return false;
        
        const message = error.message.toLowerCase();
        return message.includes('unauthorized') || 
               message.includes('401') || 
               message.includes('token') && 
               (message.includes('expired') || message.includes('invalid'));
    }

    /**
     * Handle authentication errors
     */
    handleAuthError() {
        console.log('Handling authentication error - clearing user data and redirecting to login');
        
        // Clear user data
        localStorage.removeItem(API_CONFIG.STORAGE_KEYS.USER_DATA);
        
        // Show notification to user
        this.showTokenExpiredNotification();
        
        // Redirect to login after a short delay
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }

    /**
     * Show token expired notification
     */
    showTokenExpiredNotification() {
        const notification = document.createElement('div');
        notification.className = 'token-expired-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #f59e0b;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 3000;
            max-width: 400px;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <div style="font-weight: bold; margin-bottom: 0.25rem;">Session Expired</div>
                    <div style="font-size: 0.9rem;">Your session has expired. Redirecting to login...</div>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Auto remove after delay
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }
}
