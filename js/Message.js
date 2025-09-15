/**
 * Message class to handle individual chat messages
 */
class Message {
    constructor(id, content, role = 'user', timestamp = null, dbData = null, mongoId = null) {
        this.id = id || this.generateId();
        this.content = content;
        this.role = role; // 'user' or 'assistant'
        this.timestamp = timestamp || new Date().toISOString();
        this.isEditing = false;
        this.originalContent = content;
        this.dbData = dbData; // Raw database data from AI response
        this.mongoId = mongoId; // MongoDB document ID for fetching data from MongoDB API
    }

    generateId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Start editing this message
     */
    startEditing() {
        this.isEditing = true;
        this.originalContent = this.content;
    }

    /**
     * Save the edited content
     */
    saveEdit(newContent) {
        this.content = newContent;
        this.isEditing = false;
        this.timestamp = new Date().toISOString();
    }

    /**
     * Cancel editing and restore original content
     */
    cancelEdit() {
        this.content = this.originalContent;
        this.isEditing = false;
    }

    /**
     * Create HTML element for this message
     */
    createElement() {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${this.role}`;
        messageDiv.dataset.messageId = this.id;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = this.role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

        const content = document.createElement('div');
        content.className = 'message-content';

        const text = document.createElement('div');
        text.className = 'message-text';
        text.textContent = this.content;

        const actions = document.createElement('div');
        actions.className = 'message-actions';
        
        // Add "Show Raw Data" button for assistant messages
        if (this.role === 'assistant' && (this.dbData || this.mongoId)) {
            const rawDataBtn = document.createElement('button');
            rawDataBtn.className = 'message-action raw-data-btn';
            rawDataBtn.innerHTML = '<i class="fas fa-table"></i>';
            rawDataBtn.title = 'Show Raw Data';
            rawDataBtn.onclick = () => this.showRawData();
            actions.appendChild(rawDataBtn);
        }
        
        const editBtn = document.createElement('button');
        editBtn.className = 'message-action';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = 'Edit message';
        editBtn.onclick = () => this.startEditingInUI();

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'message-action';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = 'Delete message';
        deleteBtn.onclick = () => this.deleteFromUI();

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        content.appendChild(text);
        content.appendChild(actions);

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);

        return messageDiv;
    }

    /**
     * Start editing this message in the UI
     */
    startEditingInUI() {
        this.startEditing();
        this.updateUI();
        
        // Create edit input
        const messageElement = document.querySelector(`[data-message-id="${this.id}"]`);
        const textElement = messageElement.querySelector('.message-text');
        
        const editInput = document.createElement('textarea');
        editInput.value = this.content;
        editInput.className = 'message-edit-input';
        editInput.style.cssText = `
            width: 100%;
            background-color: #171717;
            border: 1px solid #10a37f;
            border-radius: 8px;
            padding: 0.75rem;
            color: #ffffff;
            font-size: 1rem;
            outline: none;
            resize: none;
            font-family: inherit;
        `;

        const editActions = document.createElement('div');
        editActions.className = 'message-edit-actions';
        editActions.style.cssText = `
            display: flex;
            gap: 0.5rem;
            margin-top: 0.5rem;
            justify-content: flex-end;
        `;

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'btn btn-primary';
        saveBtn.style.cssText = `
            padding: 0.25rem 0.75rem;
            font-size: 0.8rem;
        `;
        saveBtn.onclick = () => this.saveEditInUI(editInput.value);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.style.cssText = `
            padding: 0.25rem 0.75rem;
            font-size: 0.8rem;
        `;
        cancelBtn.onclick = () => this.cancelEditInUI();

        editActions.appendChild(saveBtn);
        editActions.appendChild(cancelBtn);

        textElement.innerHTML = '';
        textElement.appendChild(editInput);
        textElement.appendChild(editActions);

        editInput.focus();
        editInput.select();
    }

    /**
     * Save the edited message in the UI
     */
    saveEditInUI(newContent) {
        if (newContent.trim()) {
            this.saveEdit(newContent.trim());
            this.updateUI();
            
            // Trigger chat update event
            window.dispatchEvent(new CustomEvent('messageUpdated', {
                detail: { message: this }
            }));
        }
    }

    /**
     * Cancel editing in the UI
     */
    cancelEditInUI() {
        this.cancelEdit();
        this.updateUI();
    }

    /**
     * Delete this message from the UI
     */
    deleteFromUI() {
        if (confirm('Are you sure you want to delete this message?')) {
            const messageElement = document.querySelector(`[data-message-id="${this.id}"]`);
            if (messageElement) {
                messageElement.remove();
            }
            
            // Trigger chat update event
            window.dispatchEvent(new CustomEvent('messageDeleted', {
                detail: { message: this }
            }));
        }
    }

    /**
     * Update the UI representation of this message
     */
    updateUI() {
        const messageElement = document.querySelector(`[data-message-id="${this.id}"]`);
        if (messageElement) {
            const textElement = messageElement.querySelector('.message-text');
            if (textElement && !this.isEditing) {
                textElement.textContent = this.content;
            }
        }
    }

    /**
     * Show raw data in a modal
     */
    async showRawData() {
        try {
            let dataToShow = null;
            
            // Case 1: Data is already available in the message
            if (this.dbData) {
                dataToShow = this.dbData;
            }
            // Case 2: Fetch data from MongoDB API
            else if (this.mongoId) {
                const apiService = new ApiService();
                const response = await apiService.getDbData(this.mongoId);
                if (response.success && response.data) {
                    dataToShow = response.data;
                } else {
                    throw new Error('Failed to fetch data from server');
                }
            }
            
            if (dataToShow) {
                this.displayRawDataModal(dataToShow);
            } else {
                alert('No raw data available for this message');
            }
        } catch (error) {
            console.error('Error showing raw data:', error);
            alert('Error loading raw data: ' + error.message);
        }
    }

    /**
     * Display raw data in a modal with table format
     */
    displayRawDataModal(data) {
        // Parse the JSON data
        let parsedData;
        try {
            parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        } catch (error) {
            console.error('Error parsing data:', error);
            alert('Error parsing data: ' + error.message);
            return;
        }

        // Ensure it's an array
        if (!Array.isArray(parsedData)) {
            parsedData = [parsedData];
        }

        if (parsedData.length === 0) {
            alert('No data to display');
            return;
        }

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay raw-data-modal';
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

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'raw-data-modal-content';
        modalContent.style.cssText = `
            background-color: #2d2d2d;
            border-radius: 12px;
            width: 90%;
            max-width: 1000px;
            max-height: 80vh;
            border: 1px solid #4d4d4d;
            display: flex;
            flex-direction: column;
        `;

        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #4d4d4d;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;
        header.innerHTML = `
            <h3 style="color: #ffffff; font-size: 1.1rem; margin: 0;">Raw Data (${parsedData.length} record${parsedData.length !== 1 ? 's' : ''})</h3>
            <button class="modal-close" style="background: none; border: none; color: #9ca3af; cursor: pointer; padding: 0.25rem; border-radius: 4px; transition: all 0.2s ease;">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Create table container
        const tableContainer = document.createElement('div');
        tableContainer.style.cssText = `
            flex: 1;
            overflow: auto;
            padding: 1rem;
        `;

        // Create table
        const table = document.createElement('table');
        table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            color: #ffffff;
            font-size: 0.9rem;
        `;

        // Get all unique keys from all records
        const allKeys = [...new Set(parsedData.flatMap(record => Object.keys(record)))];
        
        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.style.cssText = `
            background-color: #171717;
            border-bottom: 2px solid #4d4d4d;
        `;
        
        allKeys.forEach(key => {
            const th = document.createElement('th');
            th.textContent = key;
            th.style.cssText = `
                padding: 0.75rem;
                text-align: left;
                font-weight: 600;
                border-right: 1px solid #4d4d4d;
            `;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create table body
        const tbody = document.createElement('tbody');
        parsedData.forEach((record, index) => {
            const row = document.createElement('tr');
            row.style.cssText = `
                border-bottom: 1px solid #3d3d3d;
                background-color: ${index % 2 === 0 ? '#2d2d2d' : '#252525'};
            `;
            
            allKeys.forEach(key => {
                const td = document.createElement('td');
                const value = record[key];
                td.textContent = value !== null && value !== undefined ? String(value) : '';
                td.style.cssText = `
                    padding: 0.75rem;
                    border-right: 1px solid #3d3d3d;
                    word-break: break-word;
                    max-width: 200px;
                `;
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        tableContainer.appendChild(table);
        modalContent.appendChild(header);
        modalContent.appendChild(tableContainer);
        modal.appendChild(modalContent);

        // Add close functionality
        const closeBtn = header.querySelector('.modal-close');
        closeBtn.onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        };

        // Add to document
        document.body.appendChild(modal);
    }

    /**
     * Convert message to JSON
     */
    toJSON() {
        return {
            id: this.id,
            content: this.content,
            role: this.role,
            timestamp: this.timestamp,
            dbData: this.dbData,
            mongoId: this.mongoId
        };
    }

    /**
     * Create message from JSON
     */
    static fromJSON(data) {
        const message = new Message(data.id, data.content, data.role, data.timestamp, data.dbData, data.mongoId);
        return message;
    }
}
