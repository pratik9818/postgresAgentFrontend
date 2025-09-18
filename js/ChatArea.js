/**
 * ChatArea class to handle the main chat interface
 */
class ChatArea {
    constructor(chatManager) {
        this.chatManager = chatManager;
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.chatTitle = document.getElementById('chatTitle');
        this.isShowingProgress = false;
        this.toolCallMessages = []; // Store assistant-tool-call messages
        this.currentToolCalls = null; // Store current SSE toolcalls
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupChatEvents();
        this.autoResizeTextarea();
    }

    setupEventListeners() {
        // Send message on button click
        this.sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        // Send message on Enter key (but allow Shift+Enter for new lines)
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.chatInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });

        // Handle message events
        window.addEventListener('messageUpdated', (e) => {
            this.handleMessageUpdate(e.detail.message);
        });

        window.addEventListener('messageDeleted', (e) => {
            this.handleMessageDelete(e.detail.message);
        });
    }

    setupChatEvents() {
        // Listen for chat manager events
        window.addEventListener('currentChatChanged', async (e) => {
            await this.loadChat(e.detail.chatId);
        });

        window.addEventListener('messageAdded', (e) => {
            if (e.detail.chatId === this.chatManager.currentChatId) {
                this.addMessageToUI(e.detail.message);
            }
        });

        // Listen for AI response events
        window.addEventListener('aiResponseReceived', (e) => {
            if (e.detail.chatId === this.chatManager.currentChatId) {
                console.log('AI response received:', e.detail.response);
                
                try {
                    // Handle toolcalls if present
                    if (e.detail.toolCalls) {
                        console.log('Processing toolcalls from event:', e.detail.toolCalls);
                        this.setCurrentToolCalls(e.detail.toolCalls);
                    } else {
                        this.clearCurrentToolCalls();
                    }
                } catch (error) {
                    console.error('Error handling toolcalls in aiResponseReceived:', error);
                    this.clearCurrentToolCalls();
                }
                
                // Hide progress indicator
                this.hideProgressIndicator();
            }
        });

        window.addEventListener('aiResponseError', (e) => {
            if (e.detail.chatId === this.chatManager.currentChatId) {
                console.error('AI response error:', e.detail.error);
                // Hide progress indicator and show error
                this.hideProgressIndicator();
                this.showErrorMessage(e.detail.error || 'Failed to get AI response');
            }
        });

        // Listen for progress updates
        window.addEventListener('aiProgressUpdate', (e) => {
            if (e.detail.chatId === this.chatManager.currentChatId) {
                console.log('AI progress update:', e.detail.progress, e.detail.status);
                
                // Stop simulation since we're getting real progress updates
                this.stopProgressSimulation();
                
                // Update status text if provided (regardless of progress value)
                if (e.detail.status) {
                    this.updateProgressIndicator(null, e.detail.status);
                }
            }
        });

        // Listen for conversation loading events
        window.addEventListener('moreMessagesLoaded', (e) => {
            if (e.detail.conversationId === (this.chatManager.getCurrentChat()?.serverId || this.chatManager.getCurrentChat()?.id)) {
                console.log('More messages loaded:', e.detail.messages.length);
                
                // Prepend older messages to the UI (since they're older messages)
                e.detail.messages.forEach(messageData => {
                    this.prependMessageToUI(messageData);
                });
                
                // Update load more indicator
                this.updateLoadMoreIndicator(e.detail.hasMore);
            }
        });

        window.addEventListener('conversationInitialized', (e) => {
            if (e.detail.conversationId === (this.chatManager.getCurrentChat()?.serverId || this.chatManager.getCurrentChat()?.id)) {
                console.log('Conversation initialized:', e.detail.messages.length);
                
                // Update load more indicator
                this.updateLoadMoreIndicator(e.detail.hasMore);
            }
        });
    }

    async sendMessage() {
        const content = this.chatInput.value.trim();
        if (!content) return;

        // Disable input while processing
        this.setInputDisabled(true, 'Sending message...');

        try {
            const currentChat = this.chatManager.getCurrentChat();
            if (!currentChat) {
                // Create new chat if none exists
                const newChat = await this.chatManager.createChat();
                this.chatManager.setCurrentChat(newChat.id);
            }

            // Clear input immediately for better UX
            this.chatInput.value = '';
            this.autoResizeTextarea();

            // Send message to AI backend (now returns job ID for SSE tracking)
            const result = await this.chatManager.sendMessageToAI(
                this.chatManager.currentChatId, 
                content
            );

            // Show progress indicator after user message is added
            if (result.success) {
                console.log('Message queued for processing, job ID:', result.jobId);
                
                // Small delay to ensure user message is rendered first
                setTimeout(() => {
                    this.showProgressIndicator();
                    
                    // Start fallback progress simulation after a short delay (in case backend doesn't send progress updates)
                    setTimeout(() => {
                        this.startProgressSimulation();
                    }, 1000); // Wait 1 second before starting simulation
                }, 100); // Small delay to ensure user message appears first
                
                // Keep progress indicator showing until SSE receives response
                // The progress indicator will be hidden by the aiResponseReceived/aiResponseError events
            } else {
                // Hide progress indicator on immediate error
                this.hideProgressIndicator();
                console.error('Failed to queue message:', result.error);
                this.showErrorMessage(result.error || 'Failed to send message. Please try again.');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideProgressIndicator();
            this.showErrorMessage('Failed to send message. Please try again.');
        } finally {
            // Re-enable input
            this.setInputDisabled(false);
        }
    }


    async loadChat(chatId) {
        this.clearMessages();
        
        if (!chatId) {
            this.showWelcomeMessage();
            this.chatTitle.textContent = 'New Chat';
            return;
        }

        const chat = this.chatManager.getChat(chatId);
        if (chat) {
            this.chatTitle.textContent = chat.name;
            
            // Clean up previous conversation resources
            this.chatManager.cleanupConversation();
            
            // Get conversation ID for server loading
            const conversationId = chat.serverId || chat.id;
            
            // Show loading indicator
            this.showLoadingIndicator();
            
            try {
                console.log('Loading conversation for ID:', conversationId);
                
                // Initialize conversation loading with scroll detection
                const result = await this.chatManager.initializeConversation(conversationId, this.chatMessages);
                
                console.log('Conversation loading result:', result);
                
                if (result.success && result.messages.length > 0) {
                    // Hide loading indicator
                    this.hideLoadingIndicator();
                    
                    console.log('Displaying', result.messages.length, 'messages from server');
                    
                    // Display messages from server
                    result.messages.forEach(message => {
                        this.addMessageToUIFromServer(message);
                    });
                    
                    this.scrollToBottom();
                } else if (chat.messages.length > 0) {
                    // Fallback to local messages if server loading fails or no server messages
                    console.log('Using local messages:', chat.messages.length);
                    this.hideLoadingIndicator();
                    chat.messages.forEach(message => {
                        this.addMessageToUI(message);
                    });
                    this.scrollToBottom();
                } else {
                    // No messages available
                    console.log('No messages available, showing welcome message');
                    this.hideLoadingIndicator();
                    this.showWelcomeMessage();
                }
            } catch (error) {
                console.error('Error loading conversation:', error);
                this.hideLoadingIndicator();
                
                // Fallback to local messages
                if (chat.messages.length > 0) {
                    console.log('Error occurred, using local messages:', chat.messages.length);
                    chat.messages.forEach(message => {
                        this.addMessageToUI(message);
                    });
                    this.scrollToBottom();
                } else {
                    this.showWelcomeMessage();
                }
            }
        }
    }

    addMessageToUI(message) {
        const messageElement = message.createElement();
        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    /**
     * Add message to UI from server data (different format)
     */
    addMessageToUIFromServer(messageData) {
        // Skip assistant-tool-call messages from display
        if (messageData.role == 'assistant-tool-call') {
            // Store the tool call message for potential plan display
            this.storeToolCallMessage(messageData);
            return;
        }
        
        // Create a Message object from server data
        const message = new Message(
            messageData.id,
            messageData.content,
            messageData.role,
            messageData.createdAt,
            messageData.dbData,
            messageData.mongoId // Use MongoDB document ID for API calls
        );
        
        const messageElement = message.createElement();
        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    /**
     * Show loading indicator while loading conversation
     */
    showLoadingIndicator() {
        this.chatMessages.innerHTML = `
            <div class="loading-message">
                <div class="loading-icon">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <h2>Loading conversation...</h2>
                <p>Please wait while we load your messages.</p>
            </div>
        `;
    }

    /**
     * Hide loading indicator
     */
    hideLoadingIndicator() {
        const loadingMessage = this.chatMessages.querySelector('.loading-message');
        if (loadingMessage) {
            loadingMessage.remove();
        }
    }

    /**
     * Prepend message to UI (for loading older messages)
     */
    prependMessageToUI(messageData) {
        // Skip assistant-tool-call messages from display
        if (messageData.role == 'assistant-tool-call') {
            // Store the tool call message for potential plan display
            this.storeToolCallMessage(messageData);
            return;
        }
        
        // Create a Message object from server data
        const message = new Message(
            messageData.id,
            messageData.content,
            messageData.role,
            messageData.createdAt,
            messageData.dbData,
            messageData.mongoId // Use MongoDB document ID for API calls
        );
        
        const messageElement = message.createElement();
        this.chatMessages.insertBefore(messageElement, this.chatMessages.firstChild);
    }

    /**
     * Update load more indicator
     */
    updateLoadMoreIndicator(hasMore) {
        // Remove existing indicator
        const existingIndicator = this.chatMessages.querySelector('.load-more-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        if (hasMore) {
            // Add load more indicator at the top
            const indicator = document.createElement('div');
            indicator.className = 'load-more-indicator';
            indicator.style.cssText = `
                text-align: center;
                padding: 1rem;
                color: #666;
                font-size: 0.875rem;
                border-bottom: 1px solid #e5e5e5;
                background-color: #f9f9f9;
            `;
            indicator.innerHTML = `
                <i class="fas fa-arrow-up"></i>
                <span>Scroll up to load more messages...</span>
            `;
            
            this.chatMessages.insertBefore(indicator, this.chatMessages.firstChild);
        }
    }

    showWelcomeMessage() {
        this.chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-robot"></i>
                </div>
                <h2>How can I help you today?</h2>
                <p>Start a new conversation by typing a message below.</p>
            </div>
        `;
    }

    clearMessages() {
        this.chatMessages.innerHTML = '';
        this.isShowingProgress = false;
        this.toolCallMessages = []; // Clear stored tool call messages
        this.currentToolCalls = null; // Clear current tool calls
    }

    /**
     * Store tool call message for potential plan display
     */
    storeToolCallMessage(messageData) {
        this.toolCallMessages.push(messageData);
        this.updateShowPlanButton();
    }

    /**
     * Update or create the "Show Plan" button
     */
    updateShowPlanButton() {
        console.log('updateShowPlanButton called:', {
            toolCallMessagesLength: this.toolCallMessages.length,
            currentToolCalls: this.currentToolCalls
        });
        
        // Remove existing show plan button
        const existingButton = document.getElementById('showPlanButton');
        if (existingButton) {
            existingButton.remove();
        }

        // Only show button if we have tool call messages or current tool calls
        if (this.toolCallMessages.length > 0 || this.currentToolCalls) {
            console.log('Creating show plan button');
            this.createShowPlanButton();
        } else {
            console.log('No tool calls found, not showing button');
        }
    }

    /**
     * Create the "Show Plan" button
     */
    createShowPlanButton() {
        const showPlanBtn = document.createElement('button');
        showPlanBtn.id = 'showPlanButton';
        showPlanBtn.className = 'show-plan-btn';
        showPlanBtn.innerHTML = '<i class="fas fa-list-alt"></i> Show Plan';
        showPlanBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 20px;
            background: #10a37f;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s ease;
            z-index: 100;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        `;
        
        showPlanBtn.onmouseover = () => {
            showPlanBtn.style.backgroundColor = '#0d8a6b';
        };
        showPlanBtn.onmouseout = () => {
            showPlanBtn.style.backgroundColor = '#10a37f';
        };
        
        showPlanBtn.onclick = () => this.showPlanModal();
        
        // Insert button in the main content area (relative to chatMessages parent)
        const mainContent = this.chatMessages.parentNode; // This should be .main-content
        if (mainContent) {
            mainContent.style.position = 'relative'; // Ensure parent has relative positioning
            mainContent.appendChild(showPlanBtn);
            console.log('Show plan button added to main content');
        } else {
            console.error('Could not find main content container for show plan button');
        }
    }

    /**
     * Show plan modal with tool call information
     */
    showPlanModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay plan-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 3000;
            padding: 2rem;
        `;

        const modalContent = document.createElement('div');
        modalContent.className = 'plan-modal-content';
        modalContent.style.cssText = `
            background-color: #2d2d2d;
            border-radius: 12px;
            width: 90%;
            max-width: 800px;
            max-height: 80vh;
            border: 1px solid #4d4d4d;
            display: flex;
            flex-direction: column;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #4d4d4d;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;

        const title = document.createElement('h3');
        title.textContent = 'AI Tool Plan';
        title.style.cssText = `
            color: #ffffff;
            font-size: 1.1rem;
            margin: 0;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: #9ca3af;
            cursor: pointer;
            padding: 0.25rem;
            border-radius: 4px;
            transition: all 0.2s ease;
        `;

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Content
        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1;
            overflow: auto;
            padding: 1.5rem;
        `;

        // Show current tool calls if available
        if (this.currentToolCalls) {
            const currentSection = document.createElement('div');
            currentSection.style.cssText = `
                margin-bottom: 2rem;
                padding: 1rem;
                background-color: #1f1f1f;
                border-radius: 8px;
                border-left: 4px solid #10a37f;
            `;

            const currentTitle = document.createElement('h4');
            currentTitle.textContent = 'Current Tool Calls';
            currentTitle.style.cssText = `
                color: #10a37f;
                margin: 0 0 1rem 0;
                font-size: 1rem;
            `;

            const currentContent = document.createElement('div');
            currentContent.style.cssText = `
                color: #ffffff;
                white-space: pre-wrap;
                font-family: 'Courier New', monospace;
                font-size: 0.9rem;
                line-height: 1.4;
            `;
            try {
                currentContent.textContent = typeof this.currentToolCalls === 'string' 
                    ? this.currentToolCalls 
                    : JSON.stringify(this.currentToolCalls, null, 2);
            } catch (error) {
                console.error('Error formatting current tool calls:', error);
                currentContent.textContent = 'Error displaying tool calls data';
            }

            currentSection.appendChild(currentTitle);
            currentSection.appendChild(currentContent);
            content.appendChild(currentSection);
        }

        // Show historical tool call messages
        if (this.toolCallMessages.length > 0) {
            const historicalSection = document.createElement('div');
            historicalSection.style.cssText = `
                margin-bottom: 1rem;
            `;

            const historicalTitle = document.createElement('h4');
            historicalTitle.textContent = 'Historical Tool Plans';
            historicalTitle.style.cssText = `
                color: #ffffff;
                margin: 0 0 1rem 0;
                font-size: 1rem;
            `;

            historicalSection.appendChild(historicalTitle);

            this.toolCallMessages.forEach((messageData, index) => {
                const messageDiv = document.createElement('div');
                messageDiv.style.cssText = `
                    margin-bottom: 1rem;
                    padding: 1rem;
                    background-color: #1f1f1f;
                    border-radius: 8px;
                    border-left: 4px solid #6b7280;
                `;

                const messageTitle = document.createElement('h5');
                messageTitle.textContent = `Plan ${index + 1}`;
                messageTitle.style.cssText = `
                    color: #6b7280;
                    margin: 0 0 0.5rem 0;
                    font-size: 0.9rem;
                `;

                const messageContent = document.createElement('div');
                messageContent.style.cssText = `
                    color: #ffffff;
                    white-space: pre-wrap;
                    font-family: 'Courier New', monospace;
                    font-size: 0.85rem;
                    line-height: 1.4;
                `;
                try {
                    messageContent.textContent = messageData.content || 'No content available';
                } catch (error) {
                    console.error('Error displaying historical tool call content:', error);
                    messageContent.textContent = 'Error displaying plan content';
                }

                messageDiv.appendChild(messageTitle);
                messageDiv.appendChild(messageContent);
                historicalSection.appendChild(messageDiv);
            });

            content.appendChild(historicalSection);
        }

        // If no content available
        if (!this.currentToolCalls && this.toolCallMessages.length === 0) {
            const noContent = document.createElement('div');
            noContent.style.cssText = `
                text-align: center;
                color: #9ca3af;
                padding: 2rem;
            `;
            noContent.textContent = 'No tool plans available';
            content.appendChild(noContent);
        }

        modalContent.appendChild(header);
        modalContent.appendChild(content);
        modal.appendChild(modalContent);

        // Close functionality
        closeBtn.onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        };

        document.body.appendChild(modal);
    }

    /**
     * Set current tool calls from SSE response
     */
    setCurrentToolCalls(toolCalls) {
        try {
            console.log('Setting current tool calls:', toolCalls);
            this.currentToolCalls = toolCalls;
            this.updateShowPlanButton();
        } catch (error) {
            console.error('Error setting tool calls:', error);
            this.currentToolCalls = null;
        }
    }

    /**
     * Clear current tool calls
     */
    clearCurrentToolCalls() {
        this.currentToolCalls = null;
        this.updateShowPlanButton();
    }

    /**
     * Test method to manually show the plan button (for debugging)
     */
    testShowPlanButton() {
        console.log('Testing show plan button...');
        this.currentToolCalls = { test: 'This is a test tool call' };
        this.updateShowPlanButton();
    }

    showProgressIndicator() {
        // Don't show if already showing
        if (this.isShowingProgress) {
            return;
        }
        
        const progressDiv = document.createElement('div');
        progressDiv.className = 'message assistant progress-indicator';
        progressDiv.id = 'progressIndicator';
        
        progressDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="message-text">
                    <div class="simple-progress-status">
                        <div class="progress-icon">
                            <i class="fas fa-cog"></i>
                        </div>
                        <span id="progressStatusText">Getting your data...</span>
                    </div>
                </div>
            </div>
        `;
        
        this.chatMessages.appendChild(progressDiv);
        this.scrollToBottom();
        this.isShowingProgress = true;
    }

    hideProgressIndicator() {
        // Stop progress simulation
        this.stopProgressSimulation();
        
        const progressIndicator = document.getElementById('progressIndicator');
        if (progressIndicator) {
            progressIndicator.remove();
        }
        this.isShowingProgress = false;
    }

    updateProgressIndicator(progress, status) {
        const progressStatusText = document.getElementById('progressStatusText');
        
        if (progressStatusText && status) {
            progressStatusText.textContent = status;
        }
    }

    // Legacy method for compatibility
    hideTypingIndicator() {
        this.hideProgressIndicator();
    }

    startProgressSimulation() {
        // Clear any existing simulation
        this.stopProgressSimulation();
        
        // Show initial status
        this.updateProgressIndicator(null, 'Getting your data...');
        
        // Only start fallback simulation if no real updates come for a while
        this.progressSimulationTimeout = setTimeout(() => {
            if (this.isShowingProgress) {
                // Show a generic status if no real updates come
                this.updateProgressIndicator(null, 'Processing your request...');
            }
        }, 5000); // Wait 5 seconds before showing fallback
    }

    stopProgressSimulation() {
        if (this.progressSimulationInterval) {
            clearInterval(this.progressSimulationInterval);
            this.progressSimulationInterval = null;
        }
        if (this.progressSimulationTimeout) {
            clearTimeout(this.progressSimulationTimeout);
            this.progressSimulationTimeout = null;
        }
    }

    handleMessageUpdate(message) {
        // Find and update the message in the UI
        const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
        if (messageElement) {
            const textElement = messageElement.querySelector('.message-text');
            if (textElement && !message.isEditing) {
                textElement.innerHTML = message.formatContent(message.content);
            }
        }
    }

    handleMessageDelete(message) {
        // Remove the message from the UI
        const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    }

    autoResizeTextarea() {
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + 'px';
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }

    focusInput() {
        this.chatInput.focus();
    }

    setInputValue(value) {
        this.chatInput.value = value;
        this.autoResizeTextarea();
    }

    getInputValue() {
        return this.chatInput.value;
    }

    clearInput() {
        this.chatInput.value = '';
        this.autoResizeTextarea();
    }

    /**
     * Set input disabled state
     */
    setInputDisabled(disabled, message = null) {
        this.chatInput.disabled = disabled;
        this.sendBtn.disabled = disabled;
        
        if (disabled) {
            this.chatInput.placeholder = message || 'AI is thinking...';
            this.sendBtn.style.opacity = '0.5';
        } else {
            this.chatInput.placeholder = 'Message ChatGPT...';
            this.sendBtn.style.opacity = '1';
        }
    }

    /**
     * Show error info as small text (for token limit cases)
     */
    showErrorInfo(errorInfo) {
        // Create error info notification
        const errorInfoDiv = document.createElement('div');
        errorInfoDiv.className = 'error-info-notification';
        errorInfoDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: #f59e0b;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            z-index: 3000;
            max-width: 300px;
            font-size: 0.875rem;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        errorInfoDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${errorInfo}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; margin-left: auto; font-size: 0.75rem;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(errorInfoDiv);

        // Animate in
        setTimeout(() => {
            errorInfoDiv.style.transform = 'translateX(0)';
        }, 100);

        // Auto remove after delay
        setTimeout(() => {
            if (errorInfoDiv.parentNode) {
                errorInfoDiv.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (errorInfoDiv.parentNode) {
                        errorInfoDiv.parentNode.removeChild(errorInfoDiv);
                    }
                }, 300);
            }
        }, 8000); // Show for 8 seconds since it's informational
    }

    /**
     * Show error message
     */
    showErrorMessage(message) {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #ef4444;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 3000;
            max-width: 400px;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        errorDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; margin-left: auto;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(errorDiv);

        // Animate in
        setTimeout(() => {
            errorDiv.style.transform = 'translateX(0)';
        }, 100);

        // Auto remove after delay
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
