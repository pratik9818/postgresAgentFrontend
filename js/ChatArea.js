/**
 * ChatArea class to handle the main chat interface
 */
class ChatArea {
  constructor(chatManager) {
    this.chatManager = chatManager;
    this.chatMessages = document.getElementById("chatMessages");
    this.chatInput = document.getElementById("chatInput");
    this.sendBtn = document.getElementById("sendBtn");
    this.chatTitle = document.getElementById("chatTitle");
    this.isShowingProgress = false;
    this.toolCallMessages = []; // Store assistant-tool-call messages
    this.currentToolCalls = null; // Store current SSE toolcalls
    this.eventsSetup = false; // Flag to prevent duplicate event listener setup

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupChatEvents();
    this.autoResizeTextarea();
  }

  setupEventListeners() {
    // Send message on button click
    this.sendBtn.addEventListener("click", () => {
      this.sendMessage();
    });

    // Send message on Enter key (but allow Shift+Enter for new lines)
    this.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    this.chatInput.addEventListener("input", () => {
      this.autoResizeTextarea();
    });

    // Handle message events
    window.addEventListener("messageUpdated", (e) => {
      this.handleMessageUpdate(e.detail.message);
    });

    window.addEventListener("messageDeleted", (e) => {
      this.handleMessageDelete(e.detail.message);
    });
  }

  setupChatEvents() {
    // Prevent duplicate event listener setup
    if (this.eventsSetup) {
      console.log('Chat events already setup, skipping duplicate setup');
      return;
    }
    
    this.eventsSetup = true;
    
    // Listen for chat manager events
    window.addEventListener("currentChatChanged", async (e) => {
      await this.loadChat(e.detail.chatId);
    });

    window.addEventListener("messageAdded", (e) => {
      if (e.detail.chatId === this.chatManager.currentChatId) {
        this.addMessageToUI(e.detail.message);
      }
    });

    // Listen for AI response events
    window.addEventListener("aiResponseReceived", (e) => {
      if (e.detail.chatId === this.chatManager.currentChatId) {
        console.log("AI response received:", e.detail.response);

        try {
          // Handle toolcalls if present
          if (e.detail.toolCalls) {
            console.log("Processing toolcalls from event:", e.detail.toolCalls);
            this.setCurrentToolCalls(e.detail.toolCalls);
          } else {
            this.clearCurrentToolCalls();
          }
        } catch (error) {
          console.error(
            "Error handling toolcalls in aiResponseReceived:",
            error
          );
          this.clearCurrentToolCalls();
        }

        // Hide progress indicator
        this.hideProgressIndicator();
      }
    });

    window.addEventListener("aiResponseError", (e) => {
      if (e.detail.chatId === this.chatManager.currentChatId) {
        console.error("AI response error:", e.detail.error);
        // Hide progress indicator and show error
        this.hideProgressIndicator();
        this.showErrorMessage(e.detail.error || "Failed to get AI response");
      }
    });

    // Listen for progress updates
    window.addEventListener("aiProgressUpdate", (e) => {
      if (e.detail.chatId === this.chatManager.currentChatId) {
        console.log("AI progress update:", e.detail.progress, e.detail.status);

        // Stop simulation since we're getting real progress updates
        this.stopProgressSimulation();

        // Update status text if provided (regardless of progress value)
        if (e.detail.status) {
          this.updateProgressIndicator(null, e.detail.status);
        }
      }
    });

    // Listen for conversation loading events
    window.addEventListener("moreMessagesLoaded", (e) => {
      if (
        e.detail.conversationId ===
        (this.chatManager.getCurrentChat()?.serverId ||
          this.chatManager.getCurrentChat()?.id)
      ) {
        console.log("More messages loaded:", e.detail.messages.length);

        // Prepend older messages to the UI (since they're older messages)
        e.detail.messages.forEach((messageData) => {
          this.prependMessageToUI(messageData);
        });

        // Update load more indicator
        this.updateLoadMoreIndicator(e.detail.hasMore);
      }
    });

    window.addEventListener("conversationInitialized", (e) => {
      if (
        e.detail.conversationId ===
        (this.chatManager.getCurrentChat()?.serverId ||
          this.chatManager.getCurrentChat()?.id)
      ) {
        console.log("Conversation initialized:", e.detail.messages.length);

        // Update load more indicator
        this.updateLoadMoreIndicator(e.detail.hasMore);
      }
    });

    // Listen for chat updates (like name changes)
    window.addEventListener("chatUpdated", (e) => {
      console.log("ChatArea received chatUpdated event:", {
        eventChatId: e.detail.chat.id,
        currentChatId: this.chatManager.currentChatId,
        chatName: e.detail.chat.name,
      });

      if (e.detail.chat.id === this.chatManager.currentChatId) {
        console.log("Chat updated, updating title:", e.detail.chat.name);
        this.chatTitle.textContent = e.detail.chat.name;

        // Also update the chat title in the sidebar if it's the current chat
        // This ensures consistency between sidebar and main area
        const currentChat = this.chatManager.getCurrentChat();
        if (currentChat && currentChat.id === e.detail.chat.id) {
          console.log("Updating current chat title from server data");
        }
      } else {
        console.log("Chat updated event not for current chat, ignoring");
      }
    });
  }

