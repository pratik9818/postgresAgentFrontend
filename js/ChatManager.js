/**
 * ChatManager class to handle chat operations
 */
class ChatManager {
    constructor() {
        this.chats = new Map();
        this.currentChatId = null;
        this.storageKey = API_CONFIG.STORAGE_KEYS.CHATS;
        this.apiService = new ApiService();
        this.aiChatService = new AiChatService();
        this.pagination = {
            skipValue: 0,
            hasMore: true,
            isLoading: false
        };
        this.loadChats();
    }

    /**
     * Create a new chat
     */
    async createChat(name = API_CONFIG.DEFAULTS.CONVERSATION_NAME) {
        try {
            // Create conversation on server
            const response = await this.apiService.createConversation();
            
            
            if (response.success) {
                // Handle different possible response structures
                const responseData = response.data;
                let chatId;
                
                // Try different possible field names for the chat ID
                // Check nested data structure first
                if (responseData.data && responseData.data.insertedId) {
                    chatId = responseData.data.insertedId;
                } else if (responseData.insertedId) {
                    chatId = responseData.insertedId;
                } else if (responseData.data && responseData.data.id) {
                    chatId = responseData.data.id;
                } else if (responseData.id) {
                    chatId = responseData.id;
                } else if (responseData.data && responseData.data._id) {
                    chatId = responseData.data._id;
                } else if (responseData._id) {
                    chatId = responseData._id;
                } else {
                    chatId = this.generateChatId();
                }
                
                
                const chat = {
                    id: chatId,
                    name: responseData.name || name,
                    messages: [],
                    createdAt: responseData.createdAt || new Date().toISOString(),
                    updatedAt: responseData.updatedAt || new Date().toISOString(),
                    serverId: chatId // Store server ID for API calls
                };
                
                this.chats.set(chat.id, chat);
                this.saveChats();
                
                
                // Trigger event
                window.dispatchEvent(new CustomEvent('chatCreated', {
                    detail: { chat: chat }
                }));
                
                return chat;
            } else {
                throw new Error(response.error || 'Failed to create conversation');
            }
        } catch (error) {
            console.error('Error creating chat:', error);
            
            // Fallback to local creation if API fails
            const chatId = this.generateChatId();
            const chat = {
                id: chatId,
                name: name,
                messages: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isLocal: true // Mark as local-only
            };
            
            this.chats.set(chatId, chat);
            this.saveChats();
            
            // Trigger event
            window.dispatchEvent(new CustomEvent('chatCreated', {
                detail: { chat: chat }
            }));
            
            return chat;
        }
    }

    /**
     * Get a chat by ID
     */
    getChat(chatId) {
        return this.chats.get(chatId);
    }

    /**
     * Get all chats
     */
    getAllChats() {
        return Array.from(this.chats.values()).sort((a, b) => 
            new Date(b.updatedAt) - new Date(a.updatedAt)
        );
    }

