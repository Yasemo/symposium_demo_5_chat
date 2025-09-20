// Message Manager Component
class MessageManager {
    constructor() {
        this.messages = [];
        this.messageVisibility = new Map(); // Map of messageId -> Map of consultantId -> isHidden
        this.init();
    }

    init() {
        // Listen for symposium and consultant changes
        window.addEventListener('symposiumChanged', (e) => {
            this.onSymposiumChanged(e.detail);
        });

        window.addEventListener('consultantChanged', (e) => {
            this.onConsultantChanged(e.detail);
        });
    }

    async onSymposiumChanged(symposium) {
        if (symposium) {
            await this.loadMessages(symposium.id);
        } else {
            this.messages = [];
            this.messageVisibility.clear();
        }
    }

    onConsultantChanged(consultant) {
        // Update visibility indicators when consultant changes
        this.updateVisibilityIndicators();
    }

    async loadMessages(symposiumId, objectiveId = null) {
        try {
            // For now, we'll load all messages for the symposium
            // In the future, we could filter by objective_id on the server
            this.messages = await api.getMessages(symposiumId);
            
            // Filter messages by objective if specified
            if (objectiveId) {
                this.messages = this.messages.filter(msg => msg.objective_id === objectiveId);
            }
            
            this.updateVisibilityIndicators();
        } catch (error) {
            console.error('Error loading messages:', error);
            utils.showError('Failed to load messages');
        }
    }

    initializeVisibilityMap() {
        // Initialize visibility map using data from server, defaulting to visible for new consultants
        this.messageVisibility.clear();
        const consultants = consultantManager.getConsultants();

        this.messages.forEach(message => {
            const messageVisibilityMap = new Map();

            // First, set defaults for all consultants
            consultants.forEach(consultant => {
                messageVisibilityMap.set(consultant.id, false); // false = visible, true = hidden
            });

            // Then override with persisted visibility settings from server
            if (message.visibility && Array.isArray(message.visibility)) {
                message.visibility.forEach(visibilitySetting => {
                    messageVisibilityMap.set(visibilitySetting.consultant_id, visibilitySetting.is_hidden);
                });
            }

            this.messageVisibility.set(message.id, messageVisibilityMap);
        });
    }

    addMessage(message) {
        this.messages.push(message);
        
        // Initialize visibility for new message
        const messageVisibilityMap = new Map();
        const consultants = consultantManager.getConsultants();
        consultants.forEach(consultant => {
            messageVisibilityMap.set(consultant.id, false);
        });
        this.messageVisibility.set(message.id, messageVisibilityMap);
    }

    async toggleMessageVisibility(messageId, consultantId) {
        const messageVisibilityMap = this.messageVisibility.get(messageId);
        if (!messageVisibilityMap) return;

        const currentVisibility = messageVisibilityMap.get(consultantId) || false;
        const newVisibility = !currentVisibility;
        
        try {
            await api.toggleMessageVisibility({
                message_id: messageId,
                consultant_id: consultantId,
                is_hidden: newVisibility
            });

            messageVisibilityMap.set(consultantId, newVisibility);
            this.updateVisibilityIndicators();
            
        } catch (error) {
            console.error('Error toggling message visibility:', error);
            utils.showError('Failed to update message visibility');
        }
    }

    isMessageVisible(messageId, consultantId) {
        const messageVisibilityMap = this.messageVisibility.get(messageId);
        if (!messageVisibilityMap) return true;
        
        const isHidden = messageVisibilityMap.get(consultantId) || false;
        return !isHidden;
    }

    getVisibleMessages(consultantId) {
        return this.messages.filter(message => 
            this.isMessageVisible(message.id, consultantId)
        );
    }

    updateVisibilityIndicators() {
        const activeConsultant = consultantManager.getActiveConsultant();
        if (!activeConsultant) return;

        // Update visibility indicators for all messages
        document.querySelectorAll('.message').forEach(messageElement => {
            const messageId = parseInt(messageElement.dataset.messageId);
            const isVisible = this.isMessageVisible(messageId, activeConsultant.id);
            
            messageElement.classList.toggle('hidden', !isVisible);
            
            // Update visibility toggle button
            const toggleBtn = messageElement.querySelector('.visibility-toggle');
            if (toggleBtn) {
                toggleBtn.textContent = isVisible ? '👁️' : '🚫';
                toggleBtn.title = isVisible ? 'Hide from current consultant' : 'Show to current consultant';
            }
        });
    }

    createVisibilityToggle(messageId) {
        const activeConsultant = consultantManager.getActiveConsultant();
        if (!activeConsultant) return '';

        const isVisible = this.isMessageVisible(messageId, activeConsultant.id);
        
        return `
            <button class="visibility-toggle" 
                    data-message-id="${messageId}" 
                    data-consultant-id="${activeConsultant.id}"
                    title="${isVisible ? 'Hide from current consultant' : 'Show to current consultant'}">
                ${isVisible ? '👁️' : '🚫'}
            </button>
        `;
    }

