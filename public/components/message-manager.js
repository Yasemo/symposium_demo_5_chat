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

    async loadMessages(symposiumId) {
        try {
            this.messages = await api.getMessages(symposiumId);
            this.initializeVisibilityMap();
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
}

// Initialize message manager
window.messageManager = new MessageManager();
