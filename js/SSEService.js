/**
 * SSE Service to handle Server-Sent Events for real-time job status updates
 */
class SSEService {
    constructor() {
        this.baseURL = API_CONFIG.BASE_URL;
        this.activeConnections = new Map(); // jobId -> EventSource
        this.eventHandlers = new Map(); // jobId -> { onProgress, onComplete, onError }
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
            console.error('Error getting auth token for SSE:', error);
        }
        return null;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.getAuthToken() !== null;
    }

    /**
     * Connect to SSE endpoint for a specific job
     * @param {string} jobId - The job ID to track
     * @param {Object} handlers - Event handlers
     * @param {Function} handlers.onProgress - Called when job progress updates
     * @param {Function} handlers.onComplete - Called when job completes
     * @param {Function} handlers.onError - Called when job fails or connection error
     * @param {Function} handlers.onConnect - Called when SSE connection is established
     * @returns {Promise<EventSource>} The EventSource connection
     */
    async connectToJob(jobId, handlers = {}) {
        try {
            // Check if user is authenticated
            if (!this.isAuthenticated()) {
                throw new Error('User not authenticated. Please login first.');
            }

            // Close existing connection for this job if any
            this.disconnectJob(jobId);

            const endpoint = `${API_CONFIG.ENDPOINTS.SSE_JOB}/${jobId}`;
            
            // Get authentication token
            const token = this.getAuthToken();
            
            // Append token as query parameter since EventSource doesn't support headers
            const fullUrl = `${this.baseURL}${endpoint}?token=${encodeURIComponent(token)}`;
            
            console.log('Connecting to SSE endpoint:', fullUrl);

            const eventSource = new EventSource(fullUrl);
            
            // Store connection and handlers
            this.activeConnections.set(jobId, eventSource);
            this.eventHandlers.set(jobId, handlers);

            // Handle connection established
            eventSource.addEventListener('connected', (event) => {
                console.log('SSE connection established for job:', jobId);
                const data = JSON.parse(event.data);
                if (handlers.onConnect) {
                    handlers.onConnect(data);
                }
            });

            // Handle progress updates
            eventSource.addEventListener('progress', (event) => {
                console.log('Job progress update:', jobId, event.data);
                const data = JSON.parse(event.data);
                if (handlers.onProgress) {
                    handlers.onProgress(data);
                }
            });

            // Handle job completion
            eventSource.addEventListener('complete', (event) => {
                console.log('Job completed:', jobId, event.data);
                const data = JSON.parse(event.data);
                if (handlers.onComplete) {
                    handlers.onComplete(data);
                }
                // Clean up connection after completion
                this.disconnectJob(jobId);
            });

            // Handle job failure
            eventSource.addEventListener('error', (event) => {
                console.error('Job error:', jobId, event.data);
                const data = JSON.parse(event.data);
                if (handlers.onError) {
                    handlers.onError(data);
                }
                // Clean up connection after error
                this.disconnectJob(jobId);
            });

            // Handle connection errors
            eventSource.onerror = (error) => {
                console.error('SSE connection error for job:', jobId, error);
                
                // Check if it's an authentication error
                if (eventSource.readyState === EventSource.CLOSED) {
                    console.error('SSE connection closed - possible authentication failure');
                }
                
                if (handlers.onError) {
                    handlers.onError({
                        jobId: jobId,
                        error: 'Connection lost or failed',
                        type: 'connection_error',
                        readyState: eventSource.readyState
                    });
                }
                // Clean up connection on error
                this.disconnectJob(jobId);
            };

            return eventSource;

        } catch (error) {
            console.error('Failed to connect to SSE:', error);
            if (handlers.onError) {
                handlers.onError({
                    jobId: jobId,
                    error: error.message,
                    type: 'connection_failed'
                });
            }
            throw error;
        }
    }

    /**
     * Disconnect from SSE for a specific job
     * @param {string} jobId - The job ID to disconnect
     */
    disconnectJob(jobId) {
        const eventSource = this.activeConnections.get(jobId);
        if (eventSource) {
            console.log('Disconnecting SSE for job:', jobId);
            eventSource.close();
            this.activeConnections.delete(jobId);
            this.eventHandlers.delete(jobId);
        }
    }

    /**
     * Disconnect all active SSE connections
     */
    disconnectAll() {
        console.log('Disconnecting all SSE connections');
        for (const [jobId, eventSource] of this.activeConnections) {
            eventSource.close();
        }
        this.activeConnections.clear();
        this.eventHandlers.clear();
    }

    /**
     * Check if there's an active connection for a job
     * @param {string} jobId - The job ID to check
     * @returns {boolean} True if connected
     */
    isConnected(jobId) {
        return this.activeConnections.has(jobId);
    }

    /**
     * Get all active job IDs
     * @returns {Array<string>} Array of active job IDs
     */
    getActiveJobs() {
        return Array.from(this.activeConnections.keys());
    }

    /**
     * Get connection state for a job
     * @param {string} jobId - The job ID to check
     * @returns {Object} Connection state info
     */
    getConnectionState(jobId) {
        const eventSource = this.activeConnections.get(jobId);
        if (!eventSource) {
            return { connected: false, readyState: null };
        }

        return {
            connected: true,
            readyState: eventSource.readyState, // 0: CONNECTING, 1: OPEN, 2: CLOSED
            readyStateText: this.getReadyStateText(eventSource.readyState)
        };
    }

    /**
     * Get human-readable ready state
     * @param {number} readyState - EventSource ready state
     * @returns {string} Human-readable state
     */
    getReadyStateText(readyState) {
        switch (readyState) {
            case EventSource.CONNECTING: return 'Connecting';
            case EventSource.OPEN: return 'Open';
            case EventSource.CLOSED: return 'Closed';
            default: return 'Unknown';
        }
    }

    /**
     * Handle page unload - cleanup all connections
     */
    handlePageUnload() {
        this.disconnectAll();
    }
}

// Initialize global SSE service instance
window.sseService = new SSEService();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    window.sseService.handlePageUnload();
});

// Cleanup on page hide (mobile browsers)
window.addEventListener('pagehide', () => {
    window.sseService.handlePageUnload();
});