    bindVisibilityToggleEvents() {
        document.querySelectorAll('.visibility-toggle').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const messageId = parseInt(button.dataset.messageId);
                const consultantId = parseInt(button.dataset.consultantId);
                this.toggleMessageVisibility(messageId, consultantId);
            });
        });

        // Bind "Add to Knowledge Base" button events
        document.querySelectorAll('.add-to-kb-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const messageId = parseInt(button.dataset.messageId);
                this.addMessageToKnowledgeBase(messageId);
            });
        });

        // Bind edit message button events
        document.querySelectorAll('.edit-message-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const messageId = parseInt(button.dataset.messageId);
                this.startEditMessage(messageId);
            });
        });

        // Bind delete message button events
        document.querySelectorAll('.delete-message-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const messageId = parseInt(button.dataset.messageId);
                this.deleteMessage(messageId);
            });
        });
    }

    getMessages() {
        return this.messages;
    }

    getMessageVisibility() {
        return this.messageVisibility;
    }

    clearMessages() {
        this.messages = [];
        this.messageVisibility.clear();
    }

    addMessageToKnowledgeBase(messageId) {
        const message = this.messages.find(m => m.id === messageId);
        if (!message || message.is_user) return;

        // Call the knowledge base component to create a card from this message
        if (window.knowledgeBase) {
            window.knowledgeBase.createCardFromMessage(
                messageId, 
                message.content, 
                message.consultant_name || 'Assistant'
            );
        }
    }

    startEditMessage(messageId) {
        const message = this.messages.find(m => m.id === messageId);
        if (!message) return;

        const messageTextElement = document.querySelector(`.message-text[data-message-id="${messageId}"]`);
        if (!messageTextElement) return;

        // Store original content
        const originalContent = message.content;
        
        // Create textarea for editing
        const textarea = document.createElement('textarea');
        textarea.value = originalContent;
        textarea.className = 'edit-message-textarea';
        textarea.style.width = '100%';
        textarea.style.minHeight = '60px';
        textarea.style.resize = 'vertical';
        textarea.style.fontFamily = 'inherit';
        textarea.style.fontSize = 'inherit';
        textarea.style.padding = '8px';
        textarea.style.border = '1px solid #ddd';
        textarea.style.borderRadius = '4px';

        // Create save and cancel buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'edit-message-buttons';
        buttonContainer.style.marginTop = '8px';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '8px';

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.className = 'btn btn-primary btn-sm';
        saveButton.style.padding = '4px 12px';
        saveButton.style.fontSize = '12px';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'btn btn-secondary btn-sm';
        cancelButton.style.padding = '4px 12px';
        cancelButton.style.fontSize = '12px';

        buttonContainer.appendChild(saveButton);
        buttonContainer.appendChild(cancelButton);

        // Replace message text with edit interface
        const editContainer = document.createElement('div');
        editContainer.appendChild(textarea);
        editContainer.appendChild(buttonContainer);
        
        messageTextElement.style.display = 'none';
        messageTextElement.parentNode.insertBefore(editContainer, messageTextElement.nextSibling);

        // Focus textarea and select all text
        textarea.focus();
        textarea.select();

        // Auto-resize textarea
        const autoResize = () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        };
        textarea.addEventListener('input', autoResize);
        autoResize();

        // Handle save
        const handleSave = async () => {
            const newContent = textarea.value.trim();
            if (!newContent) {
                utils.showError('Message content cannot be empty');
                return;
            }

            if (newContent === originalContent) {
                handleCancel();
                return;
            }

            const success = await this.editMessage(messageId, newContent);
            if (success) {
                // Edit interface will be removed when messages are re-rendered
            }
        };

        // Handle cancel
        const handleCancel = () => {
            editContainer.remove();
            messageTextElement.style.display = '';
        };

        // Event listeners
        saveButton.addEventListener('click', handleSave);
        cancelButton.addEventListener('click', handleCancel);

        // Handle Ctrl+Enter to save, Escape to cancel
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                handleSave();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        });
    }

    async editMessage(messageId, newContent) {
        try {
            const response = await api.editMessage(messageId, newContent);
            
            if (response.success) {
                // Update local message array
                const messageIndex = this.messages.findIndex(m => m.id === messageId);
                if (messageIndex !== -1) {
                    this.messages[messageIndex] = { ...this.messages[messageIndex], ...response.message };
                }
                
                // Re-render chat interface
                if (window.chatInterface) {
                    window.chatInterface.loadMessages();
                }
                
                utils.showSuccess('Message updated successfully');
                return true;
            }
        } catch (error) {
            console.error('Error editing message:', error);
            utils.showError('Failed to edit message: ' + error.message);
            return false;
        }
    }

    async deleteMessage(messageId) {
        if (!confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
            return false;
        }

        try {
            const response = await api.deleteMessage(messageId);
            
            if (response.success) {
                // Remove from local message array
                this.messages = this.messages.filter(m => m.id !== messageId);
                
                // Remove from visibility map
                this.messageVisibility.delete(messageId);
                
                // Re-render chat interface
                if (window.chatInterface) {
                    window.chatInterface.loadMessages();
                }
                
                utils.showSuccess('Message deleted successfully');
                return true;
            }
        } catch (error) {
            console.error('Error deleting message:', error);
            utils.showError('Failed to delete message: ' + error.message);
            return false;
        }
    }
}

// Initialize message manager
window.messageManager = new MessageManager();
