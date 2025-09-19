// Consultant Manager Component
class ConsultantManager {
    constructor() {
        this.consultants = [];
        this.activeConsultant = null;
        this.availableModels = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadModels();
        
        // Listen for symposium changes
        window.addEventListener('symposiumChanged', (e) => {
            this.onSymposiumChanged(e.detail);
        });
    }

    bindEvents() {
        // Add consultant button
        document.getElementById('add-consultant-btn').addEventListener('click', () => {
            this.showCreateModal();
        });

        // Modal events
        const modal = document.getElementById('consultant-modal');
        const closeBtn = modal.querySelector('.close-btn');
        const cancelBtn = document.getElementById('cancel-consultant');
        const form = document.getElementById('consultant-form');
        const modelSelect = document.getElementById('consultant-model');
        const modelSearch = document.getElementById('model-search');

        closeBtn.addEventListener('click', () => this.hideCreateModal());
        cancelBtn.addEventListener('click', () => this.hideCreateModal());
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideCreateModal();
            }
        });

        // Model selection change
        modelSelect.addEventListener('change', () => {
            this.updateModelInfo();
        });

        // Model search functionality
        modelSearch.addEventListener('input', (e) => {
            this.filterModels(e.target.value);
        });

        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createConsultant();
        });
    }

    async loadModels() {
        try {
            const response = await api.getModels();
            this.availableModels = response.models;
            this.populateModelSelect();
        } catch (error) {
            console.error('Error loading models:', error);
            utils.showError('Failed to load available models');
        }
    }

    populateModelSelect(filteredModels = null) {
        const select = document.getElementById('consultant-model');
        const modelsToShow = filteredModels || this.availableModels;
        
        select.innerHTML = '<option value="">Select a model...</option>';
        
        modelsToShow.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            option.dataset.model = JSON.stringify(model);
            select.appendChild(option);
        });
    }

    filterModels(searchTerm) {
        if (!searchTerm.trim()) {
            this.populateModelSelect();
            return;
        }

        const filtered = this.availableModels.filter(model => {
            const searchLower = searchTerm.toLowerCase();
            return (
                model.name.toLowerCase().includes(searchLower) ||
                model.id.toLowerCase().includes(searchLower) ||
                (model.description && model.description.toLowerCase().includes(searchLower)) ||
                (model.top_provider && model.top_provider.name && model.top_provider.name.toLowerCase().includes(searchLower))
            );
        });

        this.populateModelSelect(filtered);
    }

    updateModelInfo() {
        const select = document.getElementById('consultant-model');
        const infoDiv = document.getElementById('model-info');
        
        if (!select.value) {
            infoDiv.innerHTML = '';
            return;
        }

        const modelData = JSON.parse(select.selectedOptions[0].dataset.model);
        
        infoDiv.innerHTML = `
            <div>
                <strong>${modelData.name}</strong>
                ${modelData.description ? `<p>${modelData.description}</p>` : ''}
                <div class="model-pricing">
                    <div class="pricing-item">
                        <div class="pricing-label">Input</div>
                        <div class="pricing-value">${utils.formatPrice(modelData.pricing.prompt)}</div>
                    </div>
                    <div class="pricing-item">
                        <div class="pricing-label">Output</div>
                        <div class="pricing-value">${utils.formatPrice(modelData.pricing.completion)}</div>
                    </div>
                    <div class="pricing-item">
                        <div class="pricing-label">Context</div>
                        <div class="pricing-value">${modelData.context_length.toLocaleString()}</div>
                    </div>
                </div>
            </div>
        `;
    }

    async onSymposiumChanged(symposium) {
        if (symposium) {
            await this.loadConsultants(symposium.id);
            document.getElementById('add-consultant-btn').disabled = false;
        } else {
            this.consultants = [];
            this.activeConsultant = null;
            this.updateUI();
            document.getElementById('add-consultant-btn').disabled = true;
        }
    }

    async loadConsultants(symposiumId) {
        try {
            this.consultants = await api.getConsultants(symposiumId);
            this.updateUI();
            
            // Auto-select first consultant if available
            if (this.consultants.length > 0 && !this.activeConsultant) {
                this.setActiveConsultant(this.consultants[0]);
            }
        } catch (error) {
            console.error('Error loading consultants:', error);
            utils.showError('Failed to load consultants');
        }
    }

    showCreateModal() {
        const modal = document.getElementById('consultant-modal');
        modal.classList.add('active');
        
        // Focus on the name input
        setTimeout(() => {
            document.getElementById('consultant-name').focus();
        }, 100);
    }

    hideCreateModal() {
        const modal = document.getElementById('consultant-modal');
        modal.classList.remove('active');
        
        // Reset form
        document.getElementById('consultant-form').reset();
        document.getElementById('model-info').innerHTML = '';
        document.getElementById('model-search').value = '';
        
        // Reset model list to show all models
        this.populateModelSelect();
    }

    async createConsultant() {
        const symposium = symposiumManager.getCurrentSymposium();
        if (!symposium) {
            utils.showError('Please create a symposium first');
            return;
        }

        const name = document.getElementById('consultant-name').value.trim();
        const model = document.getElementById('consultant-model').value;
        const systemPrompt = document.getElementById('consultant-prompt').value.trim();

        if (!name || !model || !systemPrompt) {
            utils.showError('Please fill in all fields');
            return;
        }

        try {
            utils.showLoading();
            
            const consultant = await api.createConsultant({
                symposium_id: symposium.id,
                name,
                model,
                system_prompt: systemPrompt
            });

            this.consultants.push(consultant);
            this.updateUI();
            this.hideCreateModal();
            utils.showSuccess('Consultant added successfully!');
            
            // Auto-select the new consultant
            this.setActiveConsultant(consultant);
            
        } catch (error) {
            console.error('Error creating consultant:', error);
            utils.showError('Failed to create consultant');
        } finally {
            utils.hideLoading();
        }
    }

    setActiveConsultant(consultant) {
        this.activeConsultant = consultant;
        this.updateUI();
        
        // Notify other components
        window.dispatchEvent(new CustomEvent('consultantChanged', {
            detail: consultant
        }));
    }

    updateUI() {
        this.updateConsultantsList();
        this.updateActiveConsultant();
    }

    updateConsultantsList() {
        const listContainer = document.getElementById('consultants-list');
        
        if (this.consultants.length === 0) {
            listContainer.innerHTML = '<p class="empty-state">No consultants yet</p>';
            return;
        }

        listContainer.innerHTML = this.consultants.map(consultant => `
            <div class="consultant-item ${this.activeConsultant?.id === consultant.id ? 'active' : ''}" 
                 data-consultant-id="${consultant.id}">
                <div class="consultant-name">${consultant.name}</div>
                <div class="consultant-model">${consultant.model}</div>
            </div>
        `).join('');

        // Bind click events
        listContainer.querySelectorAll('.consultant-item').forEach(item => {
            item.addEventListener('click', () => {
                const consultantId = parseInt(item.dataset.consultantId);
                const consultant = this.consultants.find(c => c.id === consultantId);
                if (consultant) {
                    this.setActiveConsultant(consultant);
                }
            });
        });
    }

    updateActiveConsultant() {
        const container = document.getElementById('active-consultant');
        
        if (!this.activeConsultant) {
            container.innerHTML = '<p class="empty-state">Select a consultant</p>';
            return;
        }

        container.innerHTML = `
            <div class="consultant-details">
                <h4>${this.activeConsultant.name}</h4>
                <div class="consultant-model">${this.activeConsultant.model}</div>
                <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #6b7280;">
                    ${this.activeConsultant.system_prompt}
                </p>
            </div>
        `;
    }

    getActiveConsultant() {
        return this.activeConsultant;
    }

    getConsultants() {
        return this.consultants;
    }
}

// Initialize consultant manager
window.consultantManager = new ConsultantManager();