    /**
     * Fetch chats from server with pagination
     */
    async fetchChats(loadMore = false) {
        if (this.pagination.isLoading) {
            return;
        }

        // For initial load, always allow it even if hasMore is false
        if (loadMore && !this.pagination.hasMore) {
            return;
        }

        this.pagination.isLoading = true;
        
        try {
            const skipValue = loadMore ? this.pagination.skipValue : 0;
            const response = await this.apiService.getConversations(skipValue);
            
            
            if (response.success && response.data) {
                // Handle nested data structure: response.data.data contains the actual chats
                let serverChats = [];
                if (Array.isArray(response.data)) {
                    serverChats = response.data;
                } else if (response.data.data && Array.isArray(response.data.data)) {
                    serverChats = response.data.data;
                } else if (response.data.chats && Array.isArray(response.data.chats)) {
                    serverChats = response.data.chats;
                }
                
                
                // Process and add chats - merge with existing local data
                serverChats.forEach(serverChat => {
                    const chatId = serverChat._id || serverChat.id;
                    const existingChat = this.chats.get(chatId);
                    
                    if (existingChat) {
                        // Merge server data with existing local chat
                        existingChat.name = serverChat.name || existingChat.name;
                        existingChat.createdAt = serverChat.createdAt || existingChat.createdAt;
                        existingChat.updatedAt = serverChat.updatedAt || existingChat.updatedAt;
                        existingChat.serverId = chatId;
                        // Keep existing messages - don't overwrite with server messages
                        // Server messages will be loaded separately via loadConversations
                    } else {
                        // Create new chat from server data
                        const chat = {
                            id: chatId,
                            name: serverChat.name || 'Untitled Chat',
                            messages: [], // Don't load messages here - they'll be loaded separately
                            createdAt: serverChat.createdAt || new Date().toISOString(),
                            updatedAt: serverChat.updatedAt || new Date().toISOString(),
                            serverId: chatId
                        };
                        
                        this.chats.set(chat.id, chat);
                    }
                });
                
                // Update pagination state
                this.pagination.skipValue = skipValue + serverChats.length;
                this.pagination.hasMore = serverChats.length === API_CONFIG.DEFAULTS.CHATS_PER_PAGE;
                
                
                this.saveChats();
                
                // Trigger event
                window.dispatchEvent(new CustomEvent('chatsLoaded', {
                    detail: { 
                        chats: serverChats, 
                        loadMore: loadMore,
                        hasMore: this.pagination.hasMore
                    }
                }));
                
                const result = {
                    success: true,
                    chats: serverChats,
                    hasMore: this.pagination.hasMore
                };
                
                return result;
            } else {
                throw new Error(response.error || 'Failed to fetch chats');
            }
        } catch (error) {
            console.error('Error fetching chats:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.pagination.isLoading = false;
        }
    }

    /**
     * Update chat name
     */
    async updateChatName(chatId, newName) {
        const chat = this.chats.get(chatId);
        if (chat) {
            try {
                // Call API to update conversation name
                const response = await this.apiService.updateConversationName(chatId, newName);
                
                if (response.success) {
                    // Update local chat data
                    chat.name = newName;
                    chat.updatedAt = new Date().toISOString();
                    this.saveChats();
                    
                    // Trigger event
                    window.dispatchEvent(new CustomEvent('chatUpdated', {
                        detail: { chat: chat }
                    }));
                    
                    return true;
                } else {
                    console.error('Failed to update conversation name:', response.error);
                    // Show error message to user
                    this.showError('Failed to update chat name. Please try again.');
                    return false;
                }
            } catch (error) {
                console.error('Error updating conversation name:', error);
                this.showError('Failed to update chat name. Please try again.');
                return false;
            }
        }
        return false;
    }

    /**
     * Delete a chat
     */
    deleteChat(chatId) {
        if (this.chats.has(chatId)) {
            this.chats.delete(chatId);
            this.saveChats();
            
            // If this was the current chat, clear it and update URL
            if (this.currentChatId === chatId) {
                this.currentChatId = null;
                this.updateURL(null);
            }
            
            // Trigger event
            window.dispatchEvent(new CustomEvent('chatDeleted', {
                detail: { chatId: chatId }
            }));
            
            return true;
        }
        return false;
    }

    /**
     * Add a message to a chat
     */
    addMessage(chatId, content, role = 'user', dbData = null) {
        const chat = this.chats.get(chatId);
        if (chat) {
            // For new messages, we don't have a MongoDB ID yet, so pass null
            const message = new Message(null, content, role, null, dbData, null);
            chat.messages.push(message);
            chat.updatedAt = new Date().toISOString();
            
            // Auto-rename chat if it's the first user message and chat has default name
            if (role === 'user' && chat.messages.filter(m => m.role === 'user').length === 1) {
                this.autoRenameChat(chatId, content);
            }
            
            this.saveChats();
            
            // Save message to server if chat has serverId
            if (chat.serverId && !chat.isLocal) {
                this.saveMessageToServer(chat.serverId, message);
            }
            
            // Trigger event
            window.dispatchEvent(new CustomEvent('messageAdded', {
                detail: { chatId: chatId, message: message }
            }));
            
            return message;
        }
        return null;
    }

    /**
     * Save a message to the server
     * @param {string} conversationId - The conversation ID
     * @param {Message} message - The message to save
     */
    async saveMessageToServer(conversationId, message) {
        try {
            // Note: This would require a new API endpoint to save individual messages
            // For now, we'll just log that we would save it
            console.log('Would save message to server:', {
                conversationId: conversationId,
                message: {
                    content: message.content,
                    role: message.role,
                    timestamp: message.timestamp
                }
            });
            
            // TODO: Implement API call to save message to server
            // const response = await this.apiService.saveMessage(conversationId, message);
            // if (!response.success) {
            //     console.error('Failed to save message to server:', response.error);
            // }
        } catch (error) {
            console.error('Error saving message to server:', error);
        }
    }

    /**
     * Update a message in a chat
     */
    updateMessage(chatId, messageId, newContent) {
        const chat = this.chats.get(chatId);
        if (chat) {
            const message = chat.messages.find(m => m.id === messageId);
            if (message) {
                message.content = newContent;
                message.timestamp = new Date().toISOString();
                chat.updatedAt = new Date().toISOString();
                this.saveChats();
                
                // Trigger event
                window.dispatchEvent(new CustomEvent('messageUpdated', {
                    detail: { chatId: chatId, message: message }
                }));
                
                return true;
            }
        }
        return false;
    }

    /**
     * Delete a message from a chat
     */
    deleteMessage(chatId, messageId) {
        const chat = this.chats.get(chatId);
        if (chat) {
            const messageIndex = chat.messages.findIndex(m => m.id === messageId);
            if (messageIndex !== -1) {
                const message = chat.messages[messageIndex];
                chat.messages.splice(messageIndex, 1);
                chat.updatedAt = new Date().toISOString();
                this.saveChats();
                
                // Trigger event
                window.dispatchEvent(new CustomEvent('messageDeleted', {
                    detail: { chatId: chatId, message: message }
                }));
                
                return true;
            }
        }
        return false;
    }

    /**
     * Send a message to AI backend and track via SSE
     * @param {string} chatId - The chat ID
     * @param {string} message - The user message
     * @returns {Promise<Object>} Job response with SSE tracking
     */
    async sendMessageToAI(chatId, message) {
        try {
            const chat = this.chats.get(chatId);
            if (!chat) {
                throw new Error('Chat not found');
            }

            // Add user message to chat
            const userMessage = this.addMessage(chatId, message, 'user');
            
            // Get conversation ID (use serverId if available, otherwise use local ID)
            const conversationId = chat.serverId || chat.id;
            
            // Send to AI backend and get job ID
            const jobResponse = await this.aiChatService.getAiResponse(message, conversationId);
            
            if (jobResponse.success && jobResponse.jobId) {
                // Start SSE connection to track job progress
                this.trackJobWithSSE(chatId, jobResponse.jobId, userMessage);
                
                return {
                    success: true,
                    userMessage: userMessage,
                    jobId: jobResponse.jobId,
                    message: jobResponse.message
                };
            } else {
                // Add error message to chat
                const errorMessage = this.addMessage(chatId, `Error: ${jobResponse.error}`, 'system');
                
                return {
                    success: false,
                    userMessage: userMessage,
                    errorMessage: errorMessage,
                    error: jobResponse.error
                };
            }
        } catch (error) {
            console.error('Error sending message to AI:', error);
            
            // Add error message to chat
            const errorMessage = this.addMessage(chatId, `Error: ${error.message}`, 'system');
            
            return {
                success: false,
                error: error.message,
                errorMessage: errorMessage
            };
        }
    }

    /**
     * Track job progress via SSE
     * @param {string} chatId - The chat ID
     * @param {string} jobId - The job ID to track
     * @param {Object} userMessage - The user message object
     */
    trackJobWithSSE(chatId, jobId, userMessage) {
        console.log('Starting SSE tracking for job:', jobId);

        const handlers = {
            onConnect: (data) => {
                console.log('SSE connected for job:', jobId);
                // Optionally show connection status to user
            },

            onProgress: (data) => {
                console.log('Job progress:', jobId, data.progress);
                
                // Generate status message based on progress if not provided
                let status = data.status;
                if (!status) {
                    const progress = data.progress || 0;
                    if (progress < 20) {
                        status = 'Connecting to database...';
                    } else if (progress < 40) {
                        status = 'Querying your data...';
                    } else if (progress < 60) {
                        status = 'Processing results...';
                    } else if (progress < 80) {
                        status = 'Generating response...';
                    } else if (progress < 95) {
                        status = 'Finalizing answer...';
                    } else {
                        status = 'Almost done...';
                    }
                }
                
                // Emit progress update event for UI
                window.dispatchEvent(new CustomEvent('aiProgressUpdate', {
                    detail: { 
                        chatId: chatId, 
                        progress: data.progress || 0,
                        status: status,
                        jobId: jobId
                    }
                }));
            },

            onComplete: (data) => {
                console.log('Job completed:', jobId, data.result);
                
                // Add detailed logging for debugging
                if (data.result) {
                    console.log('Result structure:', {
                        hasToolcalls: !!data.result.toolcalls,
                        hasToolCalls: !!data.result.toolCalls,
                        hasTool_calls: !!data.result.tool_calls,
                        resultKeys: Object.keys(data.result)
                    });
                }
                
                // Check for toolcalls in the response with safe access
                const toolCalls = data.result?.toolcalls || data.result?.toolCalls || data.result?.tool_calls;
                
                if (toolCalls) {
                    console.log('Toolcalls found:', toolCalls);
                }
                
                // Check if this is an error case (response contains error message)
                const isErrorCase = data.result.response && 
                                  (data.result.response.toLowerCase().includes('error') || 
                                   data.result.response.toLowerCase().includes('token limit') ||
                                   data.result.response.toLowerCase().includes('limit reached'));

                if (isErrorCase) {
                    // Error case: Show error message as main response, but preserve dbData for "See Data" button
                    const errorMessage = data.result.response;
                    
                    // Check for dbData in multiple possible locations
                    const dbData = data.result.dbData || data.result.data || data.result.rawData;
                    
                    // Add the error message as the main AI response, but preserve dbData for the button
                    const aiMessage = this.addMessage(chatId, errorMessage, 'assistant', dbData);
                    
                    // Trigger event for UI update (no need for separate error info)
                    window.dispatchEvent(new CustomEvent('aiResponseReceived', {
                        detail: { 
                            chatId: chatId, 
                            userMessage: userMessage,
                            aiMessage: aiMessage,
                            response: errorMessage,
                            toolCalls: toolCalls, // Include toolcalls in event
                            isErrorCase: false // Treat as normal response since we're showing the error as main content
                        }
                    }));
                } else {
                    // Success case: Show the LLM response as main message
                    const aiResponse = data.result.response || 
                                     data.result.message || 
                                     data.result.answer || 
                                     data.result.content ||
                                     data.result;

                    if (aiResponse) {
                        // Add AI response to chat
                        const aiMessage = this.addMessage(chatId, aiResponse, 'assistant', data.result.dbData);
                        
                        // Trigger event for UI update
                        window.dispatchEvent(new CustomEvent('aiResponseReceived', {
                            detail: { 
                                chatId: chatId, 
                                userMessage: userMessage,
                                aiMessage: aiMessage,
                                response: aiResponse,
                                toolCalls: toolCalls, // Include toolcalls in event
                                isErrorCase: false
                            }
                        }));
                    } else {
                        // Handle case where no response is provided
                        const errorMessage = this.addMessage(chatId, 'No response received from AI', 'system');
                        window.dispatchEvent(new CustomEvent('aiResponseError', {
                            detail: { 
                                chatId: chatId, 
                                userMessage: userMessage,
                                errorMessage: errorMessage,
                                error: 'No response received'
                            }
                        }));
                    }
                }
            },

            onError: (data) => {
                console.error('Job failed:', jobId, data.error);
                
                // Add error message to chat
                const errorMessage = this.addMessage(chatId, `AI Error: ${data.error}`, 'system');
                
                // Trigger event for UI update
                window.dispatchEvent(new CustomEvent('aiResponseError', {
                    detail: { 
                        chatId: chatId, 
                        userMessage: userMessage,
                        errorMessage: errorMessage,
                        error: data.error
                    }
                }));
            }
        };

        // Connect to SSE
        window.sseService.connectToJob(jobId, handlers);
    }

    /**
     * Set the current active chat
     */
    setCurrentChat(chatId) {
        
        if (this.chats.has(chatId) || chatId === null) {
            this.currentChatId = chatId;
            
            // Update URL with chat ID
            this.updateURL(chatId);
            
            // Trigger event
            window.dispatchEvent(new CustomEvent('currentChatChanged', {
                detail: { chatId: chatId }
            }));
            
            return true;
        }
        return false;
    }

    /**
     * Get the current active chat
     */
    getCurrentChat() {
        return this.currentChatId ? this.chats.get(this.currentChatId) : null;
    }

    /**
     * Check if there are more chats to load
     */
    hasMoreChats() {
        return this.pagination.hasMore;
    }

    /**
     * Check if currently loading chats
     */
    isLoadingChats() {
        return this.pagination.isLoading;
    }

    /**
     * Reset pagination state
     */
    resetPagination() {
        this.pagination = {
            skipValue: 0,
            hasMore: true,
            isLoading: false
        };
    }

    /**
     * Generate a unique chat ID
     */
    generateChatId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Update URL with chat ID
     */
    updateURL(chatId) {
        const url = new URL(window.location);
        
        
        if (chatId) {
            url.searchParams.set('chat', chatId);
        } else {
            url.searchParams.delete('chat');
        }
        
        
        // Update URL without page reload
        window.history.pushState({ chatId }, '', url);
    }

    /**
     * Get chat ID from URL
     */
    getChatIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('chat');
    }

