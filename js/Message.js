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
     * Format content for proper display with HTML formatting
     */
    formatContent(content) {
        if (!content) return '';
        
        // First, escape HTML to prevent XSS
        let formatted = this.escapeHtml(content);
        
        // Convert markdown-style formatting to HTML
        // Handle headers (###, ##, #)
        formatted = formatted.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
        formatted = formatted.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
        formatted = formatted.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
        
        // Handle bold text (**text** or __text__) - process this first
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        
        // Handle italic text (*text* or _text_) - but avoid conflicts with bold
        // Use a more compatible approach
        formatted = formatted.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/_([^_\n]+)_/g, '<em>$1</em>');
        
        // Handle inline code (`code`)
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Handle code blocks (```code```)
        formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        // Convert line breaks to <br> tags
        formatted = formatted.replace(/\n/g, '<br>');
        
        // Convert double line breaks to paragraph breaks
        formatted = formatted.replace(/(<br>\s*){2,}/g, '</p><p>');
        formatted = '<p>' + formatted + '</p>';
        
        // Convert bullet points (•, -, *, etc.) to proper list items
        // This regex looks for bullet points at the start of lines or after <br> tags
        formatted = formatted.replace(/(<br>|^)\s*[•\-\*]\s+([^<]+?)(?=<br>|$|<\/p>)/g, '$1<li>$2</li>');
        
        // Convert numbered lists (1., 2., etc.)
        formatted = formatted.replace(/(<br>|^)\s*(\d+)\.\s+([^<]+?)(?=<br>|$|<\/p>)/g, '$1<li>$3</li>');
        
        // Wrap consecutive list items in <ul> tags
        // This is more complex - we need to find sequences of <li> tags and wrap them
        formatted = formatted.replace(/(<li>.*?<\/li>)(\s*<li>.*?<\/li>)+/g, (match) => {
            return '<ul>' + match + '</ul>';
        });
        
        // Also handle single list items
        formatted = formatted.replace(/(<br>)?<li>.*?<\/li>(<br>)?/g, (match) => {
            return '<ul>' + match.replace(/<br>/g, '') + '</ul>';
        });
        
        // Clean up empty paragraphs and fix paragraph structure
        formatted = formatted.replace(/<p>\s*<\/p>/g, '');
        formatted = formatted.replace(/<p><br><\/p>/g, '');
        formatted = formatted.replace(/<p>\s*<ul>/g, '<ul>');
        formatted = formatted.replace(/<\/ul>\s*<\/p>/g, '</ul>');
        formatted = formatted.replace(/<p>\s*<h[1-6]>/g, '<h1>');
        formatted = formatted.replace(/<h[1-6]>\s*<\/p>/g, '</h1>');
        
        // Fix any remaining <br> tags that are now redundant
        formatted = formatted.replace(/<br>\s*<ul>/g, '<ul>');
        formatted = formatted.replace(/<\/ul>\s*<br>/g, '</ul>');
        formatted = formatted.replace(/<br>\s*<h[1-6]>/g, '<h1>');
        formatted = formatted.replace(/<\/h[1-6]>\s*<br>/g, '</h1>');
        
        return formatted;
    }

    /**
     * Escape HTML to prevent XSS attacks
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

        const content = document.createElement('div');
        content.className = 'message-content';

        const text = document.createElement('div');
        text.className = 'message-text';
        text.innerHTML = this.formatContent(this.content);

        const actions = document.createElement('div');
        actions.className = 'message-actions';
        
        // Add "Show Raw Data" button for assistant messages
        if (this.role === 'assistant' && (this.dbData || this.mongoId)) {
            const rawDataBtn = document.createElement('button');
            rawDataBtn.className = 'message-action raw-data-btn';
            rawDataBtn.innerHTML = 'show data';
            rawDataBtn.title = 'Show Raw Data';
            rawDataBtn.onclick = () => this.showRawData();
            actions.appendChild(rawDataBtn);
        }

        content.appendChild(text);
        content.appendChild(actions);

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
                textElement.innerHTML = this.formatContent(this.content);
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
                    dataToShow = response.data?.data?.dbData;
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
     * Display raw data in a modal with table format and pagination
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

        // Pagination settings
        const ROWS_PER_PAGE = 50;
        const totalRecords = parsedData.length;
        const totalPages = Math.ceil(totalRecords / ROWS_PER_PAGE);
        let currentPage = 1;

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

        // Create header title element that we can update
        const headerTitle = document.createElement('h3');
        headerTitle.style.cssText = `
            color: #ffffff;
            font-size: 1.1rem;
            margin: 0;
        `;

        // Create CSV download button
        const csvDownloadBtn = document.createElement('button');
        csvDownloadBtn.className = 'csv-download-btn';
        csvDownloadBtn.innerHTML = '<i class="fas fa-download"></i> CSV';
        csvDownloadBtn.title = 'Download all data as CSV';
        csvDownloadBtn.style.cssText = `
            background: #10a37f;
            color: #ffffff;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s ease;
            margin-right: 1rem;
        `;
        csvDownloadBtn.onmouseover = () => {
            csvDownloadBtn.style.backgroundColor = '#0d8a6b';
        };
        csvDownloadBtn.onmouseout = () => {
            csvDownloadBtn.style.backgroundColor = '#10a37f';
        };

        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
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

        // Create right side container for CSV button and close button
        const rightSideContainer = document.createElement('div');
        rightSideContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 0.5rem;
        `;

        rightSideContainer.appendChild(csvDownloadBtn);
        rightSideContainer.appendChild(closeBtn);

        // CSV download functionality
        const downloadCSV = () => {
            try {
                // Get all unique keys from all records
                const allKeys = [...new Set(parsedData.flatMap(record => Object.keys(record)))];
                
                // Create CSV header row
                const csvHeader = allKeys.join(',');
                
                // Create CSV data rows
                const csvRows = parsedData.map(record => {
                    return allKeys.map(key => {
                        const value = record[key];
                        // Escape values that contain commas, quotes, or newlines
                        if (value === null || value === undefined) {
                            return '';
                        }
                        const stringValue = String(value);
                        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                            return '"' + stringValue.replace(/"/g, '""') + '"';
                        }
                        return stringValue;
                    }).join(',');
                });
                
                // Combine header and data
                const csvContent = [csvHeader, ...csvRows].join('\n');
                
                // Create and trigger download
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `raw_data_${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
            } catch (error) {
                console.error('Error generating CSV:', error);
                alert('Error generating CSV file: ' + error.message);
            }
        };

        // Add click event to CSV download button
        csvDownloadBtn.onclick = downloadCSV;

        header.appendChild(headerTitle);
        header.appendChild(rightSideContainer);

        // Create pagination controls
        const paginationControls = document.createElement('div');
        paginationControls.className = 'pagination-controls';
        paginationControls.style.cssText = `
            padding: 0.75rem 1rem;
            border-bottom: 1px solid #4d4d4d;
            display: flex;
            align-items: center;
            justify-content: space-between;
            background-color: #1f1f1f;
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
        thead.style.cssText = `
            position: sticky;
            top: 0;
            z-index: 10;
            background-color: #171717;
        `;
        
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
                background-color: #171717;
                color: #ffffff;
                position: sticky;
                top: 0;
                z-index: 10;
            `;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create table body
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);

        // Function to update pagination display
        const updatePaginationDisplay = () => {
            const startRecord = (currentPage - 1) * ROWS_PER_PAGE + 1;
            const endRecord = Math.min(currentPage * ROWS_PER_PAGE, totalRecords);
            
            headerTitle.textContent = `Raw Data (${totalRecords} record${totalRecords !== 1 ? 's' : ''}) - Page ${currentPage} of ${totalPages}`;
            
            // Update pagination controls
            paginationControls.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem; color: #ffffff;">
                    <span>Showing ${startRecord}-${endRecord} of ${totalRecords} records</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button class="pagination-btn" id="prevPage" ${currentPage === 1 ? 'disabled' : ''} style="
                        background: ${currentPage === 1 ? '#4d4d4d' : '#10a37f'};
                        color: ${currentPage === 1 ? '#666' : '#ffffff'};
                        border: none;
                        padding: 0.4rem 0.6rem;
                        border-radius: 4px;
                        cursor: ${currentPage === 1 ? 'not-allowed' : 'pointer'};
                        font-size: 0.8rem;
                    ">Previous</button>
                    <span style="color: #ffffff; padding: 0 0.5rem;">Page ${currentPage} of ${totalPages}</span>
                    <button class="pagination-btn" id="nextPage" ${currentPage === totalPages ? 'disabled' : ''} style="
                        background: ${currentPage === totalPages ? '#4d4d4d' : '#10a37f'};
                        color: ${currentPage === totalPages ? '#666' : '#ffffff'};
                        border: none;
                        padding: 0.4rem 0.6rem;
                        border-radius: 4px;
                        cursor: ${currentPage === totalPages ? 'not-allowed' : 'pointer'};
                        font-size: 0.8rem;
                    ">Next</button>
                </div>
            `;
            
            // Setup event listeners after HTML is rendered
            const prevBtn = paginationControls.querySelector('#prevPage');
            const nextBtn = paginationControls.querySelector('#nextPage');

            if (prevBtn) {
                prevBtn.onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        renderCurrentPage();
                    }
                };
            }

            if (nextBtn) {
                nextBtn.onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        renderCurrentPage();
                    }
                };
            }
        };

        // Function to render current page data
        const renderCurrentPage = () => {
            // Clear existing rows
            tbody.innerHTML = '';
            
            const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
            const endIndex = Math.min(startIndex + ROWS_PER_PAGE, totalRecords);
            
            for (let i = startIndex; i < endIndex; i++) {
                const record = parsedData[i];
                const row = document.createElement('tr');
                row.style.cssText = `
                    border-bottom: 1px solid #3d3d3d;
                    background-color: ${i % 2 === 0 ? '#2d2d2d' : '#252525'};
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
            }
            
            updatePaginationDisplay();
        };


        // Assemble modal
        tableContainer.appendChild(table);
        modalContent.appendChild(header);
        modalContent.appendChild(paginationControls);
        modalContent.appendChild(tableContainer);
        modal.appendChild(modalContent);

        // Render initial page
        renderCurrentPage();

        // Add close functionality
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