  async sendMessage() {
    const content = this.chatInput.value.trim();
    if (!content) return;

    // Disable input while processing
    this.setInputDisabled(true, "Sending message...");

    try {
      const currentChat = this.chatManager.getCurrentChat();
      if (!currentChat) {
        // Create new chat if none exists
        const newChat = await this.chatManager.createChat();
        this.chatManager.setCurrentChat(newChat.id);
      }

      // Clear input immediately for better UX
      this.chatInput.value = "";
      this.autoResizeTextarea();

      // Send message to AI backend (now returns job ID for SSE tracking)
      const result = await this.chatManager.sendMessageToAI(
        this.chatManager.currentChatId,
        content
      );

      // Show progress indicator after user message is added
      if (result.success) {
        console.log("Message queued for processing, job ID:", result.jobId);

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
        console.error("Failed to queue message:", result.error);
        this.showErrorMessage(
          result.error || "Failed to send message. Please try again."
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      this.hideProgressIndicator();
      this.showErrorMessage("Failed to send message. Please try again.");
    } finally {
      // Re-enable input
      this.setInputDisabled(false);
    }
  }

  async loadChat(chatId) {
    this.clearMessages();

    if (!chatId) {
      this.showWelcomeMessage();
      this.chatTitle.textContent = "New Chat";
      return;
    }

    const chat = this.chatManager.getChat(chatId);
    if (chat) {
      // Set title immediately, but if it's a placeholder, it will be updated by chatUpdated event
      this.chatTitle.textContent = chat.name;

      // Clean up previous conversation resources
      this.chatManager.cleanupConversation();

      // Get conversation ID for server loading
      const conversationId = chat.serverId || chat.id;

      // Show loading indicator
      this.showLoadingIndicator();

      try {
        console.log("Loading conversation for ID:", conversationId);

        // Check if chat already has messages loaded (from fetchChatFromServer)
        if (chat.messages && chat.messages.length > 0) {
          console.log(
            "Using already loaded messages from chat object:",
            chat.messages.length
          );
          this.hideLoadingIndicator();

          // Display messages from chat object
          chat.messages.forEach((message) => {
            this.addMessageToUIFromServer(message);
          });

          this.scrollToBottom();
          return; // Exit early to avoid duplicate API call
        }

        // Initialize conversation loading with scroll detection
        const result = await this.chatManager.initializeConversation(
          conversationId,
          this.chatMessages
        );

        console.log("Conversation loading result:", result);

        if (result.success && result.messages.length > 0) {
          // Hide loading indicator
          this.hideLoadingIndicator();

          console.log(
            "Displaying",
            result.messages.length,
            "messages from server"
          );

          // Display messages from server
          result.messages.forEach((message) => {
            this.addMessageToUIFromServer(message);
          });

          this.scrollToBottom();
        } else if (chat.messages.length > 0) {
          // Fallback to local messages if server loading fails or no server messages
          console.log("Using local messages:", chat.messages.length);
          this.hideLoadingIndicator();
          chat.messages.forEach((message) => {
            this.addMessageToUI(message);
          });
          this.scrollToBottom();
        } else {
          // No messages available
          console.log("No messages available, showing welcome message");
          this.hideLoadingIndicator();
          this.showWelcomeMessage();
        }
      } catch (error) {
        console.error("Error loading conversation:", error);
        this.hideLoadingIndicator();

        // Fallback to local messages
        if (chat.messages.length > 0) {
          console.log(
            "Error occurred, using local messages:",
            chat.messages.length
          );
          chat.messages.forEach((message) => {
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
    // Check if message already exists in UI to prevent duplicates
    const existingMessage = document.querySelector(`[data-message-id="${message.id}"]`);
    if (existingMessage) {
      console.log('Message already exists in UI, skipping duplicate:', message.id);
      return;
    }
    
    const messageElement = message.createElement();
    this.chatMessages.appendChild(messageElement);
    this.scrollToBottom();
  }

  /**
   * Add message to UI from server data (different format)
   */
  addMessageToUIFromServer(messageData) {
    // Skip assistant-tool-call messages from display
    if (messageData.role == "assistant-tool-call") {
      // Store the tool call message for potential plan display
      this.storeToolCallMessage(messageData);
      return;
    }

    // Check if message already exists in UI to prevent duplicates
    const messageId = messageData.id || messageData._id;
    if (messageId) {
      const existingMessage = document.querySelector(`[data-message-id="${messageId}"]`);
      if (existingMessage) {
        console.log('Message already exists in UI, skipping duplicate:', messageId);
        return;
      }
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
    const loadingMessage = this.chatMessages.querySelector(".loading-message");
    if (loadingMessage) {
      loadingMessage.remove();
    }
  }

  /**
   * Prepend message to UI (for loading older messages)
   */
  prependMessageToUI(messageData) {
    // Skip assistant-tool-call messages from display
    if (messageData.role == "assistant-tool-call") {
      // Store the tool call message for potential plan display
      this.storeToolCallMessage(messageData);
      return;
    }

    // Check if message already exists in UI to prevent duplicates
    const messageId = messageData.id || messageData._id;
    if (messageId) {
      const existingMessage = document.querySelector(`[data-message-id="${messageId}"]`);
      if (existingMessage) {
        console.log('Message already exists in UI, skipping duplicate:', messageId);
        return;
      }
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
    this.chatMessages.insertBefore(
      messageElement,
      this.chatMessages.firstChild
    );
  }

  /**
   * Update load more indicator
   */
  updateLoadMoreIndicator(hasMore) {
    // Remove existing indicator
    const existingIndicator = this.chatMessages.querySelector(
      ".load-more-indicator"
    );
    if (existingIndicator) {
      existingIndicator.remove();
    }

    if (hasMore) {
      // Add load more indicator at the top
      const indicator = document.createElement("div");
      indicator.className = "load-more-indicator";
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
               <h2>Ask me anything about your data</h2>
                    <p>Get instant insights from your database without writing SQL. Just ask in plain English!</p>
            </div>
        `;
  }

  clearMessages() {
    this.chatMessages.innerHTML = "";
    this.isShowingProgress = false;
    this.toolCallMessages = []; // Clear stored tool call messages
    this.currentToolCalls = null; // Clear current tool calls
  }

  /**
   * Store tool call message for potential plan display
   */
  storeToolCallMessage(messageData) {
    this.toolCallMessages.push(messageData);
  }



  /**
   * Set current tool calls from SSE response
   */
  setCurrentToolCalls(toolCalls) {
    try {
      console.log("Setting current tool calls:", toolCalls);
      this.currentToolCalls = toolCalls;
    } catch (error) {
      console.error("Error setting tool calls:", error);
      this.currentToolCalls = null;
    }
  }

  /**
   * Clear current tool calls
   */
  clearCurrentToolCalls() {
    this.currentToolCalls = null;
  }


  showProgressIndicator() {
    // Don't show if already showing
    if (this.isShowingProgress) {
      return;
    }

    const progressDiv = document.createElement("div");
    progressDiv.className = "message assistant progress-indicator";
    progressDiv.id = "progressIndicator";

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

    const progressIndicator = document.getElementById("progressIndicator");
    if (progressIndicator) {
      progressIndicator.remove();
    }
    this.isShowingProgress = false;
  }

  updateProgressIndicator(progress, status) {
    const progressStatusText = document.getElementById("progressStatusText");

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
    this.updateProgressIndicator(null, "Getting your data...");

    // Only start fallback simulation if no real updates come for a while
    this.progressSimulationTimeout = setTimeout(() => {
      if (this.isShowingProgress) {
        // Show a generic status if no real updates come
        this.updateProgressIndicator(null, "Processing your request...");
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
    const messageElement = document.querySelector(
      `[data-message-id="${message.id}"]`
    );
    if (messageElement) {
      const textElement = messageElement.querySelector(".message-text");
      if (textElement && !message.isEditing) {
        textElement.innerHTML = message.formatContent(message.content);
      }
    }
  }

  handleMessageDelete(message) {
    // Remove the message from the UI
    const messageElement = document.querySelector(
      `[data-message-id="${message.id}"]`
    );
    if (messageElement) {
      messageElement.remove();
    }
  }

  autoResizeTextarea() {
    this.chatInput.style.height = "auto";
    this.chatInput.style.height =
      Math.min(this.chatInput.scrollHeight, 120) + "px";
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
    this.chatInput.value = "";
    this.autoResizeTextarea();
  }

  /**
   * Set input disabled state
   */
  setInputDisabled(disabled, message = null) {
    this.chatInput.disabled = disabled;
    this.sendBtn.disabled = disabled;

    if (disabled) {
      this.chatInput.placeholder = message || "AI is thinking...";
      this.sendBtn.style.opacity = "0.5";
    } else {
      this.chatInput.placeholder = "Ask anything about your data";
      this.sendBtn.style.opacity = "1";
    }
  }

  /**
   * Show error info as small text (for token limit cases)
   */
  showErrorInfo(errorInfo) {
    // Create error info notification
    const errorInfoDiv = document.createElement("div");
    errorInfoDiv.className = "error-info-notification";
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
      errorInfoDiv.style.transform = "translateX(0)";
    }, 100);

    // Auto remove after delay
    setTimeout(() => {
      if (errorInfoDiv.parentNode) {
        errorInfoDiv.style.transform = "translateX(100%)";
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
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-notification";
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
      errorDiv.style.transform = "translateX(0)";
    }, 100);

    // Auto remove after delay
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.style.transform = "translateX(100%)";
        setTimeout(() => {
          if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
          }
        }, 300);
      }
    }, 5000);
  }
}
