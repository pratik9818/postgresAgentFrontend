/**
 * Message class to handle individual chat messages
 */
class Message {
    constructor(id, content, role = 'user', timestamp = null) {
        this.id = id || this.generateId();
        this.content = content;
        this.role = role; // 'user' or 'assistant'
        this.timestamp = timestamp || new Date().toISOString();
        this.isEditing = false;
        this.originalContent = content;
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
     * Convert message to JSON
     */
    toJSON() {
        return {
            id: this.id,
            content: this.content,
            role: this.role,
            timestamp: this.timestamp
        };
    }

    /**
     * Create message from JSON
     */
    static fromJSON(data) {
        const message = new Message(data.id, data.content, data.role, data.timestamp);
        return message;
    }
}