    /**
     * Load chat from URL on page load
     */
    loadChatFromURL() {
        const chatId = this.getChatIdFromURL();
        
        if (chatId) {
            if (this.chats.has(chatId)) {
                const chat = this.chats.get(chatId);
                
                // If it's a placeholder, try to fetch from server
                if (chat.isPlaceholder) {
                    console.log('Loading placeholder chat from server:', chatId);
                    this.fetchChatFromServer(chatId);
                }
                
                this.setCurrentChat(chatId);
                return true;
            } else {
                // Chat ID exists in URL but not in localStorage
                // This could happen if user has a direct link to a chat
                // Create a placeholder chat and try to fetch from server
                console.log('Chat ID from URL not found in localStorage:', chatId);
                
                // Create a placeholder chat with the server ID
                const placeholderChat = {
                    id: chatId,
                    name: 'Loading...',
                    messages: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    serverId: chatId,
                    isPlaceholder: true
                };
                
                this.chats.set(chatId, placeholderChat);
                this.setCurrentChat(chatId);
                
                // Try to fetch the chat from the server
                this.fetchChatFromServer(chatId);
                
                return true;
            }
        }
        
        return false;
    }

    /**
     * Fetch a specific chat from the server
     * @param {string} chatId - The chat ID to fetch
     */
    async fetchChatFromServer(chatId) {
        try {
            console.log('Fetching chat from server:', chatId);
            
            const response = await this.apiService.getConversation(chatId);
            
            if (response.success && response.data) {
                const serverChat = response.data;
                
                // Update the existing chat with server data
                const existingChat = this.chats.get(chatId);
                if (existingChat) {
                    existingChat.name = serverChat.name || existingChat.name;
                    existingChat.createdAt = serverChat.createdAt || existingChat.createdAt;
                    existingChat.updatedAt = serverChat.updatedAt || existingChat.updatedAt;
                    existingChat.serverId = chatId;
                    existingChat.isPlaceholder = false; // No longer a placeholder
                    
                    // Save updated chat
                    this.saveChats();
                    
                    // Trigger event to update UI
                    window.dispatchEvent(new CustomEvent('chatUpdated', {
                        detail: { chat: existingChat }
                    }));
                    
                    console.log('Chat loaded from server:', existingChat.name);
                }
            } else {
                console.error('Failed to fetch chat from server:', response.error);
            }
        } catch (error) {
            console.error('Error fetching chat from server:', error);
        }
    }

