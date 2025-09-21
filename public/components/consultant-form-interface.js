// Dynamic Form Interface for API-based Consultants
class ConsultantFormInterface {
    constructor() {
        this.currentConsultant = null;
        this.formSchema = null;
        this.dynamicContext = null;
        this.formContainer = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.createFormContainer();
                this.bindEvents();
            });
        } else {
            this.createFormContainer();
            this.bindEvents();
        }
    }

    createFormContainer() {
        // Find the chat container and chat messages elements
        const chatContainer = document.querySelector('.chat-container');
        const chatMessages = document.getElementById('chat-messages');

        if (!chatContainer) {
            console.error('Chat container (.chat-container) not found. Cannot create consultant form.');
            return;
        }

        if (!chatMessages) {
            console.error('Chat messages element (#chat-messages) not found. Cannot create consultant form.');
            return;
        }

        console.log('ConsultantFormInterface: Found chat container and messages elements');

        // Ensure chat container has relative positioning for proper form positioning
        chatContainer.style.position = 'relative';

        this.formContainer = document.createElement('div');
        this.formContainer.id = 'consultant-form-overlay';
        this.formContainer.className = 'consultant-form-overlay hidden';
        this.formContainer.innerHTML = `
            <div class="form-header">
                <h3 id="form-title">Consultant Query Form</h3>
                <button id="close-form-btn" class="close-btn">×</button>
            </div>
            <div class="form-content">
                <div class="instruction-section">
                    <label for="llm-instruction">Describe what you want to query:</label>
                    <textarea id="llm-instruction" placeholder="e.g., Find all professionals with public speaking skills"></textarea>
                    <button id="fill-form-btn" class="primary-btn">Fill Form with AI</button>
                </div>
                <div class="form-separator">
                    <span>or configure manually</span>
                </div>
                <div id="dynamic-form-fields" class="form-fields">
                    <!-- Dynamic form fields will be inserted here -->
                </div>
                <div class="form-actions">
                    <button id="execute-query-btn" class="primary-btn">Execute Query</button>
                    <button id="cancel-form-btn" class="secondary-btn">Cancel</button>
                </div>
            </div>
            <div id="form-loading" class="form-loading hidden">
                <div class="loading-spinner"></div>
                <span>Processing...</span>
            </div>
        `;

        // Insert form overlay before the chat messages element within the chat container
        chatContainer.insertBefore(this.formContainer, chatMessages);
        console.log('ConsultantFormInterface: Form container inserted before chat messages');
    }

    bindEvents() {
        // Only bind events if form container was created successfully
        if (!this.formContainer) {
            console.warn('Form container not available. Skipping event binding.');
            return;
        }

        // Use form container scope for all form elements
        const closeBtn = this.formContainer.querySelector('#close-form-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideForm();
            });
        }

        const cancelBtn = this.formContainer.querySelector('#cancel-form-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideForm();
            });
        }

        const fillBtn = this.formContainer.querySelector('#fill-form-btn');
        if (fillBtn) {
            fillBtn.addEventListener('click', () => {
                this.fillFormWithAI();
            });
            // Initially disable the AI fill button until table is selected
            fillBtn.disabled = true;
            fillBtn.textContent = 'Select a table first';
        }

        const executeBtn = this.formContainer.querySelector('#execute-query-btn');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => {
                this.executeQuery();
            });
        }

        // Listen for consultant changes
        window.addEventListener('consultantChanged', (e) => {
            this.onConsultantChanged(e.detail);
        });

        // Auto-resize instruction textarea
        const instructionTextarea = this.formContainer.querySelector('#llm-instruction');
        if (instructionTextarea) {
            instructionTextarea.addEventListener('input', (e) => {
                this.autoResizeTextarea(e.target);
            });
        }
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    async onConsultantChanged(consultant) {
        console.log('ConsultantFormInterface: Consultant changed:', consultant);
        
        if (consultant) {
            console.log('ConsultantFormInterface: Consultant type:', consultant.consultant_type);
            console.log('ConsultantFormInterface: Is API consultant?', this.isApiConsultant(consultant));
            
            if (this.isApiConsultant(consultant)) {
                console.log('ConsultantFormInterface: Showing form for API consultant');
                await this.showFormForConsultant(consultant);
            } else {
                console.log('ConsultantFormInterface: Hiding form - not an API consultant');
                this.hideForm();
            }
        } else {
            console.log('ConsultantFormInterface: No consultant selected, hiding form');
            this.hideForm();
        }
    }

    isApiConsultant(consultant) {
        // Check if consultant requires form interface
        // Updated logic to handle different consultant types
        const isApi = consultant.consultant_type && 
                     consultant.consultant_type !== 'standard' && 
                     consultant.consultant_type !== 'pure_llm' &&
                     consultant.consultant_type !== null &&
                     consultant.consultant_type !== undefined;
        
        console.log('ConsultantFormInterface: isApiConsultant check:', {
            consultant_type: consultant.consultant_type,
            isApi: isApi
        });
        
        return isApi;
    }

    async showFormForConsultant(consultant) {
        console.log('ConsultantFormInterface: showFormForConsultant called for:', consultant.name);
        
        try {
            this.currentConsultant = consultant;
            
            console.log('ConsultantFormInterface: Showing loading...');
            this.showLoading();
            
            console.log('ConsultantFormInterface: Fetching form schema and context...');
            
            // Get form schema and dynamic context
            const [schema, context] = await Promise.all([
                this.getConsultantFormSchema(consultant.id),
                this.refreshConsultantContext(consultant.id)
            ]);
            
            console.log('ConsultantFormInterface: Received schema:', schema);
            console.log('ConsultantFormInterface: Received context:', context);
            
            this.formSchema = schema;
            this.dynamicContext = context;
            
            // Update form title with null check using form container scope
            const formTitle = this.formContainer.querySelector('#form-title');
            if (formTitle) {
                formTitle.textContent = `${consultant.name} Query Form`;
                console.log('ConsultantFormInterface: Updated form title');
            }
            
            // Populate table selector with available tables
            console.log('ConsultantFormInterface: Populating table selector...');
            this.populateTableSelector();

            // Generate form fields (excluding table_name since it's handled separately)
            console.log('ConsultantFormInterface: Generating form fields...');
            this.generateFormFields();

            // Show form
            console.log('ConsultantFormInterface: Showing form...');
            this.showForm();
            
            console.log('ConsultantFormInterface: Form should now be visible');
            
        } catch (error) {
            console.error('ConsultantFormInterface: Error showing consultant form:', error);
            console.error('ConsultantFormInterface: Error details:', error.message, error.stack);
            utils.showError('Failed to load consultant form: ' + error.message);
            this.hideForm();
        } finally {
            console.log('ConsultantFormInterface: Hiding loading...');
            this.hideLoading();
        }
    }

    async getConsultantFormSchema(consultantId) {
        try {
            const response = await api.request(`/consultant-form-schema/${consultantId}`);
            return response;
        } catch (error) {
            console.error('Error fetching consultant form schema:', error);
            throw error;
        }
    }

    async refreshConsultantContext(consultantId) {
        try {
            const response = await api.request(`/consultant-context/${consultantId}`);
            return response;
        } catch (error) {
            console.error('Error fetching consultant context:', error);
            throw error;
        }
    }

    populateTableSelector() {
        // The table selector gets populated through the dynamic form fields
        // This method ensures the tables are available in the context
        if (!this.dynamicContext || !this.dynamicContext.tables) {
            console.warn('No tables available in dynamic context');
            return;
        }

        console.log('Tables available:', this.dynamicContext.tables);
    }

    generateFormFields() {
        // Ensure form container exists first
        if (!this.formContainer) {
            console.error('Form container not available. Cannot generate form fields.');
            return;
        }

        // Always use form container scope instead of global document
        const fieldsContainer = this.formContainer.querySelector('#dynamic-form-fields');
        if (!fieldsContainer) {
            console.error('Dynamic form fields container not found within form container.');
            console.log('Form container HTML:', this.formContainer.innerHTML);
            return;
        }
        
        fieldsContainer.innerHTML = '';

        if (!this.formSchema || !this.formSchema.fields) {
            fieldsContainer.innerHTML = '<p>No form configuration available</p>';
            return;
        }

        this.formSchema.fields.forEach(field => {
            const fieldElement = this.createFormField(field);
            fieldsContainer.appendChild(fieldElement);
        });

        // Bind field change events for dependent fields
        this.bindFieldDependencies();
    }

    createFormField(field) {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'form-field';
        fieldDiv.dataset.fieldName = field.name;

        const label = document.createElement('label');
        label.textContent = field.label || field.name;
        label.setAttribute('for', `field-${field.name}`);
        if (field.required) {
            label.innerHTML += ' <span class="required">*</span>';
        }

        // Add status indicator for table_name field
        if (field.name === 'table_name') {
            const statusIndicator = document.createElement('span');
            statusIndicator.id = 'table-status-indicator';
            statusIndicator.className = 'table-status-indicator';
            statusIndicator.innerHTML = '<span class="status-dot"></span><span class="status-text">Select a table</span>';
            label.appendChild(statusIndicator);
        }

        let input;
        switch (field.type) {
            case 'select':
                input = this.createSelectField(field);
                break;
            case 'multi-select':
                input = this.createMultiSelectField(field);
                break;
            case 'text':
                input = this.createTextField(field);
                break;
            case 'number':
                input = this.createNumberField(field);
                break;
            case 'textarea':
                input = this.createTextareaField(field);
                break;
            default:
                input = this.createTextField(field);
        }

        input.id = `field-${field.name}`;
        input.name = field.name;

        fieldDiv.appendChild(label);
        fieldDiv.appendChild(input);

        return fieldDiv;
    }

    createSelectField(field) {
        const select = document.createElement('select');
        select.className = 'form-select';
        
        // Add empty option if not required
        if (!field.required) {
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = '-- Select --';
            select.appendChild(emptyOption);
        }

        // Add dynamic options
        const options = this.getDynamicOptions(field.dynamic_options);
        if (Array.isArray(options)) {
            options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value || option;
                optionElement.textContent = option.label || option;
                select.appendChild(optionElement);
            });
        }

        return select;
    }

    createMultiSelectField(field) {
        const container = document.createElement('div');
        container.className = 'multi-select-container';

        const select = document.createElement('select');
        select.className = 'form-select';
        select.multiple = true;

        const options = this.getDynamicOptions(field.dynamic_options);
        select.size = Math.min(6, options.length + 1);

        if (Array.isArray(options)) {
            options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value || option;
                optionElement.textContent = option.label || option;
                select.appendChild(optionElement);
            });
        }

        container.appendChild(select);
        return container;
    }

    createTextField(field) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-input';
        input.placeholder = field.placeholder || '';
        return input;
    }

    createNumberField(field) {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'form-input';
        input.placeholder = field.placeholder || '';
        if (field.min !== undefined) input.min = field.min;
        if (field.max !== undefined) input.max = field.max;
        if (field.default !== undefined) input.value = field.default;
        return input;
    }

    createTextareaField(field) {
        const textarea = document.createElement('textarea');
        textarea.className = 'form-textarea';
        textarea.placeholder = field.placeholder || '';
        textarea.rows = field.rows || 3;
        return textarea;
    }

    getDynamicOptions(optionType) {
        if (!optionType || !this.dynamicContext) {
            return [];
        }

        return this.dynamicContext[optionType] || [];
    }

    bindFieldDependencies() {
        if (!this.formSchema || !this.formSchema.fields || !this.formContainer) return;

        this.formSchema.fields.forEach(field => {
            if (field.depends_on) {
                const dependentField = this.formContainer.querySelector(`#field-${field.depends_on}`);
                if (dependentField) {
                    dependentField.addEventListener('change', () => {
                        this.updateDependentField(field);
                    });
                }
            }

            // Special handling for table_name field to enable AI fill button and fetch fresh schema
            if (field.name === 'table_name') {
                const tableField = this.formContainer.querySelector(`#field-${field.name}`);
                if (tableField) {
                    tableField.addEventListener('change', () => {
                        this.onTableSelectionChanged(tableField.value);
                    });
                }
            }
        });
    }

    updateDependentField(field) {
        if (!this.formContainer) return;
        
        const dependentField = this.formContainer.querySelector(`#field-${field.depends_on}`);
        const fieldElement = this.formContainer.querySelector(`#field-${field.name}`);
        
        if (!dependentField || !fieldElement) return;
        
        const dependentValue = dependentField.value;
        
        // Update options based on dependent field value
        if (field.type === 'select' || field.type === 'multi-select') {
            const options = this.getDynamicOptionsForDependency(field.dynamic_options, field.depends_on, dependentValue);
            this.updateSelectOptions(fieldElement, options);
        }
    }

    getDynamicOptionsForDependency(optionType, dependsOn, dependentValue) {
        if (!this.dynamicContext || !dependentValue) {
            return [];
        }

        // For example, if depends_on is 'table_name' and optionType is 'table_fields'
        // Return fields for the selected table
        if (optionType === 'table_fields' && this.dynamicContext.table_fields) {
            return this.dynamicContext.table_fields[dependentValue] || [];
        }

        return this.dynamicContext[optionType] || [];
    }

    updateSelectOptions(selectElement, options) {
        const isMultiSelect = selectElement.tagName === 'DIV';
        const select = isMultiSelect ? selectElement.querySelector('select') : selectElement;
        
        // Clear existing options
        select.innerHTML = '';
        
        // Add empty option for single select if not required
        if (!isMultiSelect && !this.isFieldRequired(select.name)) {
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = '-- Select --';
            select.appendChild(emptyOption);
        }

        // Add new options
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value || option;
            optionElement.textContent = option.label || option;
            select.appendChild(optionElement);
        });

        // Update size for multi-select
        if (isMultiSelect) {
            select.size = Math.min(6, options.length + 1);
        }
    }

    isFieldRequired(fieldName) {
        if (!this.formSchema || !this.formSchema.fields) return false;
        const field = this.formSchema.fields.find(f => f.name === fieldName);
        return field ? field.required : false;
    }

    async onTableSelectionChanged(tableName) {
        if (!this.formContainer) return;

        const fillBtn = this.formContainer.querySelector('#fill-form-btn');
        const statusIndicator = this.formContainer.querySelector('#table-status-indicator');
        if (!fillBtn || !statusIndicator) return;

        if (!tableName || tableName.trim() === '') {
            // No table selected - disable AI fill button and reset status
            fillBtn.disabled = true;
            fillBtn.textContent = 'Select a table first';
            this.updateTableStatus('Select a table', 'neutral');
            return;
        }

        try {
            // Show loading while fetching schema
            fillBtn.disabled = true;
            fillBtn.textContent = 'Loading table schema...';
            this.updateTableStatus('Loading schema...', 'loading');

            // Fetch fresh schema for the selected table
            const freshContext = await this.fetchTableSchema(this.currentConsultant.id, tableName);

            // Update the dynamic context with fresh schema
            this.dynamicContext = {
                ...this.dynamicContext,
                ...freshContext
            };

            // Update dependent fields with fresh schema
            this.updateDependentField({ name: 'fields', dynamic_options: 'table_fields', depends_on: 'table_name' });
            this.updateDependentField({ name: 'sort', dynamic_options: 'table_fields', depends_on: 'table_name' });

            // Enable AI fill button and show success status
            fillBtn.disabled = false;
            fillBtn.textContent = 'Fill Form with AI';
            this.updateTableStatus('Schema loaded', 'success');

        } catch (error) {
            console.error('Error fetching table schema:', error);
            utils.showError('Failed to load table schema: ' + error.message);

            // Reset button state and show error status
            fillBtn.disabled = true;
            fillBtn.textContent = 'Select a table first';
            this.updateTableStatus('Failed to load', 'error');
        }
    }

    updateTableStatus(text, status) {
        if (!this.formContainer) return;

        const statusIndicator = this.formContainer.querySelector('#table-status-indicator');
        if (!statusIndicator) return;

        const statusDot = statusIndicator.querySelector('.status-dot');
        const statusText = statusIndicator.querySelector('.status-text');

        if (statusDot && statusText) {
            // Remove all status classes
            statusDot.classList.remove('neutral', 'loading', 'success', 'error');

            // Add the new status class
            statusDot.classList.add(status);

            // Update text
            statusText.textContent = text;
        }
    }

    async fetchTableSchema(consultantId, tableName) {
        try {
            const response = await api.request('/consultant-table-schema', {
                method: 'POST',
                body: {
                    consultant_id: consultantId,
                    table_name: tableName
                }
            });
            return response;
        } catch (error) {
            console.error('Error fetching table schema:', error);
            throw error;
        }
    }

    async fillFormWithAI() {
        const instructionField = this.formContainer.querySelector('#llm-instruction');
        if (!instructionField) {
            utils.showError('Instruction field not found');
            return;
        }
        
        const instruction = instructionField.value.trim();
        if (!instruction) {
            utils.showError('Please provide an instruction for the AI to fill the form');
            return;
        }

        try {
            this.showLoading();

            const response = await api.request('/populate-form', {
                method: 'POST',
                body: {
                    consultant_id: this.currentConsultant.id,
                    instruction: instruction,
                    form_schema: this.formSchema,
                    dynamic_context: this.dynamicContext
                }
            });

            // Populate form fields with AI response
            this.setFormValues(response.form_values);

            utils.showSuccess('Form populated by AI');

        } catch (error) {
            console.error('Error filling form with AI:', error);
            utils.showError('Failed to fill form: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    setFormValues(values) {
        if (!this.formContainer) return;
        
        Object.entries(values).forEach(([fieldName, value]) => {
            const fieldElement = this.formContainer.querySelector(`#field-${fieldName}`);
            if (fieldElement) {
                if (fieldElement.tagName === 'SELECT') {
                    if (fieldElement.multiple) {
                        // Multi-select
                        Array.from(fieldElement.options).forEach(option => {
                            option.selected = Array.isArray(value) ? value.includes(option.value) : false;
                        });
                    } else {
                        // Single select
                        fieldElement.value = value;
                    }
                } else {
                    // Text, number, textarea
                    fieldElement.value = value;
                }

                // Trigger change event for dependent fields
                fieldElement.dispatchEvent(new Event('change'));
            }
        });
    }

    getFormValues() {
        const values = {};
        
        if (!this.formSchema || !this.formSchema.fields || !this.formContainer) return values;

        this.formSchema.fields.forEach(field => {
            const fieldElement = this.formContainer.querySelector(`#field-${field.name}`);
            if (fieldElement) {
                if (fieldElement.tagName === 'SELECT' && fieldElement.multiple) {
                    // Multi-select
                    values[field.name] = Array.from(fieldElement.selectedOptions).map(option => option.value);
                } else if (fieldElement.tagName === 'DIV' && fieldElement.classList.contains('multi-select-container')) {
                    // Multi-select in container
                    const select = fieldElement.querySelector('select');
                    values[field.name] = Array.from(select.selectedOptions).map(option => option.value);
                } else {
                    // Single value fields
                    values[field.name] = fieldElement.value;
                }
            }
        });

        return values;
    }

    async executeQuery() {
        try {
            // Validate form
            if (!this.validateForm()) {
                return;
            }

            this.showLoading();

            const formValues = this.getFormValues();
            
            const response = await api.request('/execute-consultant-query', {
                method: 'POST',
                body: {
                    consultant_id: this.currentConsultant.id,
                    query_parameters: formValues
                }
            });

            // Hide form and show response in chat
            this.hideForm();

            // Add response message to message manager (it's already saved to database)
            if (messageManager) {
                messageManager.addMessage(response.message);
                // Re-render messages to show the new response
                chatInterface.loadMessages();
            }

            utils.showSuccess('Query executed successfully');

        } catch (error) {
            console.error('Error executing query:', error);
            utils.showError('Failed to execute query: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    validateForm() {
        if (!this.formSchema || !this.formSchema.fields || !this.formContainer) return true;

        const errors = [];
        
        this.formSchema.fields.forEach(field => {
            if (field.required) {
                const fieldElement = this.formContainer.querySelector(`#field-${field.name}`);
                if (fieldElement) {
                    let value;
                    if (fieldElement.tagName === 'SELECT' && fieldElement.multiple) {
                        value = Array.from(fieldElement.selectedOptions).map(option => option.value);
                    } else if (fieldElement.tagName === 'DIV' && fieldElement.classList.contains('multi-select-container')) {
                        const select = fieldElement.querySelector('select');
                        value = Array.from(select.selectedOptions).map(option => option.value);
                    } else {
                        value = fieldElement.value;
                    }

                    if (!value || (Array.isArray(value) && value.length === 0) || value.toString().trim() === '') {
                        errors.push(`${field.label || field.name} is required`);
                    }
                }
            }
        });

        if (errors.length > 0) {
            utils.showError('Please fix the following errors:\n' + errors.join('\n'));
            return false;
        }

        return true;
    }

    showForm() {
        console.log('ConsultantFormInterface: showForm called');
        console.log('ConsultantFormInterface: Form container exists?', !!this.formContainer);
        
        if (!this.formContainer) {
            console.error('Form container not available. Cannot show form.');
            return;
        }
        
        console.log('ConsultantFormInterface: Form container classes before:', this.formContainer.className);
        this.formContainer.classList.remove('hidden');
        console.log('ConsultantFormInterface: Form container classes after:', this.formContainer.className);
        
        // Check if form is actually visible
        const computedStyle = window.getComputedStyle(this.formContainer);
        console.log('ConsultantFormInterface: Form display style:', computedStyle.display);
        console.log('ConsultantFormInterface: Form visibility:', computedStyle.visibility);
        
        // Focus on instruction textarea with null check using form container scope
        const instructionField = this.formContainer.querySelector('#llm-instruction');
        if (instructionField) {
            instructionField.focus();
            console.log('ConsultantFormInterface: Focused on instruction field');
        } else {
            console.log('ConsultantFormInterface: Instruction field not found');
        }
    }

    // Test method to manually show form (for debugging)
    testShowForm() {
        console.log('ConsultantFormInterface: TEST - Manually showing form');
        if (!this.formContainer) {
            console.log('ConsultantFormInterface: TEST - Creating form container first');
            this.createFormContainer();
        }
        
        // Set dummy data
        this.formSchema = { fields: [] };
        this.dynamicContext = {};
        
        // Show form
        this.showForm();
        console.log('ConsultantFormInterface: TEST - Form should be visible now');
    }

    hideForm() {
        if (!this.formContainer) {
            console.warn('Form container not available. Cannot hide form.');
            return;
        }
        
        this.formContainer.classList.add('hidden');
        
        // Clear form
        this.clearForm();
    }

    clearForm() {
        if (!this.formContainer) {
            return;
        }
        
        const instructionField = this.formContainer.querySelector('#llm-instruction');
        if (instructionField) {
            instructionField.value = '';
        }
        
        // Clear all form fields using form container scope
        const formFields = this.formContainer.querySelectorAll('#dynamic-form-fields input, #dynamic-form-fields select, #dynamic-form-fields textarea');
        formFields.forEach(field => {
            if (field.tagName === 'SELECT' && field.multiple) {
                Array.from(field.options).forEach(option => option.selected = false);
            } else {
                field.value = '';
            }
        });
    }

    showLoading() {
        if (!this.formContainer) {
            return;
        }
        
        const loadingElement = this.formContainer.querySelector('#form-loading');
        if (loadingElement) {
            loadingElement.classList.remove('hidden');
        }
    }

    hideLoading() {
        if (!this.formContainer) {
            return;
        }
        
        const loadingElement = this.formContainer.querySelector('#form-loading');
        if (loadingElement) {
            loadingElement.classList.add('hidden');
        }
    }
}

// Initialize the consultant form interface
window.consultantFormInterface = new ConsultantFormInterface();
