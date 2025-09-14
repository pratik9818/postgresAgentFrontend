/**
 * Constants and configuration for the ChatGPT Clone application
 */
const API_CONFIG = {
    // Base API URL
    BASE_URL: 'http://localhost:3000',
    
    // API Endpoints
    ENDPOINTS: {
        CONVERSATION: '/api/conversation',
        AI_CHAT: '/api/agent/user/chat',
        SSE_JOB: '/api/agent/sse/job',
        // Add more endpoints here as needed
        // MESSAGES: '/api/messages',
        // USER: '/api/user'
    },
    
    // Storage Keys
    STORAGE_KEYS: {
        USER_DATA: 'data',
        CHATS: 'chatgpt_clone_chats'
    },
    
    // Default Values
    DEFAULTS: {
        CONVERSATION_NAME: 'New Chat',
        MAX_MESSAGE_LENGTH: 4000,
        TYPING_DELAY: 1000,
        CHATS_PER_PAGE: 30
    },
    
    // HTTP Headers
    HEADERS: {
        CONTENT_TYPE: 'application/json',
        AUTHORIZATION: 'Authorization'
    }
};

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}
