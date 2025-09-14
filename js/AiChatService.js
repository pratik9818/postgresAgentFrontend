/**
 * AiChatService class to handle AI chat backend communication
 */
class AiChatService {
    constructor() {
        this.baseURL = API_CONFIG.BASE_URL;
        this.apiService = new ApiService();
    }

    /**
     * Send a message to the AI chat backend (job-based)
     * @param {string} query - The user's message/query
     * @param {string} conversationId - The chat/conversation ID
     * @returns {Promise<Object>} Response with job ID from the AI backend
     */
    async sendMessage(query, conversationId) {
        try {
            if (!query || !conversationId) {
                throw new Error('Query and conversationId are required');
            }

            const endpoint = API_CONFIG.ENDPOINTS.AI_CHAT;
            const requestBody = {
                query: query,
                conversationId: conversationId
            };

            console.log('Sending message to AI backend:', {
                endpoint: endpoint,
                requestBody: requestBody,
                fullUrl: `${this.baseURL}${endpoint}`
            });

            const response = await this.apiService.makeRequest(endpoint, {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });

            console.log('AI backend response:', response);

            if (response.success) {
                // Extract job ID from response - check multiple possible field names
                const jobId = response.data.jobid || response.data.jobId || response.data.job_id || response.data.id;
                
                if (!jobId) {
                    console.error('Available response data fields:', Object.keys(response.data));
                    throw new Error('No job ID received from backend');
                }

                return {
                    success: true,
                    jobId: jobId,
                    data: response.data,
                    message: 'Message queued for processing'
                };
            } else {
                throw new Error(response.error || 'Failed to send message to AI');
            }
        } catch (error) {
            console.error('Error sending message to AI:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Send a message and get job ID for SSE tracking
     * @param {string} query - The user's message/query
     * @param {string} conversationId - The chat/conversation ID
     * @returns {Promise<Object>} Job response with jobId for SSE tracking
     */
    async getAiResponse(query, conversationId) {
        try {
            const response = await this.sendMessage(query, conversationId);
            
            if (response.success) {
                return {
                    success: true,
                    jobId: response.jobId,
                    message: response.message,
                    fullData: response.data
                };
            } else {
                return {
                    success: false,
                    error: response.error,
                    jobId: null
                };
            }
        } catch (error) {
            console.error('Error getting AI response:', error);
            return {
                success: false,
                error: error.message,
                jobId: null
            };
        }
    }

    /**
     * Check if the AI service is available
     * @returns {Promise<boolean>} True if service is available
     */
    async isServiceAvailable() {
        try {
            // You can implement a health check endpoint here if available
            // For now, we'll assume it's available if we can make a request
            return true;
        } catch (error) {
            console.error('AI service not available:', error);
            return false;
        }
    }

    /**
     * Handle AI response errors
     * @param {Object} error - Error object
     * @returns {string} User-friendly error message
     */
    handleError(error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
            return 'Unable to connect to AI service. Please check your internet connection.';
        } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
            return 'Authentication required. Please log in again.';
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
            return 'Too many requests. Please wait a moment before trying again.';
        } else {
            return 'An error occurred while processing your request. Please try again.';
        }
    }
}
