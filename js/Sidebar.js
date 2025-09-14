/**
 * Sidebar class to handle the chat list sidebar
 */
class Sidebar {
    constructor(chatManager) {
        this.chatManager = chatManager;
        this.sidebar = document.getElementById('sidebar');
        this.chatList = document.getElementById('chatList');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.sidebarToggle = document.getElementById('sidebarToggle');
        this.mobileMenuBtn = document.getElementById('mobileMenuBtn');
        this.userName = document.getElementById('userName');
        this.logoutBtn = document.getElementById('logoutBtn');
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUserInfo();
        this.setupChatEvents();
        this.setupLazyLoading();
        this.loadInitialChats();
    }

    setupEventListeners() {
        // New chat button
        this.newChatBtn.addEventListener('click', () => {
            this.createNewChat();
        });

        // Sidebar toggle for mobile
        this.sidebarToggle.addEventListener('click', () => {
            this.toggleSidebar();
        });

        this.mobileMenuBtn.addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Logout button
        this.logoutBtn.addEventListener('click', () => {
            this.logout();
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                !this.sidebar.contains(e.target) && 
                !this.mobileMenuBtn.contains(e.target) &&
                this.sidebar.classList.contains('open')) {
                this.closeSidebar();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                this.sidebar.classList.remove('open');
            }
        });
    }

    setupChatEvents() {
        // Listen for chat manager events
        window.addEventListener('chatCreated', (e) => {
            this.renderChatList();
            // Don't auto-select here since we manually select in createNewChat()
        });

        window.addEventListener('chatUpdated', (e) => {
            this.renderChatList();
        });

        window.addEventListener('chatDeleted', (e) => {
            this.renderChatList();
            // If the deleted chat was selected, clear selection
            if (this.chatManager.currentChatId === e.detail.chatId) {
                this.clearSelection();
            }
        });

        window.addEventListener('currentChatChanged', (e) => {
            this.updateSelection(e.detail.chatId);
        });

        window.addEventListener('chatsLoaded', (e) => {
            this.renderChatList();
            this.updateLoadMoreButton();
        });
    }

    async createNewChat() {
        // Show loading state
        const originalText = this.newChatBtn.innerHTML;
        this.newChatBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        this.newChatBtn.disabled = true;

        try {
            const newChat = await this.chatManager.createChat();
            this.chatManager.setCurrentChat(newChat.id);
            this.closeSidebar(); // Close sidebar on mobile after creating new chat
        } catch (error) {
            console.error('Error creating new chat:', error);
            // Still create locally as fallback
            const newChat = await this.chatManager.createChat();
            this.chatManager.setCurrentChat(newChat.id);
            this.closeSidebar();
        } finally {
            // Restore button state
            this.newChatBtn.innerHTML = originalText;
            this.newChatBtn.disabled = false;
        }
    }

    renderChatList() {
        this.chatList.innerHTML = '';
        
        const chats = this.chatManager.getAllChats();
        
        if (chats.length === 0) {
            if (this.chatManager.isLoadingChats()) {
                // Show loading state
                const loadingState = document.createElement('div');
                loadingState.className = 'loading-state';
                loadingState.style.cssText = `
                    text-align: center;
                    padding: 2rem 1rem;
                    color: #9ca3af;
                `;
                loadingState.innerHTML = `
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    <p>Loading chats...</p>
                `;
                this.chatList.appendChild(loadingState);
            } else {
                // Show empty state
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.style.cssText = `
                    text-align: center;
                    padding: 2rem 1rem;
                    color: #9ca3af;
                `;
                emptyState.innerHTML = `
                    <i class="fas fa-comments" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    <p>No chats yet</p>
                    <p style="font-size: 0.8rem; margin-top: 0.5rem;">Start a new conversation</p>
                `;
                this.chatList.appendChild(emptyState);
            }
            return;
        }

        chats.forEach(chat => {
            const chatItem = this.createChatItem(chat);
            this.chatList.appendChild(chatItem);
        });

        // Add load more button if there are more chats to load
        if (this.chatManager.hasMoreChats()) {
            this.addLoadMoreButton();
        } else if (chats.length > 0) {
            // Show "No more chats" message if we have chats but no more to load
            this.addNoMoreChatsMessage();
        }
    }

    createChatItem(chat) {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chat.id;

        // Get last message preview
        const lastMessage = chat.messages.length > 0 ? 
            chat.messages[chat.messages.length - 1] : null;
        const preview = lastMessage ? 
            (lastMessage.content.length > 50 ? 
                lastMessage.content.substring(0, 50) + '...' : 
                lastMessage.content) : 
            'No messages yet';

        chatItem.innerHTML = `
            <div class="chat-item-content">
                <div class="chat-item-name">${this.escapeHtml(chat.name)}</div>
                <div class="chat-item-preview">${this.escapeHtml(preview)}</div>
            </div>
            <div class="chat-item-actions">
                <button class="chat-item-action" title="Edit chat name" data-action="edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="chat-item-action" title="Delete chat" data-action="delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        // Add click event to select chat
        chatItem.addEventListener('click', (e) => {
            if (!e.target.closest('.chat-item-actions')) {
                this.selectChat(chat.id);
                this.closeSidebar();
            }
        });

        // Add action button events
        const editBtn = chatItem.querySelector('[data-action="edit"]');
        const deleteBtn = chatItem.querySelector('[data-action="delete"]');

        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editChatName(chat.id, chat.name);
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteChat(chat.id, chat.name);
        });

        return chatItem;
    }

    selectChat(chatId) {
        this.chatManager.setCurrentChat(chatId);
    }

    updateSelection(chatId) {
        // Remove active class from all items
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to selected item
        if (chatId) {
            const selectedItem = document.querySelector(`[data-chat-id="${chatId}"]`);
            if (selectedItem) {
                selectedItem.classList.add('active');
            }
        }
    }

    clearSelection() {
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    editChatName(chatId, currentName) {
        const modal = document.getElementById('chatNameModal');
        const input = document.getElementById('chatNameInput');
        const modalOverlay = document.getElementById('modalOverlay');

        input.value = currentName;
        modalOverlay.classList.add('active');
        input.focus();
        input.select();

        // Handle save
        const saveBtn = document.getElementById('saveChatName');
        const cancelBtn = document.getElementById('cancelEdit');
        const closeBtn = document.getElementById('closeModal');

        const saveHandler = async () => {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                // Show loading state
                const saveBtn = document.getElementById('saveChatName');
                const originalText = saveBtn.textContent;
                saveBtn.textContent = 'Saving...';
                saveBtn.disabled = true;
                
                try {
                    const success = await this.chatManager.updateChatName(chatId, newName);
                    if (success) {
                        this.closeModal();
                    } else {
                        // Reset button state on failure
                        saveBtn.textContent = originalText;
                        saveBtn.disabled = false;
                    }
                } catch (error) {
                    console.error('Error updating chat name:', error);
                    // Reset button state on error
                    saveBtn.textContent = originalText;
                    saveBtn.disabled = false;
                }
            } else {
                this.closeModal();
            }
        };

        const cancelHandler = () => {
            this.closeModal();
        };

        // Remove existing listeners
        saveBtn.replaceWith(saveBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        closeBtn.replaceWith(closeBtn.cloneNode(true));

        // Add new listeners
        document.getElementById('saveChatName').addEventListener('click', saveHandler);
        document.getElementById('cancelEdit').addEventListener('click', cancelHandler);
        document.getElementById('closeModal').addEventListener('click', cancelHandler);

        // Handle Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveHandler();
            } else if (e.key === 'Escape') {
                cancelHandler();
            }
        });

        // Close on overlay click
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                cancelHandler();
            }
        });
    }

    deleteChat(chatId, chatName) {
        if (confirm(`Are you sure you want to delete "${chatName}"? This action cannot be undone.`)) {
            this.chatManager.deleteChat(chatId);
        }
    }

    closeModal() {
        const modalOverlay = document.getElementById('modalOverlay');
        modalOverlay.classList.remove('active');
    }

    toggleSidebar() {
        this.sidebar.classList.toggle('open');
    }

    closeSidebar() {
        this.sidebar.classList.remove('open');
    }

    loadUserInfo() {
        try {
            const userData = localStorage.getItem('data');
            if (userData) {
                const user = JSON.parse(userData);
                this.userName.textContent = user.user?.name || user.user?.username || 'User';
            }
        } catch (error) {
            console.error('Error loading user info:', error);
            this.userName.textContent = 'User';
        }
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('data');
            window.location.href = '/';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Setup lazy loading for chat list
     */
    setupLazyLoading() {
        let isLoadingMore = false;
        
        this.chatList.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = this.chatList;
            
            // Check if user has scrolled to bottom (with some threshold)
            if (scrollTop + clientHeight >= scrollHeight - 100) {
                // Prevent multiple simultaneous requests
                if (!isLoadingMore && this.chatManager.hasMoreChats() && !this.chatManager.isLoadingChats()) {
                    isLoadingMore = true;
                    this.loadMoreChats().finally(() => {
                        isLoadingMore = false;
                    });
                }
            }
        });
    }

    /**
     * Load initial chats from server
     */
    async loadInitialChats() {
        try {
            // Reset pagination state for initial load
            this.chatManager.resetPagination();
            
            const result = await this.chatManager.fetchChats(false); // Load first page
            
            // Always render the chat list after loading
            this.renderChatList();
        } catch (error) {
            console.error('Error loading initial chats:', error);
            // Fallback to local chats
            this.renderChatList();
        }
    }

    /**
     * Load more chats (pagination)
     */
    async loadMoreChats() {
        if (!this.chatManager.hasMoreChats() || this.chatManager.isLoadingChats()) {
            return;
        }

        try {
            // Show loading indicator at bottom
            this.showLoadingIndicator();
            
            const result = await this.chatManager.fetchChats(true); // Load more
            
            if (result && result.success) {
                console.log(`Loaded ${result.chats.length} more chats`);
            }
        } catch (error) {
            console.error('Error loading more chats:', error);
            this.showErrorMessage('Failed to load more chats');
        } finally {
            this.hideLoadingIndicator();
        }
    }

    /**
     * Add load more button to chat list
     */
    addLoadMoreButton() {
        const existingBtn = document.getElementById('loadMoreBtn');
        if (existingBtn) {
            existingBtn.remove();
        }

        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'loadMoreBtn';
        loadMoreBtn.className = 'load-more-btn';
        loadMoreBtn.style.cssText = `
            width: 100%;
            background-color: transparent;
            border: 1px solid #4d4d4d;
            color: #ffffff;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            font-size: 0.9rem;
            margin: 0.5rem;
            transition: all 0.2s ease;
        `;
        loadMoreBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Load More';
        
        loadMoreBtn.addEventListener('click', () => {
            this.loadMoreChats();
        });

        loadMoreBtn.addEventListener('mouseenter', () => {
            loadMoreBtn.style.backgroundColor = '#2d2d2d';
            loadMoreBtn.style.borderColor = '#6d6d6d';
        });

        loadMoreBtn.addEventListener('mouseleave', () => {
            loadMoreBtn.style.backgroundColor = 'transparent';
            loadMoreBtn.style.borderColor = '#4d4d4d';
        });

        this.chatList.appendChild(loadMoreBtn);
    }

    /**
     * Update load more button state
     */
    updateLoadMoreButton() {
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            if (this.chatManager.isLoadingChats()) {
                loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                loadMoreBtn.disabled = true;
            } else if (this.chatManager.hasMoreChats()) {
                loadMoreBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Load More';
                loadMoreBtn.disabled = false;
            } else {
                loadMoreBtn.style.display = 'none';
            }
        }
    }

    /**
     * Show loading indicator at bottom of chat list
     */
    showLoadingIndicator() {
        const existingIndicator = document.getElementById('loadingIndicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loadingIndicator';
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            color: #9ca3af;
            font-size: 0.9rem;
        `;
        loadingIndicator.innerHTML = `
            <i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
            Loading more chats...
        `;

        this.chatList.appendChild(loadingIndicator);
    }

    /**
     * Hide loading indicator
     */
    hideLoadingIndicator() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }

    /**
     * Add "No more chats" message
     */
    addNoMoreChatsMessage() {
        const existingMessage = document.getElementById('noMoreChatsMessage');
        if (existingMessage) {
            existingMessage.remove();
        }

        const noMoreMessage = document.createElement('div');
        noMoreMessage.id = 'noMoreChatsMessage';
        noMoreMessage.className = 'no-more-chats';
        noMoreMessage.style.cssText = `
            text-align: center;
            padding: 1rem;
            color: #9ca3af;
            font-size: 0.9rem;
            border-top: 1px solid #2d2d2d;
            margin-top: 0.5rem;
        `;
        noMoreMessage.innerHTML = `
            <i class="fas fa-check-circle" style="margin-right: 0.5rem;"></i>
            All chats loaded
        `;

        this.chatList.appendChild(noMoreMessage);
    }

    /**
     * Show error message
     */
    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            background-color: #ef4444;
            color: white;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            margin: 0.5rem;
            font-size: 0.9rem;
            text-align: center;
        `;
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>
            ${message}
        `;

        this.chatList.appendChild(errorDiv);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 3000);
    }
}