    /**
     * Save chats to localStorage
     */
    saveChats() {
        try {
            const chatsArray = Array.from(this.chats.entries()).map(([id, chat]) => ({
                id: chat.id,
                name: chat.name,
                messages: chat.messages.map(msg => msg.toJSON()),
                createdAt: chat.createdAt,
                updatedAt: chat.updatedAt,
                serverId: chat.serverId, // Save serverId to localStorage
                isLocal: chat.isLocal, // Save local flag
                isPlaceholder: chat.isPlaceholder // Save placeholder flag
            }));
            
            localStorage.setItem(this.storageKey, JSON.stringify(chatsArray));
        } catch (error) {
            console.error('Error saving chats:', error);
        }
    }

    /**
     * Load chats from localStorage
     */
    loadChats() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const chatsArray = JSON.parse(saved);
                this.chats.clear();
                
                chatsArray.forEach(chatData => {
                    const chat = {
                        id: chatData.id,
                        name: chatData.name,
                        messages: chatData.messages.map(msgData => Message.fromJSON(msgData)),
                        createdAt: chatData.createdAt,
                        updatedAt: chatData.updatedAt,
                        serverId: chatData.serverId, // Load serverId from localStorage
                        isLocal: chatData.isLocal, // Load local flag
                        isPlaceholder: chatData.isPlaceholder // Load placeholder flag
                    };
                    this.chats.set(chat.id, chat);
                });
            }
        } catch (error) {
            console.error('Error loading chats:', error);
            this.chats.clear();
        }
    }

    /**
     * Load conversations for a specific chat with lazy loading
     * @param {string} conversationId - The conversation ID
     * @param {boolean} loadMore - Whether to load more messages (for pagination)
     * @returns {Promise<Object>} Result with messages and pagination info
     */
    async loadConversations(conversationId, loadMore = false) {
        if (this.pagination.isLoading) {
            return { success: false, error: 'Already loading' };
        }

        // For initial load, always allow it even if hasMore is false
        if (loadMore && !this.pagination.hasMore) {
            return { success: false, error: 'No more messages to load' };
        }

        this.pagination.isLoading = true;
        
        try {
            const skipValue = loadMore ? this.pagination.skipValue : 0;
            console.log('Making API call to /api/chats with:', { conversationId, skipValue });
            
            const response = await this.apiService.getChats(conversationId, skipValue);
            
            console.log('API response:', response);
            
            if (response.success && response.data) {
                // Handle nested data structure
                let conversationMessages = [];
                if (Array.isArray(response.data)) {
                    conversationMessages = response.data;
                } else if (response.data.data && Array.isArray(response.data.data)) {
                    conversationMessages = response.data.data;
                } else if (response.data.messages && Array.isArray(response.data.messages)) {
                    conversationMessages = response.data.messages;
                }
                
                // Process and format messages
                const formattedMessages = conversationMessages.map(msg => {
                    return {
                        id: msg._id || msg.id,
                        content: msg.content,
                        role: msg.role,
                        createdAt: msg.createdAt,
                        conversationId: msg.conversationId,
                        userId: msg.userId,
                        dbData: msg.dbData, // Include dbData from server
                        mongoId: msg._id // Store MongoDB document ID for API calls
                    };
                });
                
                // Sort messages by creation date (oldest first for conversation flow)
                formattedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                
                // Update pagination state
                this.pagination.skipValue = skipValue + formattedMessages.length;
                this.pagination.hasMore = formattedMessages.length === 30; // Assuming 30 messages per page
                
                // Trigger event for UI update
                window.dispatchEvent(new CustomEvent('conversationsLoaded', {
                    detail: { 
                        conversationId: conversationId,
                        messages: formattedMessages, 
                        loadMore: loadMore,
                        hasMore: this.pagination.hasMore,
                        skipValue: this.pagination.skipValue
                    }
                }));
                
                return {
                    success: true,
                    messages: formattedMessages,
                    hasMore: this.pagination.hasMore,
                    skipValue: this.pagination.skipValue
                };
            } else {
                throw new Error(response.error || 'Failed to load conversations');
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.pagination.isLoading = false;
        }
    }

    /**
     * Load conversations for current chat
     * @param {boolean} loadMore - Whether to load more messages
     * @returns {Promise<Object>} Result with messages and pagination info
     */
    async loadCurrentChatConversations(loadMore = false) {
        const currentChat = this.getCurrentChat();
        if (!currentChat) {
            return { success: false, error: 'No current chat selected' };
        }
        
        const conversationId = currentChat.serverId || currentChat.id;
        return await this.loadConversations(conversationId, loadMore);
    }

    /**
     * Reset conversation pagination for a specific chat
     * @param {string} conversationId - The conversation ID
     */
    resetConversationPagination(conversationId) {
        this.pagination = {
            skipValue: 0,
            hasMore: true,
            isLoading: false
        };
    }

    /**
     * Check if there are more conversation messages to load
     * @returns {boolean} True if there are more messages
     */
    hasMoreConversations() {
        return this.pagination.hasMore;
    }

    /**
     * Check if currently loading conversation messages
     * @returns {boolean} True if loading
     */
    isLoadingConversations() {
        return this.pagination.isLoading;
    }

    /**
     * Setup scroll detection for loading more messages when scrolling up
     * @param {HTMLElement} chatContainer - The chat container element to monitor
     * @param {string} conversationId - The conversation ID to load messages for
     */
    setupScrollDetection(chatContainer, conversationId) {
        if (!chatContainer) {
            console.error('Chat container element not provided');
            return;
        }

        // Remove existing scroll listener if any
        this.removeScrollDetection();

        // Add scroll event listener
        this.scrollHandler = async (event) => {
            const container = event.target;
            
            // Check if scrolled to top (within 100px threshold)
            if (container.scrollTop <= 100) {
                // Check if we have more messages to load and not currently loading
                if (this.hasMoreConversations() && !this.isLoadingConversations()) {
                    console.log('Loading more messages...');
                    
                    // Load more messages
                    const result = await this.loadConversations(conversationId, true);
                    
                    if (result.success) {
                        // Trigger event to update UI with new messages
                        window.dispatchEvent(new CustomEvent('moreMessagesLoaded', {
                            detail: {
                                conversationId: conversationId,
                                messages: result.messages,
                                hasMore: result.hasMore
                            }
                        }));
                    } else {
                        console.error('Failed to load more messages:', result.error);
                    }
                }
            }
        };

        // Store reference to container and conversation ID
        this.scrollContainer = chatContainer;
        this.scrollConversationId = conversationId;

        // Add the scroll event listener
        chatContainer.addEventListener('scroll', this.scrollHandler);
        
        console.log('Scroll detection setup for conversation:', conversationId);
    }

    /**
     * Remove scroll detection
     */
    removeScrollDetection() {
        if (this.scrollContainer && this.scrollHandler) {
            this.scrollContainer.removeEventListener('scroll', this.scrollHandler);
            this.scrollContainer = null;
            this.scrollHandler = null;
            this.scrollConversationId = null;
            console.log('Scroll detection removed');
        }
    }

    /**
     * Initialize conversation loading for a chat
     * @param {string} conversationId - The conversation ID
     * @param {HTMLElement} chatContainer - The chat container element
     * @returns {Promise<Object>} Result of initial conversation load
     */
    async initializeConversation(conversationId, chatContainer) {
        // Reset pagination for new conversation
        this.resetConversationPagination(conversationId);
        
        // Setup scroll detection
        this.setupScrollDetection(chatContainer, conversationId);
        
        // Load initial messages
        const result = await this.loadConversations(conversationId, false);
        
        if (result.success) {
            // Trigger event for initial load
            window.dispatchEvent(new CustomEvent('conversationInitialized', {
                detail: {
                    conversationId: conversationId,
                    messages: result.messages,
                    hasMore: result.hasMore
                }
            }));
        }
        
        return result;
    }

    /**
     * Get conversation messages for a specific chat (synchronous)
     * @param {string} conversationId - The conversation ID
     * @returns {Array} Array of messages for the conversation
     */
    getConversationMessages(conversationId) {
        const chat = Array.from(this.chats.values()).find(c => 
            c.serverId === conversationId || c.id === conversationId
        );
        return chat ? chat.messages : [];
    }

    /**
     * Check if a conversation has been loaded
     * @param {string} conversationId - The conversation ID
     * @returns {boolean} True if conversation has messages
     */
    isConversationLoaded(conversationId) {
        const messages = this.getConversationMessages(conversationId);
        return messages.length > 0;
    }

    /**
     * Get conversation statistics
     * @param {string} conversationId - The conversation ID
     * @returns {Object} Statistics about the conversation
     */
    getConversationStats(conversationId) {
        const messages = this.getConversationMessages(conversationId);
        const userMessages = messages.filter(m => m.role === 'user');
        const assistantMessages = messages.filter(m => m.role === 'assistant');
        
        return {
            totalMessages: messages.length,
            userMessages: userMessages.length,
            assistantMessages: assistantMessages.length,
            lastMessage: messages.length > 0 ? messages[messages.length - 1] : null,
            firstMessage: messages.length > 0 ? messages[0] : null
        };
    }

    /**
     * Clean up conversation resources when switching chats
     * @param {string} newConversationId - The new conversation ID (optional)
     */
    cleanupConversation(newConversationId = null) {
        // Remove scroll detection for current conversation
        this.removeScrollDetection();
        
        // Reset pagination if switching to a different conversation
        if (newConversationId && newConversationId !== this.scrollConversationId) {
            this.resetConversationPagination(newConversationId);
        }
        
        console.log('Conversation cleanup completed');
    }

    /**
     * Clear all chats
     */
    clearAllChats() {
        this.chats.clear();
        this.currentChatId = null;
        this.saveChats();
        
        // Trigger event
        window.dispatchEvent(new CustomEvent('allChatsCleared'));
    }

    /**
     * Export chats to JSON
     */
    exportChats() {
        const chatsArray = Array.from(this.chats.values()).map(chat => ({
            id: chat.id,
            name: chat.name,
            messages: chat.messages.map(msg => msg.toJSON()),
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt
        }));
        
        return JSON.stringify(chatsArray, null, 2);
    }

    /**
     * Import chats from JSON
     */
    importChats(jsonData) {
        try {
            const chatsArray = JSON.parse(jsonData);
            this.chats.clear();
            
            chatsArray.forEach(chatData => {
                const chat = {
                    id: chatData.id,
                    name: chatData.name,
                    messages: chatData.messages.map(msgData => Message.fromJSON(msgData)),
                    createdAt: chatData.createdAt,
                    updatedAt: chatData.updatedAt
                };
                this.chats.set(chat.id, chat);
            });
            
            this.saveChats();
            
            // Trigger event
            window.dispatchEvent(new CustomEvent('chatsImported', {
                detail: { count: chatsArray.length }
            }));
            
            return true;
        } catch (error) {
            console.error('Error importing chats:', error);
            return false;
        }
    }

    /**
     * Auto-rename chat based on first user message
     */
    async autoRenameChat(chatId, firstMessage) {
        const chat = this.chats.get(chatId);
        if (!chat) return;

        // Only auto-rename if chat has default name
        if (chat.name === API_CONFIG.DEFAULTS.CONVERSATION_NAME) {
            const newName = this.generateChatName(firstMessage);
            
            try {
                // Call API to update conversation name
                const response = await this.apiService.updateConversationName(chatId, newName);
                
                if (response.success) {
                    // Update local chat data
                    chat.name = newName;
                    chat.updatedAt = new Date().toISOString();
                    this.saveChats();
                    
                    // Trigger event to update UI
                    window.dispatchEvent(new CustomEvent('chatUpdated', {
                        detail: { chat: chat }
                    }));
                    
                    console.log('Chat auto-renamed to:', newName);
                } else {
                    console.error('Failed to auto-rename chat:', response.error);
                    // Fallback to local update only
                    chat.name = newName;
                    this.saveChats();
                }
            } catch (error) {
                console.error('Error auto-renaming chat:', error);
                // Fallback to local update only
                chat.name = newName;
                this.saveChats();
            }
        }
    }

    /**
     * Generate a meaningful chat name from the first message
     */
    generateChatName(message) {
        // Clean and trim the message
        let cleanMessage = message.trim();
        
        // Remove common prefixes/suffixes that don't add value
        const prefixesToRemove = [
            /^(hi|hello|hey|good morning|good afternoon|good evening)\s*,?\s*/i,
            /^(can you|could you|please|pls)\s*/i,
            /^(i need|i want|i would like|i'm looking for)\s*/i,
            /^(help me|assist me|guide me)\s*/i,
            /^(what is|what are|how do|how to|how can|how does)\s*/i,
            /^(explain|tell me|show me|give me)\s*/i
        ];
        
        prefixesToRemove.forEach(prefix => {
            cleanMessage = cleanMessage.replace(prefix, '');
        });
        
        // Remove trailing punctuation and clean up
        cleanMessage = cleanMessage.replace(/[.!?]+$/, '').trim();
        
        // If message is too short or empty after cleaning, use original
        if (cleanMessage.length < 3) {
            cleanMessage = message.trim();
        }
        
        // Handle special cases for better naming
        if (cleanMessage.toLowerCase().includes('code') || cleanMessage.toLowerCase().includes('programming')) {
            cleanMessage = 'Code Discussion';
        } else if (cleanMessage.toLowerCase().includes('bug') || cleanMessage.toLowerCase().includes('error')) {
            cleanMessage = 'Bug Fix Help';
        } else if (cleanMessage.toLowerCase().includes('explain') || cleanMessage.toLowerCase().includes('what is')) {
            cleanMessage = 'Explanation Request';
        } else if (cleanMessage.toLowerCase().includes('how to') || cleanMessage.toLowerCase().includes('tutorial')) {
            cleanMessage = 'How-to Guide';
        } else if (cleanMessage.toLowerCase().includes('review') || cleanMessage.toLowerCase().includes('feedback')) {
            cleanMessage = 'Code Review';
        }
        
        // Capitalize first letter
        cleanMessage = cleanMessage.charAt(0).toUpperCase() + cleanMessage.slice(1);
        
        // Truncate if too long (max 50 characters)
        if (cleanMessage.length > 50) {
            cleanMessage = cleanMessage.substring(0, 47) + '...';
        }
        
        return cleanMessage;
    }

    /**
     * Show error message
     */
    showError(message) {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #ef4444;
            color: white;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 3000;
            font-size: 0.9rem;
            max-width: 300px;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        errorDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; margin-left: auto; font-size: 0.75rem;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(errorDiv);

        // Animate in
        setTimeout(() => {
            errorDiv.style.transform = 'translateX(0)';
        }, 100);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (errorDiv.parentNode) {
                        errorDiv.parentNode.removeChild(errorDiv);
                    }
                }, 300);
            }
        }, 5000);
    }
}
