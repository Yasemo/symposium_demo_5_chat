// Consultant Manager Component
class ConsultantManager {
    constructor() {
        this.consultants = [];
        this.activeConsultant = null;
        this.availableModels = [];

        // Debounced filter functions for better performance
        this.debouncedFilterModels = this.debounce((searchTerm) => this.filterModels(searchTerm), 150);
        this.debouncedFilterEditModels = this.debounce((searchTerm) => this.filterEditModels(searchTerm), 150);
        this.debouncedFilterAirtableModels = this.debounce((searchTerm) => this.filterAirtableModels(searchTerm), 150);

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

    // Utility method for debouncing
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

    bindEvents() {
        // Manage consultants button (gear icon)
        document.getElementById('manage-consultants-btn').addEventListener('click', () => {
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
            this.debouncedFilterModels(e.target.value);
        });

        // Show/hide model list on focus/blur
        modelSearch.addEventListener('focus', () => {
            const container = document.getElementById('model-list-container');
            if (container) {
                container.classList.add('active');
            }
        });

        modelSearch.addEventListener('blur', () => {
            // Delay hiding to allow for clicks on model items
            setTimeout(() => {
                const container = document.getElementById('model-list-container');
                if (container) {
                    container.classList.remove('active');
                }
            }, 150);
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
            // Don't populate list here - it will be populated when modal opens
        } catch (error) {
            console.error('Error loading models:', error);
            utils.showError('Failed to load available models');
        }
    }

    populateModelList(filteredModels = null) {
        const modelList = document.getElementById('model-list');
        const modelsToShow = filteredModels || this.availableModels;

        modelList.innerHTML = '';

        if (modelsToShow.length === 0) {
            modelList.innerHTML = '<div class="model-list-item no-results">No models found</div>';
            return;
        }

        modelsToShow.forEach(model => {
            const modelItem = document.createElement('div');
            modelItem.className = 'model-list-item';
            modelItem.dataset.modelId = model.id;
            modelItem.dataset.model = JSON.stringify(model);
            modelItem.innerHTML = `
                <div class="model-name">${model.name}</div>
                <div class="model-details">
                    <span class="model-id">${model.id}</span>
                    ${model.top_provider ? `<span class="model-provider">${model.top_provider.name}</span>` : ''}
                </div>
            `;

            modelItem.addEventListener('click', () => {
                this.selectModel(model.id, model);
            });

            modelList.appendChild(modelItem);
        });
    }

    selectModel(modelId, modelData) {
        // Update hidden input
        const hiddenInput = document.getElementById('consultant-model');
        hiddenInput.value = modelId;

        // Update visual selection
        const modelItems = document.querySelectorAll('.model-list-item');
        modelItems.forEach(item => {
            item.classList.remove('selected');
        });

        const selectedItem = document.querySelector(`.model-list-item[data-model-id="${modelId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }

        // Update model info
        this.updateModelInfo(modelData);
    }

    filterModels(searchTerm) {
        const modelList = document.getElementById('model-list');
        const searchInput = document.getElementById('model-search');

        if (!searchTerm.trim()) {
            // Show all models
            const modelItems = modelList.querySelectorAll('.model-list-item');
            modelItems.forEach(item => {
                item.style.display = 'block';
            });
            searchInput.classList.remove('has-results');
            return;
        }

        const searchLower = searchTerm.toLowerCase();
        let hasResults = false;

        const modelItems = modelList.querySelectorAll('.model-list-item');
        modelItems.forEach(item => {
            const modelId = item.dataset.modelId;
            const model = this.availableModels.find(m => m.id === modelId);

            if (model) {
                const matches = (
                    model.name.toLowerCase().includes(searchLower) ||
                    model.id.toLowerCase().includes(searchLower) ||
                    (model.description && model.description.toLowerCase().includes(searchLower)) ||
                    (model.top_provider && model.top_provider.name && model.top_provider.name.toLowerCase().includes(searchLower))
                );

                item.style.display = matches ? 'block' : 'none';
                if (matches) hasResults = true;
            }
        });

        // Add visual feedback for search results
        if (hasResults) {
            searchInput.classList.add('has-results');
        } else {
            searchInput.classList.remove('has-results');
        }
    }

    updateModelInfo(modelData) {
        const infoDiv = document.getElementById('model-info');

        if (!modelData) {
            infoDiv.innerHTML = '';
            return;
        }

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
            document.getElementById('manage-consultants-btn').disabled = false;
        } else {
            this.consultants = [];
            this.activeConsultant = null;
            this.updateUI();
            document.getElementById('manage-consultants-btn').disabled = true;
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
        // Check if we have consultants - if so, show management modal, otherwise show template selection
        if (this.consultants.length > 0) {
            this.showManagementModal();
        } else {
            this.showTemplateSelection();
        }
    }

    showManagementModal() {
        const modal = document.getElementById('consultant-modal');
        const modalHeader = modal.querySelector('.modal-header h2');
        const modalBody = modal.querySelector('.modal-body');
        
        modalHeader.textContent = 'Manage Consultants';
        
        modalBody.innerHTML = `
            <div class="consultant-management">
                <div class="management-header">
                    <h3>Current Consultants</h3>
                    <button class="btn btn-primary btn-small" id="add-new-consultant">+ Add New</button>
                </div>
                
                <div class="consultants-management-list">
                    ${this.consultants.map(consultant => `
                        <div class="consultant-management-item" data-consultant-id="${consultant.id}">
                            <div class="consultant-management-info">
                                <div class="consultant-management-name">${consultant.name}</div>
                                <div class="consultant-management-model">${consultant.model}</div>
                                <div class="consultant-management-prompt">${consultant.system_prompt.substring(0, 100)}${consultant.system_prompt.length > 100 ? '...' : ''}</div>
                            </div>
                            <div class="consultant-management-actions">
                                <button class="btn btn-secondary btn-small edit-consultant-btn" data-consultant-id="${consultant.id}">Edit</button>
                                <button class="btn btn-secondary btn-small delete-consultant-btn" data-consultant-id="${consultant.id}">Delete</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="close-management">Close</button>
                </div>
            </div>
        `;
        
        modal.classList.add('active');
        
        // Bind management events
        document.getElementById('add-new-consultant').addEventListener('click', () => {
            this.showTemplateSelection();
        });
        
        document.getElementById('close-management').addEventListener('click', () => {
            this.hideCreateModal();
        });
        
        // Bind edit buttons
        modalBody.querySelectorAll('.edit-consultant-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const consultantId = parseInt(btn.dataset.consultantId);
                const consultant = this.consultants.find(c => c.id === consultantId);
                if (consultant) {
                    this.showEditConsultantForm(consultant);
                }
            });
        });
        
        // Bind delete buttons
        modalBody.querySelectorAll('.delete-consultant-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const consultantId = parseInt(btn.dataset.consultantId);
                const consultant = this.consultants.find(c => c.id === consultantId);
                if (consultant) {
                    this.showDeleteConfirmation(consultant);
                }
            });
        });
    }

    showEditConsultantForm(consultant) {
        const modal = document.getElementById('consultant-modal');
        const modalHeader = modal.querySelector('.modal-header h2');
        const modalBody = modal.querySelector('.modal-body');
        
        modalHeader.textContent = 'Edit Consultant';
        
        modalBody.innerHTML = `
            <form id="edit-consultant-form">
                <div class="form-group">
                    <label for="edit-consultant-name">Consultant Name</label>
                    <input type="text" id="edit-consultant-name" value="${consultant.name}" required>
                </div>
                <div class="form-group">
                    <label for="edit-consultant-model">LLM Model</label>
                    <div class="model-search-container">
                        <input type="text" id="edit-model-search" placeholder="Search models..." class="model-search-input">
                        <select id="edit-consultant-model" required>
                            <option value="">Loading models...</option>
                        </select>
                    </div>
                    <div id="edit-model-info" class="model-info"></div>
                </div>
                <div class="form-group">
                    <label for="edit-consultant-prompt">System Prompt</label>
                    <textarea id="edit-consultant-prompt" rows="6" required>${consultant.system_prompt}</textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="back-to-management">← Back</button>
                    <button type="button" class="btn btn-secondary" id="cancel-edit">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        `;
        
        // Bind edit form events
        this.bindEditFormEvents(consultant);
        this.populateEditModelSelect(consultant.model);
        
        // Focus on the name input
        setTimeout(() => {
            document.getElementById('edit-consultant-name').focus();
        }, 100);
    }

    bindEditFormEvents(consultant) {
        const form = document.getElementById('edit-consultant-form');
        const cancelBtn = document.getElementById('cancel-edit');
        const backBtn = document.getElementById('back-to-management');
        const modelSelect = document.getElementById('edit-consultant-model');
        const modelSearch = document.getElementById('edit-model-search');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateConsultant(consultant);
        });

        cancelBtn.addEventListener('click', () => this.hideCreateModal());
        backBtn.addEventListener('click', () => this.showManagementModal());

        modelSelect.addEventListener('change', () => this.updateEditModelInfo());
        modelSearch.addEventListener('input', (e) => this.debouncedFilterEditModels(e.target.value));
    }

    populateEditModelSelect(selectedModel, filteredModels = null) {
        const select = document.getElementById('edit-consultant-model');
        const modelsToShow = filteredModels || this.availableModels;
        
        select.innerHTML = '<option value="">Select a model...</option>';
        
        modelsToShow.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            option.dataset.model = JSON.stringify(model);
            if (model.id === selectedModel) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        // Update model info for the selected model
        if (selectedModel) {
            this.updateEditModelInfo();
        }
    }

    filterEditModels(searchTerm) {
        const select = document.getElementById('edit-consultant-model');
        const searchInput = document.getElementById('edit-model-search');
        const consultant = this.consultants.find(c => c.id === parseInt(document.getElementById('edit-consultant-form').dataset.consultantId));
        const selectedModel = consultant ? consultant.model : null;

        if (!searchTerm.trim()) {
            this.populateEditModelSelect(selectedModel);
            searchInput.classList.remove('has-results');
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

        this.populateEditModelSelect(selectedModel, filtered);

        // Add visual feedback for search results
        if (filtered.length > 0) {
            searchInput.classList.add('has-results');
        } else {
            searchInput.classList.remove('has-results');
        }

        // Force dropdown to show filtered results
        if (filtered.length > 0) {
            select.size = Math.min(filtered.length + 1, 10);
            setTimeout(() => {
                select.size = 1;
            }, 100);
        }
    }

    updateEditModelInfo() {
        const select = document.getElementById('edit-consultant-model');
        const infoDiv = document.getElementById('edit-model-info');
        
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

    async updateConsultant(consultant) {
        const name = document.getElementById('edit-consultant-name').value.trim();
        const model = document.getElementById('edit-consultant-model').value;
        const systemPrompt = document.getElementById('edit-consultant-prompt').value.trim();

        if (!name || !model || !systemPrompt) {
            utils.showError('Please fill in all fields');
            return;
        }

        try {
            utils.showLoading();
            
            // Update consultant via API (we'll need to add this endpoint)
            const updatedConsultant = await api.updateConsultant(consultant.id, {
                name,
                model,
                system_prompt: systemPrompt
            });

            // Update local consultant data
            const index = this.consultants.findIndex(c => c.id === consultant.id);
            if (index !== -1) {
                this.consultants[index] = { ...this.consultants[index], name, model, system_prompt: systemPrompt };
            }

            // Update active consultant if it's the one being edited
            if (this.activeConsultant && this.activeConsultant.id === consultant.id) {
                this.activeConsultant = this.consultants[index];
            }

            this.updateUI();
            this.hideCreateModal();
            utils.showSuccess('Consultant updated successfully!');
            
        } catch (error) {
            console.error('Error updating consultant:', error);
            utils.showError('Failed to update consultant');
        } finally {
            utils.hideLoading();
        }
    }

    showTemplateSelection() {
        const modal = document.getElementById('consultant-modal');
        const modalHeader = modal.querySelector('.modal-header h2');
        const modalBody = modal.querySelector('.modal-body');
        
        modalHeader.textContent = 'Add Consultant';
        
        modalBody.innerHTML = `
            <div class="template-selection">
                <h3>Choose Consultant Type</h3>
                <div class="template-options">
                    <div class="template-option" data-template="custom">
                        <div class="template-icon">🤖</div>
                        <h4>Custom Consultant</h4>
                        <p>Create a consultant from scratch with your own system prompt and model selection.</p>
                    </div>
                    <div class="template-option" data-template="airtable">
                        <div class="template-icon">📊</div>
                        <h4>Airtable Data Assistant</h4>
                        <p>Pre-configured consultant specialized in querying and analyzing Airtable databases.</p>
                    </div>
                </div>
            </div>
        `;
        
        modal.classList.add('active');
        
        // Bind template selection events
        modalBody.querySelectorAll('.template-option').forEach(option => {
            option.addEventListener('click', () => {
                const template = option.dataset.template;
                if (template === 'custom') {
                    this.showCustomConsultantForm();
                } else if (template === 'airtable') {
                    this.showAirtableConsultantForm();
                }
            });
        });
    }

    showCustomConsultantForm() {
        const modal = document.getElementById('consultant-modal');
        const modalHeader = modal.querySelector('.modal-header h2');
        const modalBody = modal.querySelector('.modal-body');
        
        modalHeader.textContent = 'Create Custom Consultant';
        
        modalBody.innerHTML = `
            <form id="consultant-form">
                <div class="form-group">
                    <label for="consultant-name">Consultant Name</label>
                    <input type="text" id="consultant-name" required>
                </div>
                <div class="form-group">
                    <label for="consultant-model">LLM Model</label>
                    <div class="model-search-container">
                        <input type="text" id="model-search" placeholder="Search models..." class="model-search-input">
                        <div id="model-list-container" class="model-list-container">
                            <div id="model-list" class="model-list">
                                <!-- Models will be populated here -->
                            </div>
                        </div>
                        <input type="hidden" id="consultant-model" name="consultant-model" required>
                    </div>
                    <div id="model-info" class="model-info"></div>
                </div>
                <div class="form-group">
                    <label for="consultant-prompt">System Prompt</label>
                    <textarea id="consultant-prompt" rows="4" required placeholder="Describe this consultant's role and expertise..."></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="back-to-templates">← Back</button>
                    <button type="button" class="btn btn-secondary" id="cancel-consultant">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Consultant</button>
                </div>
            </form>
        `;
        
        // Rebind events for the new form
        this.bindCustomFormEvents();
        this.populateModelList();
        
        // Focus on the name input
        setTimeout(() => {
            document.getElementById('consultant-name').focus();
        }, 100);
    }

    showAirtableConsultantForm() {
        const modal = document.getElementById('consultant-modal');
        const modalHeader = modal.querySelector('.modal-header h2');
        const modalBody = modal.querySelector('.modal-body');
        
        modalHeader.textContent = 'Add Airtable Data Assistant';
        
        modalBody.innerHTML = `
            <form id="airtable-consultant-form">
                <div class="template-preview">
                    <div class="template-icon">📊</div>
                    <h3>Airtable Data Assistant</h3>
                    <p>This specialized consultant can query and analyze data from your Airtable databases. It interprets natural language questions and retrieves relevant information from your connected Airtable base.</p>
                </div>
                
                <div class="form-group">
                    <label for="airtable-consultant-name">Assistant Name</label>
                    <input type="text" id="airtable-consultant-name" value="Airtable Data Assistant" required>
                </div>

                <div class="form-group">
                    <label for="airtable-base-id">Airtable Base ID</label>
                    <input type="text" id="airtable-base-id" placeholder="appXXXXXXXXXXXXXX" required>
                    <small>Find this in your Airtable base URL or API documentation</small>
                </div>

                <div class="form-group">
                    <label for="airtable-api-key">Airtable API Key</label>
                    <input type="password" id="airtable-api-key" placeholder="keyXXXXXXXXXXXXXX" required>
                    <small>Create a personal access token in your Airtable account</small>
                </div>

                <div class="form-group">
                    <button type="button" id="test-airtable-connection" class="btn btn-secondary" disabled>Test Connection & Load Tables</button>
                    <div id="airtable-connection-status" class="status-message"></div>
                </div>

                <div class="form-group" id="table-selection-group" style="display: none;">
                    <label for="airtable-table-select">Select Table</label>
                    <select id="airtable-table-select" required>
                        <option value="">Choose a table...</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="airtable-consultant-model">LLM Model</label>
                    <div class="model-search-container">
                        <input type="text" id="airtable-model-search" placeholder="Search models..." class="model-search-input">
                        <select id="airtable-consultant-model" required>
                            <option value="">Loading models...</option>
                        </select>
                    </div>
                    <div id="airtable-model-info" class="model-info"></div>
                </div>
                
                <div class="capabilities-info">
                    <h4>Capabilities:</h4>
                    <ul>
                        <li>Query records with natural language (e.g., "How many doctors are in the database?")</li>
                        <li>Filter and search data based on field values</li>
                        <li>Provide data summaries and insights</li>
                        <li>Return up to 20 records per query for detailed analysis</li>
                    </ul>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="back-to-templates-airtable">← Back</button>
                    <button type="button" class="btn btn-secondary" id="cancel-airtable-consultant">Cancel</button>
                    <button type="submit" class="btn btn-primary" disabled id="create-airtable-assistant">Create Assistant</button>
                </div>
            </form>
        `;
        
        // Bind events for Airtable form
        this.bindAirtableFormEvents();
        this.populateAirtableModelSelect();
        
        // Pre-select Claude 3.5 Sonnet if available
        setTimeout(() => {
            const modelSelect = document.getElementById('airtable-consultant-model');
            const claudeOption = Array.from(modelSelect.options).find(option => 
                option.value.includes('claude-3.5-sonnet')
            );
            if (claudeOption) {
                modelSelect.value = claudeOption.value;
                this.updateAirtableModelInfo();
            }
        }, 500);
    }

    bindCustomFormEvents() {
        const form = document.getElementById('consultant-form');
        const cancelBtn = document.getElementById('cancel-consultant');
        const backBtn = document.getElementById('back-to-templates');
        const modelSelect = document.getElementById('consultant-model');
        const modelSearch = document.getElementById('model-search');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createCustomConsultant();
        });

        cancelBtn.addEventListener('click', () => this.hideCreateModal());
        backBtn.addEventListener('click', () => this.showTemplateSelection());

        modelSelect.addEventListener('change', () => this.updateModelInfo());
        modelSearch.addEventListener('input', (e) => this.debouncedFilterModels(e.target.value));

        // Show/hide model list on focus/blur
        modelSearch.addEventListener('focus', () => {
            const container = document.getElementById('model-list-container');
            if (container) {
                container.classList.add('active');
            }
        });

        modelSearch.addEventListener('blur', () => {
            // Delay hiding to allow for clicks on model items
            setTimeout(() => {
                const container = document.getElementById('model-list-container');
                if (container) {
                    container.classList.remove('active');
                }
            }, 150);
        });
    }

    bindAirtableFormEvents() {
        const form = document.getElementById('airtable-consultant-form');
        const cancelBtn = document.getElementById('cancel-airtable-consultant');
        const backBtn = document.getElementById('back-to-templates-airtable');
        const modelSelect = document.getElementById('airtable-consultant-model');
        const modelSearch = document.getElementById('airtable-model-search');
        const testBtn = document.getElementById('test-airtable-connection');
        const baseIdInput = document.getElementById('airtable-base-id');
        const apiKeyInput = document.getElementById('airtable-api-key');
        const tableSelect = document.getElementById('airtable-table-select');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createAirtableConsultant();
        });

        cancelBtn.addEventListener('click', () => this.hideCreateModal());
        backBtn.addEventListener('click', () => this.showTemplateSelection());

        modelSelect.addEventListener('change', () => this.updateAirtableModelInfo());
        modelSearch.addEventListener('input', (e) => this.debouncedFilterAirtableModels(e.target.value));

        // Test connection button
        testBtn.addEventListener('click', () => this.testAirtableConnection());

        // Enable test button when both fields are filled
        const validateInputs = () => {
            const baseId = baseIdInput.value.trim();
            const apiKey = apiKeyInput.value.trim();
            const isValid = baseId.startsWith('app') && baseId.length >= 17 && 
                           (apiKey.startsWith('key') || apiKey.startsWith('pat')) && apiKey.length >= 17;
            testBtn.disabled = !isValid;
            console.log('Validation:', { baseId, apiKey, isValid }); // Debug log
        };

        baseIdInput.addEventListener('input', validateInputs);
        apiKeyInput.addEventListener('input', validateInputs);
        
        // Initial validation
        validateInputs();

        // Table selection
        tableSelect.addEventListener('change', () => {
            const createBtn = document.getElementById('create-airtable-assistant');
            const modelSelect = document.getElementById('airtable-consultant-model');
            createBtn.disabled = !(tableSelect.value && modelSelect.value);
        });
    }

    populateAirtableModelSelect(filteredModels = null) {
        const select = document.getElementById('airtable-consultant-model');
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

    filterAirtableModels(searchTerm) {
        const select = document.getElementById('airtable-consultant-model');
        const searchInput = document.getElementById('airtable-model-search');

        if (!searchTerm.trim()) {
            this.populateAirtableModelSelect();
            searchInput.classList.remove('has-results');
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

        this.populateAirtableModelSelect(filtered);

        // Add visual feedback for search results
        if (filtered.length > 0) {
            searchInput.classList.add('has-results');
        } else {
            searchInput.classList.remove('has-results');
        }

        // Force dropdown to show filtered results
        if (filtered.length > 0) {
            select.size = Math.min(filtered.length + 1, 10);
            setTimeout(() => {
                select.size = 1;
            }, 100);
        }
    }

    updateAirtableModelInfo() {
        const select = document.getElementById('airtable-consultant-model');
        const infoDiv = document.getElementById('airtable-model-info');
        
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

    async createCustomConsultant() {
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
                system_prompt: systemPrompt,
                consultant_type: 'standard'
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

    async testAirtableConnection() {
        const baseId = document.getElementById('airtable-base-id').value.trim();
        const apiKey = document.getElementById('airtable-api-key').value.trim();
        const statusDiv = document.getElementById('airtable-connection-status');
        const testBtn = document.getElementById('test-airtable-connection');
        const tableGroup = document.getElementById('table-selection-group');
        const tableSelect = document.getElementById('airtable-table-select');

        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        statusDiv.innerHTML = '<div class="status-loading">Testing connection...</div>';

        try {
            const result = await api.testAirtableConnection({ base_id: baseId, api_key: apiKey });
            
            if (result.success) {
                statusDiv.innerHTML = '<div class="status-success">✅ Connection successful!</div>';
                
                // Load tables
                const tablesResult = await api.getAirtableTables({ base_id: baseId, api_key: apiKey });
                
                if (tablesResult.success && tablesResult.tables) {
                    tableSelect.innerHTML = '<option value="">Choose a table...</option>';
                    
                    tablesResult.tables.forEach(table => {
                        const option = document.createElement('option');
                        option.value = table.name;
                        option.textContent = `${table.name} (${table.fieldCount} fields)`;
                        tableSelect.appendChild(option);
                    });
                    
                    tableGroup.style.display = 'block';
                    statusDiv.innerHTML += '<div class="status-success">📊 Tables loaded successfully!</div>';
                } else {
                    statusDiv.innerHTML += '<div class="status-error">❌ Failed to load tables</div>';
                }
            } else {
                statusDiv.innerHTML = `<div class="status-error">❌ Connection failed: ${result.error}</div>`;
            }
        } catch (error) {
            statusDiv.innerHTML = `<div class="status-error">❌ Connection failed: ${error.message}</div>`;
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = 'Test Connection & Load Tables';
        }
    }

    async createAirtableConsultant() {
        const symposium = symposiumManager.getCurrentSymposium();
        if (!symposium) {
            utils.showError('Please create a symposium first');
            return;
        }

        const name = document.getElementById('airtable-consultant-name').value.trim();
        const model = document.getElementById('airtable-consultant-model').value;
        const baseId = document.getElementById('airtable-base-id').value.trim();
        const apiKey = document.getElementById('airtable-api-key').value.trim();
        const tableName = document.getElementById('airtable-table-select').value;

        if (!name || !model || !baseId || !apiKey || !tableName) {
            utils.showError('Please fill in all fields and test the connection');
            return;
        }

        const systemPrompt = `You are an Airtable Data Assistant specialized in querying and analyzing data from Airtable databases. You help users retrieve information from their Airtable bases by interpreting natural language queries and converting them into appropriate database operations. You can answer questions about record counts, find specific entries, analyze data patterns, and provide insights based on the data. You're knowledgeable about Airtable's structure and can work with various field types including text, numbers, dates, attachments, and relationships. When users ask about their data, you query the connected Airtable base and provide clear, formatted responses with the relevant information. You always limit results to a maximum of 20 records to keep responses manageable.`;

        try {
            utils.showLoading();
            
            // Create the consultant
            const consultant = await api.createConsultant({
                symposium_id: symposium.id,
                name,
                model,
                system_prompt: systemPrompt,
                consultant_type: 'airtable'
            });

            // Save the Airtable configuration
            await api.saveAirtableConfig({
                consultant_id: consultant.id,
                base_id: baseId,
                api_key: apiKey,
                table_name: tableName
            });

            this.consultants.push(consultant);
            this.updateUI();
            this.hideCreateModal();
            utils.showSuccess(`Airtable Data Assistant "${name}" created successfully and connected to table "${tableName}"!`);
            
            // Auto-select the new consultant
            this.setActiveConsultant(consultant);
            
        } catch (error) {
            console.error('Error creating Airtable consultant:', error);
            utils.showError('Failed to create Airtable consultant');
        } finally {
            utils.hideLoading();
        }
    }

    hideCreateModal() {
        const modal = document.getElementById('consultant-modal');
        modal.classList.remove('active');
        
        // Reset forms if they exist
        const consultantForm = document.getElementById('consultant-form');
        const airtableForm = document.getElementById('airtable-consultant-form');
        const modelInfo = document.getElementById('model-info');
        const airtableModelInfo = document.getElementById('airtable-model-info');
        const modelSearch = document.getElementById('model-search');
        const airtableModelSearch = document.getElementById('airtable-model-search');
        
        if (consultantForm) {
            consultantForm.reset();
        }
        if (airtableForm) {
            airtableForm.reset();
        }
        if (modelInfo) {
            modelInfo.innerHTML = '';
        }
        if (airtableModelInfo) {
            airtableModelInfo.innerHTML = '';
        }
        if (modelSearch) {
            modelSearch.value = '';
        }
        if (airtableModelSearch) {
            airtableModelSearch.value = '';
        }
        
        // Reset model list to show all models if the list exists
        const modelList = document.getElementById('model-list');
        if (modelList && this.availableModels) {
            this.populateModelList();
        }
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
        this.renderConsultantTabs();
    }

    renderConsultantTabs() {
        const tabsContainer = document.getElementById('consultant-tabs');
        
        if (this.consultants.length === 0) {
            tabsContainer.innerHTML = `
                <div class="consultant-tabs-empty">
                    <button class="add-first-consultant-btn" onclick="consultantManager.showCreateModal()">
                        + Add Your First Consultant
                    </button>
                </div>
            `;
            return;
        }

        tabsContainer.innerHTML = this.consultants.map((consultant, index) => {
            const isActive = this.activeConsultant?.id === consultant.id;
            const modelShort = consultant.model.split('/').pop().split('-').slice(0, 2).join('-');
            const consultantIcon = consultant.name.charAt(0).toUpperCase();
            const colorClass = `consultant-${(index % 10) + 1}`;

            return `
                <div class="consultant-tab ${isActive ? 'active expanded' : 'collapsed'}"
                     data-consultant-id="${consultant.id}"
                     data-consultant-name="${consultant.name}"
                     data-consultant-model="${consultant.model}"
                     title="${consultant.name} - ${consultant.model}">
                    <div class="consultant-tab-icon ${colorClass}">${consultantIcon}</div>
                    <div class="consultant-tab-name">${consultant.name}</div>
                    <div class="consultant-tab-model">${modelShort}</div>
                </div>
            `;
        }).join('');

        // Bind click events for tab selection
        tabsContainer.querySelectorAll('.consultant-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const consultantId = parseInt(tab.dataset.consultantId);
                const consultant = this.consultants.find(c => c.id === consultantId);
                if (consultant) {
                    this.setActiveConsultant(consultant);
                }
            });

            // Add expand/collapse functionality
            this.addTabExpandCollapseLogic(tab);
        });
    }

    getActiveConsultant() {
        return this.activeConsultant;
    }

    showDeleteConfirmation(consultant) {
        const confirmed = confirm(
            `Are you sure you want to delete "${consultant.name}"?\n\n` +
            `This will permanently delete the consultant and all their messages. This action cannot be undone.`
        );
        
        if (confirmed) {
            this.deleteConsultant(consultant);
        }
    }

    async deleteConsultant(consultant) {
        try {
            utils.showLoading();

            // Call the API to delete the consultant
            await api.deleteConsultant(consultant.id);

            // Remove from local array
            this.consultants = this.consultants.filter(c => c.id !== consultant.id);

            // Handle active consultant selection
            if (this.activeConsultant && this.activeConsultant.id === consultant.id) {
                // If we deleted the active consultant, select another one or clear selection
                if (this.consultants.length > 0) {
                    this.setActiveConsultant(this.consultants[0]);
                } else {
                    this.activeConsultant = null;
                    // Notify other components that no consultant is selected
                    window.dispatchEvent(new CustomEvent('consultantChanged', {
                        detail: null
                    }));
                }
            }

            // Update the UI
            this.updateUI();

            // Refresh management modal if it's currently open
            const modal = document.getElementById('consultant-modal');
            if (modal && modal.classList.contains('active')) {
                const managementList = modal.querySelector('.consultants-management-list');
                if (managementList) {
                    // Refresh the management modal content
                    this.showManagementModal();
                }
            }

            utils.showSuccess(`Consultant "${consultant.name}" deleted successfully`);

        } catch (error) {
            console.error('Error deleting consultant:', error);
            utils.showError(`Failed to delete consultant: ${error.message}`);
        } finally {
            utils.hideLoading();
        }
    }

    getConsultants() {
        return this.consultants;
    }

    addTabExpandCollapseLogic(tab) {
        const consultantId = parseInt(tab.dataset.consultantId);
        const isActive = this.activeConsultant?.id === consultantId;

        // Don't add expand/collapse logic to active tabs - they stay expanded
        if (isActive) {
            return;
        }

        let expandTimeout;

        // Expand on hover (with slight delay for better UX)
        tab.addEventListener('mouseenter', () => {
            clearTimeout(expandTimeout);
            expandTimeout = setTimeout(() => {
                this.expandTab(tab);
            }, 150); // Small delay to prevent flickering
        });

        // Collapse on mouse leave (with delay to allow for smooth interaction)
        tab.addEventListener('mouseleave', () => {
            clearTimeout(expandTimeout);
            setTimeout(() => {
                this.collapseTab(tab);
            }, 300); // Longer delay to allow user to move to expanded content
        });

        // Also expand on click for accessibility and mobile
        tab.addEventListener('click', (e) => {
            // Only handle expand/collapse click if not clicking to select consultant
            if (e.detail === 1) { // Single click
                clearTimeout(expandTimeout);
                if (tab.classList.contains('collapsed')) {
                    this.expandTab(tab);
                } else {
                    this.collapseTab(tab);
                }
            }
        });

        // Handle touch events for mobile
        tab.addEventListener('touchstart', () => {
            clearTimeout(expandTimeout);
            if (tab.classList.contains('collapsed')) {
                this.expandTab(tab);
            }
        });

        // Collapse on touch end if it was a quick tap
        tab.addEventListener('touchend', () => {
            setTimeout(() => {
                this.collapseTab(tab);
            }, 1000); // Keep expanded for 1 second on mobile
        });
    }

    expandTab(tab) {
        // Collapse all other tabs first
        document.querySelectorAll('.consultant-tab.collapsed').forEach(otherTab => {
            this.collapseTab(otherTab);
        });

        // Expand this tab
        tab.classList.remove('collapsed');
        tab.classList.add('expanded');
    }

    collapseTab(tab) {
        // Don't collapse active tabs
        const consultantId = parseInt(tab.dataset.consultantId);
        const isActive = this.activeConsultant?.id === consultantId;

        if (!isActive) {
            tab.classList.remove('expanded');
            tab.classList.add('collapsed');
        }
    }
}

// Initialize consultant manager
window.consultantManager = new ConsultantManager();
