/**
 * Database Credentials Service
 * Handles database credentials setup and editing functionality
 */
class DbCredentialsService {
    constructor() {
        this.isEditMode = false;
        this.isPasswordVisible = false;
        this.init();
    }

    init() {
        this.checkUserAuthentication();
        this.setupEventListeners();
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
     * Check if user has valid authentication token
     */
    hasValidToken() {
        const token = this.getAuthToken();
        if (!token) {
            // No token, redirect to login
            localStorage.removeItem(API_CONFIG.STORAGE_KEYS.USER_DATA);
            window.location.href = '../index.html';
            return false;
        }
        return true;
    }

    /**
     * Check user authentication and database credentials status
     */
    checkUserAuthentication() {
        // First check if user has valid token
        if (!this.hasValidToken()) {
            return;
        }

        const userData = localStorage.getItem(API_CONFIG.STORAGE_KEYS.USER_DATA);
        if (!userData) {
            // No user data, redirect to login
            window.location.href = '../index.html';
            return;
        }

        try {
            const user = JSON.parse(userData);
            
            
            // Check if user has database password set
            if (user.user && user.user.dbPassword === null) {
                // New user, need to setup database credentials for the first time
                this.isEditMode = false;
                this.updatePageContent('Setup Database Connection', 'Configure your database connection settings', 'Save Credentials');
            } else if (user.user && user.user.dbPassword === true) {
                // Existing user with dbPassword = true, fetch and show existing credentials
                this.isEditMode = true;
                this.updatePageContent('Edit Database Connection', 'Update your database connection settings', 'Update Credentials');
                document.getElementById('backToChat').style.display = 'block';
                
                // Load existing credentials from API
                this.loadExistingCredentials();
            } else {
                // User has credentials but dbPassword is not true, redirect to chat
                window.location.href = '../pages/chat.html';
            }
        } catch (error) {
            localStorage.removeItem(API_CONFIG.STORAGE_KEYS.USER_DATA);
            window.location.href = '../index.html';
        }
    }

    /**
     * Update page content based on mode
     */
    updatePageContent(title, description, buttonText) {
        document.getElementById('pageTitle').textContent = title;
        document.getElementById('pageDescription').textContent = description;
        document.getElementById('saveBtn').querySelector('.btn-text').textContent = buttonText;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Password visibility toggle
        document.getElementById('passwordToggle').addEventListener('click', () => {
            this.togglePasswordVisibility();
        });

        // Form submission
        document.getElementById('dbCredentialsForm').addEventListener('submit', (e) => {
            this.handleFormSubmission(e);
        });
    }

    /**
     * Toggle password visibility
     */
    togglePasswordVisibility() {
        const passwordInput = document.getElementById('password');
        const eyeIcon = document.getElementById('passwordToggle').querySelector('.eye-icon');
        
        this.isPasswordVisible = !this.isPasswordVisible;
        
        if (this.isPasswordVisible) {
            passwordInput.type = 'text';
            eyeIcon.textContent = '🙈';
        } else {
            passwordInput.type = 'password';
            eyeIcon.textContent = '👁️';
        }
    }

    /**
     * Load existing database credentials from API
     */
    async loadExistingCredentials() {
        // Check if user has valid token
        if (!this.hasValidToken()) {
            return;
        }

        try {
            this.showLoading(true);
            this.showMessage('Loading existing credentials...', 'success');
            
            const token = this.getAuthToken();
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CLIENT_DB}`, {
                method: 'GET',
                headers: {
                    'Content-Type': API_CONFIG.HEADERS.CONTENT_TYPE,
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                // Handle the actual API response structure
                const credentials = data.decryptedCredentials || data.credentials;
                const isSuccess = data.success !== false && credentials; // Consider it successful if we have credentials
                
                if (isSuccess && credentials) {
                    
                    // Check if form elements exist
                    const userField = document.getElementById('user');
                    const hostField = document.getElementById('host');
                    const databaseField = document.getElementById('database');
                    const passwordField = document.getElementById('password');
                    const portField = document.getElementById('port');
                    
                    
                    // Populate form with existing credentials
                    if (userField) userField.value = credentials.user || '';
                    if (hostField) hostField.value = credentials.host || '';
                    if (databaseField) databaseField.value = credentials.database || '';
                    if (passwordField) passwordField.value = credentials.password || '';
                    if (portField) portField.value = credentials.port || '';
                    
                    
                    this.showMessage('Existing credentials loaded successfully', 'success');
                } else {
                    this.showMessage('No existing credentials found', 'error');
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                this.showMessage(`Failed to load existing credentials: ${errorData.message || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            this.showMessage('Network error: Unable to load credentials', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Handle form submission
     */
    async handleFormSubmission(e) {
        e.preventDefault();
        
        // Check if user has valid token
        if (!this.hasValidToken()) {
            return;
        }
        
        const formData = new FormData(e.target);
        const credentials = {
            user: formData.get('user'),
            host: formData.get('host'),
            database: formData.get('database'),
            password: formData.get('password'),
            port: parseInt(formData.get('port'))
        };

        // Validate form data
        if (!this.validateCredentials(credentials)) {
            return;
        }

        try {
            this.showLoading(true);
            this.showMessage('', 'error');
            this.showMessage('', 'success');

            const token = this.getAuthToken();
            const action = this.isEditMode ? 'updating' : 'saving';
            this.showMessage(`${action.charAt(0).toUpperCase() + action.slice(1)} database credentials...`, 'success');
            
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CLIENT_DB}`, {
                method: 'POST',
                headers: {
                    'Content-Type': API_CONFIG.HEADERS.CONTENT_TYPE,
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(credentials)
            });

            const data = await response.json();
            this.showLoading(false);


            // Handle different response structures - consider it successful if status is ok and we have a message
            const isSuccess = data.success === true || (response.ok && (data.message || data.success !== false));

            if (isSuccess) {
                const successMessage = this.isEditMode 
                    ? 'Database credentials updated successfully!' 
                    : 'Database credentials saved successfully!';
                this.showMessage(successMessage, 'success');
                
                
                // Update localStorage: set dbPassword to true after successful API call
                this.updateUserDataInStorage();

                // Redirect to chat page after successful save/update
                setTimeout(() => {
                    window.location.href = '../pages/chat.html';
                }, API_CONFIG.DEFAULTS.REDIRECT_DELAY);
            } else {
                this.showMessage(data.message || `Failed to ${action} credentials`, 'error');
            }
        } catch (error) {
            this.showLoading(false);
            console.error('Error:', error);
            this.showMessage('Network error: Unable to connect to server', 'error');
        }
    }

    /**
     * Validate credentials
     */
    validateCredentials(credentials) {
        if (!credentials.user || !credentials.host || !credentials.database || !credentials.password || !credentials.port) {
            this.showMessage('Please fill in all fields', 'error');
            return false;
        }

        if (credentials.port < API_CONFIG.DEFAULTS.PORT_MIN || credentials.port > API_CONFIG.DEFAULTS.PORT_MAX) {
            this.showMessage(`Port must be between ${API_CONFIG.DEFAULTS.PORT_MIN} and ${API_CONFIG.DEFAULTS.PORT_MAX}`, 'error');
            return false;
        }

        return true;
    }

    /**
     * Update user data in localStorage - set dbPassword to true
     */
    updateUserDataInStorage() {
        try {
            const rawUserData = localStorage.getItem(API_CONFIG.STORAGE_KEYS.USER_DATA);
            
            const userData = JSON.parse(rawUserData);
            
            if (userData && userData.user) {
                
                // Update dbPassword to true after successful API call
                userData.user.dbPassword = true;
                localStorage.setItem(API_CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
                
                
                // Verify the update
                const verifyData = JSON.parse(localStorage.getItem(API_CONFIG.STORAGE_KEYS.USER_DATA));
            } else {
                console.error('userData:', userData);
            }
        } catch (error) {
            console.error('Error updating localStorage:', error);
        }
    }

    /**
     * Show loading state
     */
    showLoading(show) {
        const saveBtn = document.getElementById('saveBtn');
        const btnText = saveBtn.querySelector('.btn-text');
        const btnLoading = saveBtn.querySelector('.btn-loading');
        
        if (show) {
            btnText.style.display = 'none';
            btnLoading.style.display = 'inline';
            saveBtn.disabled = true;
        } else {
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
            saveBtn.disabled = false;
        }
    }

    /**
     * Clear form fields
     */
    clearFormFields() {
        document.getElementById('user').value = '';
        document.getElementById('host').value = '';
        document.getElementById('database').value = '';
        document.getElementById('password').value = '';
        document.getElementById('port').value = '';
    }

    /**
     * Show message to user
     */
    showMessage(message, type) {
        
        const errorEl = document.getElementById('errorMessage');
        const successEl = document.getElementById('successMessage');
        
        if (type === 'error') {
            errorEl.textContent = message;
            errorEl.style.display = message ? 'block' : 'none';
            successEl.style.display = 'none';
        } else if (type === 'success') {
            successEl.textContent = message;
            successEl.style.display = message ? 'block' : 'none';
            errorEl.style.display = 'none';
        }
    }
}

// Initialize the service when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new DbCredentialsService();
});
