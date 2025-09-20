// Symposium Manager Component
class SymposiumManager {
    constructor() {
        this.currentSymposium = null;
        this.generatedStructure = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSymposiums();
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
            
            const symposium = await api.createSymposium({
                name,
                description
            });

            this.setCurrentSymposium(symposium);
            
            // Create objectives and tasks if structure was generated
            if (this.generatedStructure && window.objectiveManager) {
                await window.objectiveManager.createObjectivesFromStructure(symposium.id, this.generatedStructure);
            }
            
            this.hideCreateModal();
            
            // Refresh the symposium list
            await this.loadSymposiums();
            
            utils.showSuccess('Symposium created successfully!');
            
        } catch (error) {
            console.error('Error creating symposium:', error);
            utils.showError('Failed to create symposium');
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
                        <button id="change-symposium-btn" class="btn btn-secondary btn-small">
                            Change Symposium
                        </button>
                    </div>
                </div>
            `;

            // Bind change symposium button
            document.getElementById('change-symposium-btn').addEventListener('click', () => {
                this.showCreateModal();
            });
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

    getCurrentSymposium() {
        return this.currentSymposium;
    }
}

// Initialize symposium manager
window.symposiumManager = new SymposiumManager();
