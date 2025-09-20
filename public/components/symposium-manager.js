// Symposium Manager Component
class SymposiumManager {
    constructor() {
        this.currentSymposium = null;
        this.generatedStructure = null;
        this.selectedModel = null;
        this.feedbackIteration = 0;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSymposiums();
        this.loadModels();
    }

    bindEvents() {
        // Create symposium button
        document.getElementById('create-symposium-btn').addEventListener('click', () => {
            this.showCreateModal();
        });

        // Symposium selector
        document.getElementById('symposium-select').addEventListener('change', (e) => {
            this.onSymposiumSelect(e.target.value);
        });

        // Generate tasks button
        document.getElementById('generate-tasks-btn').addEventListener('click', () => {
            this.generateStructure();
        });

        // Regenerate with feedback button
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'regenerate-structure-btn') {
                this.regenerateWithFeedback();
            }
        });

        // Model search functionality
        document.addEventListener('input', (e) => {
            if (e.target && e.target.id === 'structure-model-search') {
                this.filterModels(e.target.value);
            }
        });

        // Show/hide model list on focus/blur
        document.addEventListener('focus', (e) => {
            if (e.target && e.target.id === 'structure-model-search') {
                const container = document.getElementById('structure-model-list-container');
                if (container) {
                    container.classList.add('active');
                }
            }
        }, true);

        document.addEventListener('blur', (e) => {
            if (e.target && e.target.id === 'structure-model-search') {
                // Delay hiding to allow for clicks on model items
                setTimeout(() => {
                    const container = document.getElementById('structure-model-list-container');
                    if (container) {
                        container.classList.remove('active');
                    }
                }, 150);
            }
        }, true);

        // Manage symposiums modal events
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'manage-symposiums-btn') {
                this.showManageModal();
            }
            if (e.target && e.target.id === 'add-symposium-btn') {
                this.hideManageModal();
                this.showCreateModal();
            }
            if (e.target && e.target.id === 'close-manage-symposiums') {
                this.hideManageModal();
            }
        });

        // Manage modal close events
        const manageModal = document.getElementById('manage-symposiums-modal');
        if (manageModal) {
            const closeBtn = manageModal.querySelector('.close-btn');
            closeBtn.addEventListener('click', () => this.hideManageModal());
            
            manageModal.addEventListener('click', (e) => {
                if (e.target === manageModal) {
                    this.hideManageModal();
                }
            });
        }

        // Modal events
        const modal = document.getElementById('symposium-modal');
        const closeBtn = modal.querySelector('.close-btn');
        const cancelBtn = document.getElementById('cancel-symposium');
        const form = document.getElementById('symposium-form');

        closeBtn.addEventListener('click', () => this.hideCreateModal());
        cancelBtn.addEventListener('click', () => this.hideCreateModal());
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideCreateModal();
            }
        });

        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createSymposium();
        });
    }

    async loadSymposiums() {
        try {
            const symposiums = await api.getSymposiums();
            this.populateSymposiumSelector(symposiums);
            
            if (symposiums.length > 0) {
                // Load the most recent symposium
                this.setCurrentSymposium(symposiums[0]);
            }
        } catch (error) {
            console.error('Error loading symposiums:', error);
            utils.showError('Failed to load symposiums');
        }
    }

    populateSymposiumSelector(symposiums) {
        const selector = document.getElementById('symposium-select');
        const selectorContainer = document.getElementById('symposium-selector');
        
        if (symposiums.length > 1) {
            // Show selector if there are multiple symposiums
            selectorContainer.style.display = 'block';
            
            selector.innerHTML = '<option value="">Select a symposium...</option>';
            symposiums.forEach(symposium => {
                const option = document.createElement('option');
                option.value = symposium.id;
                option.textContent = symposium.name;
                selector.appendChild(option);
            });
            
            // Set current selection
            if (this.currentSymposium) {
                selector.value = this.currentSymposium.id;
            }
        } else {
            // Hide selector if there's only one or no symposiums
            selectorContainer.style.display = 'none';
        }
    }

    async onSymposiumSelect(symposiumId) {
        if (!symposiumId) return;
        
        try {
            const symposiums = await api.getSymposiums();
            const selectedSymposium = symposiums.find(s => s.id == symposiumId);
            
            if (selectedSymposium) {
                this.setCurrentSymposium(selectedSymposium);
            }
        } catch (error) {
            console.error('Error selecting symposium:', error);
            utils.showError('Failed to load symposium');
        }
    }

    showCreateModal() {
        const modal = document.getElementById('symposium-modal');
        modal.classList.add('active');
        
        // Reset generated structure
        this.generatedStructure = null;
        
        // Populate models if we have them
        if (this.models && this.models.length > 0) {
            this.populateModelList(this.models);
        } else {
            // Load models if we don't have them yet
            this.loadModels();
        }
        
        // Focus on the name input
        setTimeout(() => {
            document.getElementById('symposium-name').focus();
        }, 100);
    }

    hideCreateModal() {
        const modal = document.getElementById('symposium-modal');
        modal.classList.remove('active');
        
        // Reset form and generated structure
        document.getElementById('symposium-form').reset();
        this.generatedStructure = null;
        this.editingSymposium = null;
        
        // Reset modal title and button text
        const modalTitle = document.querySelector('#symposium-modal .modal-header h2');
        modalTitle.textContent = 'Create Symposium';
        
        const submitBtn = document.querySelector('#symposium-form button[type="submit"]');
        submitBtn.textContent = 'Create';
        
        // Hide preview section
        const previewContainer = document.getElementById('structure-preview');
        if (previewContainer) {
            previewContainer.style.display = 'none';
        }
    }

    async generateStructure() {
        const description = document.getElementById('symposium-description').value.trim();
        
        if (!description) {
            utils.showError('Please enter a symposium description first');
            return;
        }

        const generateBtn = document.getElementById('generate-tasks-btn');
        const originalText = generateBtn.textContent;
        
        try {
            generateBtn.disabled = true;
            generateBtn.textContent = '🔄 Generating...';
            
            const result = await api.generateSymposiumStructure(description);
            
            if (result.success && result.objectives) {
                this.generatedStructure = result.objectives;
                this.displayStructurePreview(result.objectives);
                utils.showSuccess(`Generated ${result.objectives.length} objectives with tasks!`);
            } else {
                utils.showError(result.error || 'Failed to generate structure');
            }
            
        } catch (error) {
            console.error('Error generating structure:', error);
            utils.showError('Failed to generate structure: ' + error.message);
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = originalText;
        }
    }

    displayStructurePreview(objectives) {
        const previewContainer = document.getElementById('structure-preview');
        const objectivesPreview = document.getElementById('objectives-preview');
        
        if (!objectives || objectives.length === 0) {
            previewContainer.style.display = 'none';
            return;
        }

        // Calculate total tasks
        const totalTasks = objectives.reduce((sum, obj) => sum + (obj.tasks ? obj.tasks.length : 0), 0);
        
        // Create summary
        const summaryHtml = `
            <div class="preview-summary">
                <div class="preview-summary-text">
                    📋 ${objectives.length} objectives with ${totalTasks} total tasks
                </div>
            </div>
        `;

        // Create objectives HTML
        const objectivesHtml = objectives.map((objective, index) => {
            const tasksHtml = objective.tasks ? objective.tasks.map(task => `
                <div class="preview-task">
                    <div class="preview-task-title">${task.title}</div>
                    <div class="preview-task-description">${task.description}</div>
                </div>
            `).join('') : '';

            return `
                <div class="preview-objective" data-objective-index="${index}">
                    <div class="preview-objective-header" onclick="symposiumManager.toggleObjectivePreview(${index})">
                        <div>
                            <div class="preview-objective-title">${objective.title}</div>
                            <div class="preview-objective-description">${objective.description}</div>
                        </div>
                        <div class="preview-expand-icon">▼</div>
                    </div>
                    <div class="preview-objective-tasks">
                        ${tasksHtml}
                    </div>
                </div>
            `;
        }).join('');

        objectivesPreview.innerHTML = summaryHtml + objectivesHtml;
        previewContainer.style.display = 'block';
    }

    toggleObjectivePreview(index) {
        const objective = document.querySelector(`[data-objective-index="${index}"]`);
        if (objective) {
            objective.classList.toggle('expanded');
        }
    }

    async createSymposium() {
        const name = document.getElementById('symposium-name').value.trim();
        const description = document.getElementById('symposium-description').value.trim();

        if (!name || !description) {
            utils.showError('Please fill in all fields');
            return;
        }

        try {
            utils.showLoading();
            
            let symposium;
            if (this.editingSymposium) {
                // Update existing symposium
                const result = await api.updateSymposium(this.editingSymposium.id, {
                    name,
                    description
                });
                symposium = result.symposium;
                utils.showSuccess('Symposium updated successfully!');
            } else {
                // Create new symposium
                symposium = await api.createSymposium({
                    name,
                    description
                });
                
                // Create objectives and tasks if structure was generated
                if (this.generatedStructure && window.objectiveManager) {
                    await window.objectiveManager.createObjectivesFromStructure(symposium.id, this.generatedStructure);
                }
                
                utils.showSuccess('Symposium created successfully!');
            }

            this.setCurrentSymposium(symposium);
            this.hideCreateModal();
            
            // Refresh the symposium list
            await this.loadSymposiums();
            
        } catch (error) {
            console.error('Error saving symposium:', error);
            utils.showError('Failed to save symposium');
        } finally {
            utils.hideLoading();
        }
    }

    setCurrentSymposium(symposium) {
        this.currentSymposium = symposium;
        this.updateUI();
        
        // Enable/disable clear chat button
        const clearChatBtn = document.getElementById('clear-chat-btn');
        if (clearChatBtn) {
            clearChatBtn.disabled = !symposium;
        }
        
        // Notify other components
        window.dispatchEvent(new CustomEvent('symposiumChanged', {
            detail: symposium
        }));
    }

    updateUI() {
        const infoContainer = document.getElementById('symposium-info');
        
        if (this.currentSymposium) {
            infoContainer.innerHTML = `
                <div class="symposium-details">
                    <h4>${this.currentSymposium.name}</h4>
                    <p>${this.currentSymposium.description}</p>
                    <div style="margin-top: 1rem;">
                        <button id="manage-symposiums-btn" class="btn btn-secondary btn-small">
                            Manage Symposiums
                        </button>
                    </div>
                </div>
            `;

            // Event binding is handled by the global event listener
        } else {
            infoContainer.innerHTML = `
                <button id="create-symposium-btn" class="btn btn-primary">Create Symposium</button>
            `;
            
            // Re-bind create button
            document.getElementById('create-symposium-btn').addEventListener('click', () => {
                this.showCreateModal();
            });
        }
    }

    async loadModels() {
        try {
            const response = await api.getModels();
            // Handle different response formats
            const models = Array.isArray(response) ? response : (response.data || response.models || []);
            
            if (!Array.isArray(models)) {
                console.warn('Models response is not an array:', response);
                this.models = [];
                this.selectedModel = 'openai/gpt-4o';
                return;
            }
            
            this.models = models; // Store models for later use
            this.populateModelList(models);
        } catch (error) {
            console.error('Error loading models:', error);
            // Set fallback model
            this.selectedModel = 'openai/gpt-4o';
            this.models = [];
        }
    }

    populateModelList(filteredModels = null) {
        const modelList = document.getElementById('structure-model-list');
        if (!modelList) {
            // If modal isn't open yet, we'll populate it when it opens
            return;
        }

        const modelsToShow = filteredModels || this.models;

        modelList.innerHTML = '';

        if (!Array.isArray(modelsToShow) || modelsToShow.length === 0) {
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

        // Auto-select default model if none selected
        if (!this.selectedModel && modelsToShow.length > 0) {
            const defaultModel = modelsToShow.find(m => m.id === 'openai/gpt-4o') || modelsToShow[0];
            this.selectModel(defaultModel.id, defaultModel);
        }
    }

    selectModel(modelId, modelData) {
        // Update hidden input
        const hiddenInput = document.getElementById('structure-model');
        hiddenInput.value = modelId;
        this.selectedModel = modelId;

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

        // Update search input to show selected model
        const searchInput = document.getElementById('structure-model-search');
        if (searchInput) {
            searchInput.value = modelData.name;
        }

        // Hide the model list
        const container = document.getElementById('structure-model-list-container');
        if (container) {
            container.classList.remove('active');
        }
    }

    filterModels(searchTerm) {
        const modelList = document.getElementById('structure-model-list');
        const searchInput = document.getElementById('structure-model-search');

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
            const model = this.models.find(m => m.id === modelId);

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
        const infoDiv = document.getElementById('structure-model-info');
        if (!infoDiv) return;

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

    async regenerateWithFeedback() {
        const description = document.getElementById('symposium-description').value.trim();
        const feedback = document.getElementById('structure-feedback').value.trim();
        
        if (!description) {
            utils.showError('Please enter a symposium description first');
            return;
        }

        if (!feedback) {
            utils.showError('Please provide feedback for regeneration');
            return;
        }

        if (!this.generatedStructure) {
            utils.showError('Please generate a structure first');
            return;
        }

        if (!this.selectedModel) {
            utils.showError('Please select a model first');
            return;
        }

        const regenerateBtn = document.getElementById('regenerate-structure-btn');
        const originalText = regenerateBtn.textContent;
        
        try {
            regenerateBtn.disabled = true;
            regenerateBtn.textContent = '🔄 Regenerating...';
            
            this.feedbackIteration++;
            
            const result = await api.regenerateSymposiumStructure(
                description, 
                this.generatedStructure, 
                feedback, 
                this.selectedModel, 
                this.feedbackIteration
            );
            
            if (result.success && result.objectives) {
                this.generatedStructure = result.objectives;
                this.displayStructurePreview(result.objectives);
                
                // Clear feedback input
                document.getElementById('structure-feedback').value = '';
                
                utils.showSuccess(`Regenerated structure (iteration ${this.feedbackIteration}) with ${result.objectives.length} objectives!`);
            } else {
                utils.showError(result.error || 'Failed to regenerate structure');
            }
            
        } catch (error) {
            console.error('Error regenerating structure:', error);
            utils.showError('Failed to regenerate structure: ' + error.message);
        } finally {
            regenerateBtn.disabled = false;
            regenerateBtn.textContent = originalText;
        }
    }

    async showManageModal() {
        const modal = document.getElementById('manage-symposiums-modal');
        const symposiumsList = document.getElementById('symposiums-list');
        
        try {
            const symposiums = await api.getSymposiums();
            
            if (symposiums.length === 0) {
                symposiumsList.innerHTML = '<p class="empty-state">No symposiums found</p>';
            } else {
                symposiumsList.innerHTML = symposiums.map(symposium => `
                    <div class="symposium-item" data-symposium-id="${symposium.id}">
                        <div class="symposium-info">
                            <div class="symposium-name">${symposium.name}</div>
                            <div class="symposium-description">${symposium.description}</div>
                            <div class="symposium-meta">
                                <small>Created: ${new Date(symposium.created_at).toLocaleDateString()}</small>
                            </div>
                        </div>
                        <div class="symposium-actions">
                            <button class="btn btn-secondary btn-small select-symposium-btn" 
                                    data-symposium-id="${symposium.id}">Select</button>
                            <button class="btn btn-secondary btn-small edit-symposium-btn" 
                                    data-symposium-id="${symposium.id}">Edit</button>
                            <button class="btn btn-danger btn-small delete-symposium-btn" 
                                    data-symposium-id="${symposium.id}">Delete</button>
                        </div>
                    </div>
                `).join('');
                
                // Bind symposium action events
                this.bindSymposiumActions();
            }
            
            modal.classList.add('active');
            
        } catch (error) {
            console.error('Error loading symposiums for management:', error);
            utils.showError('Failed to load symposiums');
        }
    }

    hideManageModal() {
        const modal = document.getElementById('manage-symposiums-modal');
        modal.classList.remove('active');
    }

    bindSymposiumActions() {
        // Select symposium buttons
        document.querySelectorAll('.select-symposium-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const symposiumId = parseInt(e.target.dataset.symposiumId);
                await this.selectSymposiumFromManage(symposiumId);
            });
        });

        // Edit symposium buttons
        document.querySelectorAll('.edit-symposium-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const symposiumId = parseInt(e.target.dataset.symposiumId);
                this.editSymposium(symposiumId);
            });
        });

        // Delete symposium buttons
        document.querySelectorAll('.delete-symposium-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const symposiumId = parseInt(e.target.dataset.symposiumId);
                this.deleteSymposium(symposiumId);
            });
        });
    }

    async selectSymposiumFromManage(symposiumId) {
        try {
            const symposiums = await api.getSymposiums();
            const selectedSymposium = symposiums.find(s => s.id === symposiumId);
            
            if (selectedSymposium) {
                this.setCurrentSymposium(selectedSymposium);
                this.hideManageModal();
                utils.showSuccess(`Switched to symposium: ${selectedSymposium.name}`);
            }
        } catch (error) {
            console.error('Error selecting symposium:', error);
            utils.showError('Failed to select symposium');
        }
    }

    async editSymposium(symposiumId) {
        try {
            const symposiums = await api.getSymposiums();
            const symposium = symposiums.find(s => s.id === symposiumId);
            
            if (!symposium) {
                utils.showError('Symposium not found');
                return;
            }

            // Populate the create modal with existing data
            document.getElementById('symposium-name').value = symposium.name;
            document.getElementById('symposium-description').value = symposium.description;
            
            // Set editing mode
            this.editingSymposium = symposium;
            
            // Update modal title
            const modalTitle = document.querySelector('#symposium-modal .modal-header h2');
            modalTitle.textContent = 'Edit Symposium';
            
            // Update submit button text
            const submitBtn = document.querySelector('#symposium-form button[type="submit"]');
            submitBtn.textContent = 'Update';
            
            this.hideManageModal();
            this.showCreateModal();
            
        } catch (error) {
            console.error('Error loading symposium for editing:', error);
            utils.showError('Failed to load symposium');
        }
    }

    async deleteSymposium(symposiumId) {
        try {
            const symposiums = await api.getSymposiums();
            const symposium = symposiums.find(s => s.id === symposiumId);
            
            if (!symposium) {
                utils.showError('Symposium not found');
                return;
            }

            if (!confirm(`Are you sure you want to delete "${symposium.name}"? This will permanently delete all objectives, tasks, consultants, and messages associated with this symposium. This action cannot be undone.`)) {
                return;
            }

            utils.showLoading();
            await api.deleteSymposium(symposiumId);
            
            // If we deleted the current symposium, clear it
            if (this.currentSymposium && this.currentSymposium.id === symposiumId) {
                this.currentSymposium = null;
                this.updateUI();
                
                // Notify other components
                window.dispatchEvent(new CustomEvent('symposiumChanged', {
                    detail: null
                }));
            }
            
            // Refresh the management modal
            await this.showManageModal();
            
            // Refresh the symposium list
            await this.loadSymposiums();
            
            utils.showSuccess('Symposium deleted successfully!');
            
        } catch (error) {
            console.error('Error deleting symposium:', error);
            utils.showError('Failed to delete symposium');
        } finally {
            utils.hideLoading();
        }
    }

    getCurrentSymposium() {
        return this.currentSymposium;
    }
}

// Initialize symposium manager
window.symposiumManager = new SymposiumManager();
