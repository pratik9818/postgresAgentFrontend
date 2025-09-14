/**
 * Main application class to initialize and coordinate all components
 */
class App {
    constructor() {
        this.chatManager = null;
        this.sidebar = null;
        this.chatArea = null;
        
        this.init();
    }

    init() {
        // Check if user is logged in
        if (!this.checkAuth()) {
            this.redirectToLogin();
            return;
        }

        // Initialize components
        this.initializeComponents();
        
        // Setup global event listeners
        this.setupGlobalEvents();
        
        // Load initial state
        this.loadInitialState();
    }

    checkAuth() {
        try {
            const userData = localStorage.getItem('data');
            return userData && JSON.parse(userData);
        } catch (error) {
            console.error('Error checking auth:', error);
            return false;
        }
    }

    redirectToLogin() {
        window.location.href = '/';
    }

    initializeComponents() {
        // Initialize chat manager
        this.chatManager = new ChatManager();
        
        // Initialize sidebar
        this.sidebar = new Sidebar(this.chatManager);
        
        // Initialize chat area
        this.chatArea = new ChatArea(this.chatManager);
        
        console.log('App initialized successfully');
    }

    setupGlobalEvents() {
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Handle beforeunload to save state
        window.addEventListener('beforeunload', () => {
            this.saveState();
        });

        // Handle visibility change to save state
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveState();
            }
        });

        // Handle online/offline status
        window.addEventListener('online', () => {
            this.handleOnlineStatus(true);
        });

        window.addEventListener('offline', () => {
            this.handleOnlineStatus(false);
        });

        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            this.handlePopState(e);
        });
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + N: New chat
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            this.chatManager.createChat();
            return;
        }

        // Ctrl/Cmd + K: Focus input
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this.chatArea.focusInput();
            return;
        }

        // Escape: Close modals or sidebar
        if (e.key === 'Escape') {
            this.handleEscapeKey();
            return;
        }
    }

    handleEscapeKey() {
        // Close modal if open
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay && modalOverlay.classList.contains('active')) {
            modalOverlay.classList.remove('active');
            return;
        }

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
                return;
            }
        }
    }

    handleOnlineStatus(isOnline) {
        // You can add online/offline handling logic here
        console.log('Connection status:', isOnline ? 'Online' : 'Offline');
        
        // Show notification
        this.showNotification(
            isOnline ? 'Connection restored' : 'Connection lost',
            isOnline ? 'success' : 'error'
        );
    }

    handlePopState(e) {
        // Handle browser back/forward navigation
        const chatId = this.chatManager.getChatIdFromURL();
        
        if (chatId && this.chatManager.getChat(chatId)) {
            this.chatManager.setCurrentChat(chatId);
        } else {
            this.chatManager.setCurrentChat(null);
        }
    }

    loadInitialState() {
        // First try to load chat from URL
        const urlChatLoaded = this.chatManager.loadChatFromURL();
        
        if (!urlChatLoaded) {
            // If no chat from URL, just show welcome message
            // Don't automatically load the most recent chat to avoid URL updates
            this.chatArea.showWelcomeMessage();
        }
        
        // The Sidebar will handle loading initial chats from server
    }

    saveState() {
        // Save current state
        try {
            this.chatManager.saveChats();
        } catch (error) {
            console.error('Error saving state:', error);
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: ${type === 'success' ? '#10a37f' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 3000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after delay
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Public methods for external access
    getChatManager() {
        return this.chatManager;
    }

    getSidebar() {
        return this.sidebar;
    }

    getChatArea() {
        return this.chatArea;
    }

    // Utility methods
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = (now - date) / (1000 * 60 * 60);

        if (diffInHours < 1) {
            return 'Just now';
        } else if (diffInHours < 24) {
            return `${Math.floor(diffInHours)}h ago`;
        } else if (diffInHours < 168) { // 7 days
            return `${Math.floor(diffInHours / 24)}d ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}
