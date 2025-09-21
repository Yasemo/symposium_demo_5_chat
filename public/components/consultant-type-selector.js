// Consultant Type Selector Component
class ConsultantTypeSelector {
    constructor() {
        this.templates = [];
        this.selectedTemplate = null;
        this.init();
    }

    async init() {
        await this.loadTemplates();
        this.bindEvents();
    }

    async loadTemplates() {
        try {
            this.templates = await api.getConsultantTemplates();
        } catch (error) {
            console.error('Error loading consultant templates:', error);
            this.templates = [];
        }
    }

    bindEvents() {
        // Listen for consultant creation modal
        document.addEventListener('consultantModalOpened', () => {
            this.renderTemplateSelector();
        });
    }

    renderTemplateSelector() {
        const consultantForm = document.getElementById('consultant-form');
        if (!consultantForm) return;

        // Find the system prompt field and add template selector before it
        const systemPromptGroup = consultantForm.querySelector('label[for="consultant-prompt"]').parentElement;
        
        // Check if template selector already exists
        if (document.getElementById('template-selector-group')) return;

        const templateSelectorHTML = `
            <div class="form-group" id="template-selector-group">
                <label for="consultant-template">Consultant Type</label>
                <div class="template-grid">
                    ${this.templates.map(template => `
                        <div class="template-card ${template.api_type === 'pure_llm' ? 'selected' : ''}" 
                             data-template-id="${template.id}" 
                             data-api-type="${template.api_type}">
                            <div class="template-icon">${template.icon}</div>
                            <div class="template-info">
                                <h4>${template.display_name}</h4>
                                <p>${template.description}</p>
                                ${template.api_type !== 'pure_llm' ? '<span class="api-badge">API Integration</span>' : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <input type="hidden" id="selected-template-id" value="${this.getDefaultTemplate()?.id || ''}">
            </div>
        `;

        systemPromptGroup.insertAdjacentHTML('beforebegin', templateSelectorHTML);

        // Bind template selection events
        this.bindTemplateSelection();

        // Set default template
        this.selectTemplate(this.getDefaultTemplate());
    }

    getDefaultTemplate() {
        return this.templates.find(t => t.api_type === 'pure_llm') || this.templates[0];
    }

    bindTemplateSelection() {
        const templateCards = document.querySelectorAll('.template-card');
        templateCards.forEach(card => {
            card.addEventListener('click', () => {
                // Remove previous selection
                templateCards.forEach(c => c.classList.remove('selected'));
                
                // Select current card
                card.classList.add('selected');
                
                // Get template data
                const templateId = card.dataset.templateId;
                const template = this.templates.find(t => t.id == templateId);
                
                if (template) {
                    this.selectTemplate(template);
                }
            });
        });
    }

    selectTemplate(template) {
        if (!template) return;

        this.selectedTemplate = template;
        
        // Update hidden field
        const hiddenField = document.getElementById('selected-template-id');
        if (hiddenField) {
            hiddenField.value = template.id;
        }

        // Update form fields based on template
        this.updateFormForTemplate(template);
    }

    updateFormForTemplate(template) {
        // Update system prompt with template default
        const systemPromptField = document.getElementById('consultant-prompt');
        if (systemPromptField && systemPromptField.value.trim() === '') {
            systemPromptField.value = template.default_system_prompt;
        }

        // Update consultant name placeholder
        const nameField = document.getElementById('consultant-name');
        if (nameField && nameField.value.trim() === '') {
            nameField.placeholder = `e.g., ${template.display_name}`;
        }

        // Show/hide configuration requirements
        this.showConfigurationRequirements(template);
    }

    showConfigurationRequirements(template) {
        // Remove existing requirements display
        const existingReqs = document.getElementById('config-requirements');
        if (existingReqs) {
            existingReqs.remove();
        }

        if (template.api_type === 'pure_llm' || !template.required_config_fields) {
            return;
        }

        const requirements = JSON.parse(template.required_config_fields || '[]');
        if (requirements.length === 0) return;

        const requirementsHTML = `
            <div id="config-requirements" class="config-requirements">
                <h4>⚙️ Configuration Required</h4>
                <p>This consultant type requires additional configuration after creation:</p>
                <ul>
                    ${requirements.map(field => `
                        <li><strong>${this.formatFieldName(field)}</strong></li>
                    `).join('')}
                </ul>
                <p class="config-note">You'll be able to configure these settings after creating the consultant.</p>
            </div>
        `;

        const formActions = document.querySelector('#consultant-form .form-actions');
        if (formActions) {
            formActions.insertAdjacentHTML('beforebegin', requirementsHTML);
        }
    }

    formatFieldName(fieldName) {
        return fieldName.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    getSelectedTemplate() {
        return this.selectedTemplate;
    }

    // Method to be called when creating consultant
    getConsultantData(formData) {
        const template = this.getSelectedTemplate();
        
        return {
            ...formData,
            template_id: template?.id,
            consultant_type: template?.api_type || 'pure_llm'
        };
    }

    cleanup() {
        const templateSelector = document.getElementById('template-selector-group');
        if (templateSelector) {
            templateSelector.remove();
        }

        const configReqs = document.getElementById('config-requirements');
        if (configReqs) {
            configReqs.remove();
        }
    }
}

// Initialize the consultant type selector
window.consultantTypeSelector = new ConsultantTypeSelector();
