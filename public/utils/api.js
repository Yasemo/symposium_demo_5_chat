// API utility functions
class API {
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    // Symposium endpoints
    async getSymposiums() {
        return this.request('/symposiums');
    }

    async createSymposium(data) {
        return this.request('/symposiums', {
            method: 'POST',
            body: data,
        });
    }

    // Consultant endpoints
    async getConsultants(symposiumId) {
        return this.request(`/consultants?symposium_id=${symposiumId}`);
    }

    async createConsultant(data) {
        return this.request('/consultants', {
            method: 'POST',
            body: data,
        });
    }

    async deleteConsultant(consultantId) {
        return this.request(`/consultants/${consultantId}`, {
            method: 'DELETE',
        });
    }

    // Message endpoints
    async getMessages(symposiumId) {
        return this.request(`/messages?symposium_id=${symposiumId}`);
    }

    async sendMessage(data) {
        return this.request('/chat', {
            method: 'POST',
            body: data,
        });
    }

    // Model endpoints
    async getModels() {
        return this.request('/models');
    }

    // Auth endpoints
    async getAuth() {
        return this.request('/auth');
    }

    // Message visibility
    async toggleMessageVisibility(data) {
        return this.request('/message-visibility', {
            method: 'POST',
            body: data,
        });
    }

    // Clear messages
    async clearMessages(symposiumId) {
        return this.request('/clear-messages', {
            method: 'POST',
            body: { symposium_id: symposiumId },
        });
    }

    // Edit message
    async editMessage(messageId, content) {
        return this.request(`/messages/${messageId}`, {
            method: 'PUT',
            body: { content },
        });
    }

    // Delete message
    async deleteMessage(messageId) {
        return this.request(`/messages/${messageId}`, {
            method: 'DELETE',
        });
    }

    // Airtable endpoints
    async getAirtableConfig(consultantId) {
        return this.request(`/airtable/config?consultant_id=${consultantId}`);
    }

    async saveAirtableConfig(data) {
        return this.request('/airtable/config', {
            method: 'POST',
            body: data,
        });
    }

    async testAirtableConnection(data) {
        return this.request('/airtable/test-connection', {
            method: 'POST',
            body: data,
        });
    }

    async getAirtableTables(data) {
        return this.request('/airtable/tables', {
            method: 'POST',
            body: data,
        });
    }

    // Knowledge Base endpoints
    async getKnowledgeBaseCards(symposiumId) {
        return this.request(`/knowledge-base?symposium_id=${symposiumId}`);
    }

    async createKnowledgeBaseCard(data) {
        return this.request('/knowledge-base', {
            method: 'POST',
            body: data,
        });
    }

    async createCardFromMessage(data) {
        return this.request('/knowledge-base/from-message', {
            method: 'POST',
            body: data,
        });
    }

    async updateKnowledgeBaseCard(cardId, data) {
        return this.request(`/knowledge-base/${cardId}`, {
            method: 'PUT',
            body: data,
        });
    }

    async deleteKnowledgeBaseCard(cardId) {
        return this.request(`/knowledge-base/${cardId}`, {
            method: 'DELETE',
        });
    }

    async toggleKnowledgeBaseCardVisibility(data) {
        return this.request('/knowledge-base/toggle-visibility', {
            method: 'POST',
            body: data,
        });
    }

    // Consultant Template endpoints
    async getConsultantTemplates() {
        return this.request('/consultant-templates');
    }

    // Consultant Configuration endpoints
    async getConsultantConfig(consultantId) {
        return this.request(`/consultant-config?consultant_id=${consultantId}`);
    }

    async saveConsultantConfig(data) {
        return this.request('/consultant-config', {
            method: 'POST',
            body: data,
        });
    }

    // Symposium Task endpoints
    async getSymposiumTasks(symposiumId) {
        return this.request(`/symposium-tasks?symposium_id=${symposiumId}`);
    }

    async createSymposiumTask(data) {
        return this.request('/symposium-tasks', {
            method: 'POST',
            body: data,
        });
    }

    async updateSymposiumTask(taskId, data) {
        return this.request(`/symposium-tasks/${taskId}`, {
            method: 'PUT',
            body: data,
        });
    }

    async deleteSymposiumTask(taskId) {
        return this.request(`/symposium-tasks/${taskId}`, {
            method: 'DELETE',
        });
    }

    async reorderSymposiumTasks(data) {
        return this.request('/symposium-tasks/reorder', {
            method: 'PUT',
            body: data,
        });
    }

    async generateTasks(description) {
        return this.request('/generate-tasks', {
            method: 'POST',
            body: { description },
        });
    }

    // Objectives endpoints
    async getObjectives(symposiumId) {
        return this.request(`/objectives?symposium_id=${symposiumId}`);
    }

    async createObjective(data) {
        return this.request('/objectives', {
            method: 'POST',
            body: data,
        });
    }

    // Objective Tasks endpoints
    async getObjectiveTasks(objectiveId) {
        return this.request(`/objective-tasks?objective_id=${objectiveId}`);
    }

    async createObjectiveTask(data) {
        return this.request('/objective-tasks', {
            method: 'POST',
            body: data,
        });
    }

    async updateObjectiveTask(taskId, data) {
        return this.request(`/objective-tasks/${taskId}`, {
            method: 'PUT',
            body: data,
        });
    }

    async deleteObjectiveTask(taskId) {
        return this.request(`/objective-tasks/${taskId}`, {
            method: 'DELETE',
        });
    }

    async reorderObjectiveTasks(data) {
        return this.request('/objective-tasks/reorder', {
            method: 'PUT',
            body: data,
        });
    }

    // Generate symposium structure
    async generateSymposiumStructure(description) {
        return this.request('/generate-symposium-structure', {
            method: 'POST',
            body: { description },
        });
    }
}

// Create global API instance
window.api = new API();

// Utility functions
window.utils = {
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    formatPrice(price) {
        if (price === 0) return 'Free';
        if (price < 0.001) return `$${(price * 1000000).toFixed(2)}/1M tokens`;
        if (price < 1) return `$${(price * 1000).toFixed(2)}/1K tokens`;
        return `$${price.toFixed(4)}/token`;
    },

    showLoading() {
        document.getElementById('loading-overlay').classList.add('active');
    },

    hideLoading() {
        document.getElementById('loading-overlay').classList.remove('active');
    },

    showError(message) {
        alert(`Error: ${message}`);
    },

    showSuccess(message) {
        // You could implement a toast notification here
        console.log('Success:', message);
    },

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
};
