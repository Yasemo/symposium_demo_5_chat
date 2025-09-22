// Visual Query Builder for Airtable
class AirtableQueryBuilder {
    constructor(container, options = {}) {
        this.container = container;
        this.schema = null;
        this.conditions = [];
        this.selectedFields = [];
        this.sortField = null;
        this.sortDirection = 'asc';
        this.maxRecords = 100;
        this.onQueryChange = options.onQueryChange || (() => {});
        
        this.init();
    }

    init() {
        this.render();
        this.bindEvents();
    }

    setSchema(schema) {
        this.schema = schema;
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="query-builder">
                <div class="query-section">
                    <h4>Select Fields</h4>
                    <div class="field-selector">
                        <div class="field-options">
                            <label class="field-option">
                                <input type="checkbox" id="select-all-fields" ${this.selectedFields.length === 0 ? 'checked' : ''}>
                                <span>All Fields</span>
                            </label>
                            <div id="individual-fields" class="individual-fields ${this.selectedFields.length === 0 ? 'hidden' : ''}">
                                ${this.renderFieldOptions()}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="query-section">
                    <h4>Filter Conditions</h4>
                    <div class="conditions-container">
                        ${this.renderConditions()}
                    </div>
                    <button type="button" class="add-condition-btn">+ Add Condition</button>
                </div>

                <div class="query-section">
                    <h4>Sort & Limit</h4>
                    <div class="sort-limit-controls">
                        <div class="sort-controls">
                            <label>Sort by:</label>
                            <select id="sort-field">
                                <option value="">No sorting</option>
                                ${this.renderSortOptions()}
                            </select>
                            <select id="sort-direction">
                                <option value="asc">Ascending</option>
                                <option value="desc">Descending</option>
                            </select>
                        </div>
                        <div class="limit-controls">
                            <label>Max records:</label>
                            <input type="number" id="max-records" value="${this.maxRecords}" min="1" max="1000">
                        </div>
                    </div>
                </div>

                <div class="query-section">
                    <h4>Generated Query</h4>
                    <div class="query-preview">
                        <div class="formula-preview">
                            <label>Filter Formula:</label>
                            <code id="formula-display">${this.generateFormula()}</code>
                        </div>
                        <div class="query-summary">
                            <div><strong>Fields:</strong> <span id="fields-summary">${this.getFieldsSummary()}</span></div>
                            <div><strong>Sort:</strong> <span id="sort-summary">${this.getSortSummary()}</span></div>
                            <div><strong>Limit:</strong> <span id="limit-summary">${this.maxRecords}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderFieldOptions() {
        if (!this.schema || !this.schema.fields) return '';
        
        return this.schema.fields.map(field => `
            <label class="field-option">
                <input type="checkbox" class="field-checkbox" value="${field.name}" 
                       ${this.selectedFields.includes(field.name) ? 'checked' : ''}>
                <span>${field.name}</span>
                <small class="field-type">(${field.type})</small>
            </label>
        `).join('');
    }

    renderSortOptions() {
        if (!this.schema || !this.schema.fields) return '';
        
        return this.schema.fields.map(field => `
            <option value="${field.name}" ${this.sortField === field.name ? 'selected' : ''}>
                ${field.name}
            </option>
        `).join('');
    }

    renderConditions() {
        if (this.conditions.length === 0) {
            return '<div class="no-conditions">No filter conditions. Click "Add Condition" to start filtering.</div>';
        }

        return this.conditions.map((condition, index) => this.renderCondition(condition, index)).join('');
    }

    renderCondition(condition, index) {
        const fieldOptions = this.schema ? this.schema.fields.map(field => 
            `<option value="${field.name}" ${condition.field === field.name ? 'selected' : ''}>${field.name}</option>`
        ).join('') : '';

        const selectedField = this.schema ? this.schema.fields.find(f => f.name === condition.field) : null;
        const operatorOptions = this.getOperatorOptions(selectedField);
        
        return `
            <div class="condition" data-index="${index}">
                ${index > 0 ? `
                    <div class="logic-operator">
                        <select class="logic-select">
                            <option value="AND" ${condition.logic === 'AND' ? 'selected' : ''}>AND</option>
                            <option value="OR" ${condition.logic === 'OR' ? 'selected' : ''}>OR</option>
                        </select>
                    </div>
                ` : ''}
                
                <div class="condition-controls">
                    <select class="field-select">
                        <option value="">Select field...</option>
                        ${fieldOptions}
                    </select>
                    
                    <select class="operator-select">
                        ${operatorOptions}
                    </select>
                    
                    <div class="value-input">
                        ${this.renderValueInput(selectedField, condition)}
                    </div>
                    
                    <button type="button" class="remove-condition-btn" title="Remove condition">×</button>
                </div>
            </div>
        `;
    }

    getOperatorOptions(field) {
        const baseOperators = [
            { value: '', label: 'Select operator...' },
            { value: '=', label: 'equals' },
            { value: '!=', label: 'not equals' }
        ];

        if (!field) return baseOperators.map(op => 
            `<option value="${op.value}">${op.label}</option>`
        ).join('');

        let operators = [...baseOperators];

        // Add type-specific operators
        switch (field.type) {
            case 'singleLineText':
            case 'multilineText':
            case 'richText':
                operators.push(
                    { value: 'CONTAINS', label: 'contains' },
                    { value: 'NOT_CONTAINS', label: 'does not contain' },
                    { value: 'STARTS_WITH', label: 'starts with' },
                    { value: 'ENDS_WITH', label: 'ends with' }
                );
                break;
            
            case 'number':
            case 'currency':
            case 'percent':
            case 'rating':
                operators.push(
                    { value: '>', label: 'greater than' },
                    { value: '>=', label: 'greater than or equal' },
                    { value: '<', label: 'less than' },
                    { value: '<=', label: 'less than or equal' }
                );
                break;
            
            case 'date':
            case 'dateTime':
                operators.push(
                    { value: '>', label: 'after' },
                    { value: '>=', label: 'on or after' },
                    { value: '<', label: 'before' },
                    { value: '<=', label: 'on or before' }
                );
                break;
            
            case 'multipleSelects':
                operators.push(
                    { value: 'HAS', label: 'has any of' },
                    { value: 'HAS_ALL', label: 'has all of' },
                    { value: 'NOT_HAS', label: 'does not have' }
                );
                break;
            
            case 'checkbox':
                operators = [
                    { value: '', label: 'Select operator...' },
                    { value: '=', label: 'is' }
                ];
                break;
        }

        return operators.map(op => 
            `<option value="${op.value}">${op.label}</option>`
        ).join('');
    }

    renderValueInput(field, condition) {
        if (!field) {
            return '<input type="text" class="value-input-field" placeholder="Select a field first" disabled>';
        }

        const value = condition.value || '';

        switch (field.type) {
            case 'singleSelect':
                const selectOptions = field.options && field.options.choices ? 
                    field.options.choices.map(choice => 
                        `<option value="${choice.name}" ${value === choice.name ? 'selected' : ''}>${choice.name}</option>`
                    ).join('') : '';
                return `
                    <div class="searchable-select-container">
                        <input type="text" class="search-input" placeholder="Search ${field.name} options..." data-field="${field.name}">
                        <select class="value-input-field searchable-select">
                            <option value="">Select value...</option>
                            ${selectOptions}
                        </select>
                        <div class="no-results hidden">No matching options found</div>
                    </div>
                `;

            case 'multipleSelects':
                const multiOptions = field.options && field.options.choices ? 
                    field.options.choices.map(choice => {
                        const isSelected = Array.isArray(value) ? value.includes(choice.name) : false;
                        return `
                            <label class="multi-select-option" data-value="${choice.name.toLowerCase()}">
                                <input type="checkbox" value="${choice.name}" ${isSelected ? 'checked' : ''}>
                                <span>${choice.name}</span>
                            </label>
                        `;
                    }).join('') : '';
                return `
                    <div class="searchable-multi-select-container">
                        <input type="text" class="search-input" placeholder="Search ${field.name} options..." data-field="${field.name}">
                        <div class="multi-select-container">
                            ${multiOptions}
                        </div>
                        <div class="no-results hidden">No matching options found</div>
                        <div class="selection-summary">
                            <span class="selected-count">0 selected</span>
                            <button type="button" class="clear-selection-btn">Clear all</button>
                        </div>
                    </div>
                `;

            case 'checkbox':
                return `
                    <select class="value-input-field">
                        <option value="">Select value...</option>
                        <option value="1" ${value === '1' || value === true ? 'selected' : ''}>Checked</option>
                        <option value="0" ${value === '0' || value === false ? 'selected' : ''}>Unchecked</option>
                    </select>
                `;

            case 'number':
            case 'currency':
            case 'percent':
            case 'rating':
                return `<input type="number" class="value-input-field" value="${value}" placeholder="Enter number">`;

            case 'date':
                return `<input type="date" class="value-input-field" value="${value}">`;

            case 'dateTime':
                return `<input type="datetime-local" class="value-input-field" value="${value}">`;

            default:
                return `<input type="text" class="value-input-field" value="${value}" placeholder="Enter value">`;
        }
    }

    bindEvents() {
        // Field selection events
        this.container.addEventListener('change', (e) => {
            if (e.target.id === 'select-all-fields') {
                this.handleSelectAllFields(e.target.checked);
            } else if (e.target.classList.contains('field-checkbox')) {
                this.handleFieldSelection();
            } else if (e.target.id === 'sort-field') {
                this.sortField = e.target.value;
                this.updateQuery();
            } else if (e.target.id === 'sort-direction') {
                this.sortDirection = e.target.value;
                this.updateQuery();
            } else if (e.target.id === 'max-records') {
                this.maxRecords = parseInt(e.target.value) || 100;
                this.updateQuery();
            } else if (e.target.classList.contains('field-select')) {
                this.handleFieldChange(e.target);
            } else if (e.target.classList.contains('operator-select')) {
                this.handleOperatorChange(e.target);
            } else if (e.target.classList.contains('value-input-field')) {
                this.handleValueChange(e.target);
            } else if (e.target.classList.contains('logic-select')) {
                this.handleLogicChange(e.target);
            }
        });

        // Add condition button
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-condition-btn')) {
                this.addCondition();
            } else if (e.target.classList.contains('remove-condition-btn')) {
                this.removeCondition(e.target);
            }
        });

        // Multi-select checkbox handling
        this.container.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' && e.target.closest('.multi-select-container')) {
                this.handleMultiSelectChange(e.target);
            }
        });

        // Search functionality
        this.container.addEventListener('input', (e) => {
            if (e.target.classList.contains('search-input')) {
                this.handleSearch(e.target);
            }
        });

        // Clear selection button
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('clear-selection-btn')) {
                this.handleClearSelection(e.target);
            }
        });

        // Keyboard navigation for search
        this.container.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('search-input')) {
                this.handleSearchKeydown(e);
            }
        });
    }

    handleSelectAllFields(selectAll) {
        const individualFields = this.container.querySelector('#individual-fields');
        if (selectAll) {
            this.selectedFields = [];
            individualFields.classList.add('hidden');
        } else {
            individualFields.classList.remove('hidden');
        }
        this.updateQuery();
    }

    handleFieldSelection() {
        const checkboxes = this.container.querySelectorAll('.field-checkbox:checked');
        this.selectedFields = Array.from(checkboxes).map(cb => cb.value);
        
        const selectAllCheckbox = this.container.querySelector('#select-all-fields');
        selectAllCheckbox.checked = this.selectedFields.length === 0;
        
        this.updateQuery();
    }

    handleFieldChange(select) {
        const conditionIndex = parseInt(select.closest('.condition').dataset.index);
        const condition = this.conditions[conditionIndex];
        
        condition.field = select.value;
        condition.operator = '';
        condition.value = '';
        
        // Re-render this condition to update operator options and value input
        this.renderSingleCondition(conditionIndex);
        this.updateQuery();
    }

    handleOperatorChange(select) {
        const conditionIndex = parseInt(select.closest('.condition').dataset.index);
        const condition = this.conditions[conditionIndex];
        
        condition.operator = select.value;
        this.updateQuery();
    }

    handleValueChange(input) {
        const conditionIndex = parseInt(input.closest('.condition').dataset.index);
        const condition = this.conditions[conditionIndex];
        
        condition.value = input.value;
        this.updateQuery();
    }

    handleLogicChange(select) {
        const conditionIndex = parseInt(select.closest('.condition').dataset.index);
        const condition = this.conditions[conditionIndex];
        
        condition.logic = select.value;
        this.updateQuery();
    }

    handleMultiSelectChange(checkbox) {
        const conditionIndex = parseInt(checkbox.closest('.condition').dataset.index);
        const condition = this.conditions[conditionIndex];
        
        const container = checkbox.closest('.multi-select-container');
        const checkedBoxes = container.querySelectorAll('input[type="checkbox"]:checked');
        condition.value = Array.from(checkedBoxes).map(cb => cb.value);
        
        // Update selection summary
        this.updateSelectionSummary(container);
        this.updateQuery();
    }

    handleSearch(searchInput) {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const container = searchInput.closest('.searchable-select-container, .searchable-multi-select-container');
        
        if (container.classList.contains('searchable-select-container')) {
            this.handleSingleSelectSearch(searchInput, searchTerm);
        } else if (container.classList.contains('searchable-multi-select-container')) {
            this.handleMultiSelectSearch(searchInput, searchTerm);
        }
    }

    handleSingleSelectSearch(searchInput, searchTerm) {
        const container = searchInput.closest('.searchable-select-container');
        const select = container.querySelector('.searchable-select');
        const noResults = container.querySelector('.no-results');
        const options = select.querySelectorAll('option:not([value=""])');
        
        let hasVisibleOptions = false;
        
        options.forEach(option => {
            const text = option.textContent.toLowerCase();
            const matches = !searchTerm || text.includes(searchTerm);
            
            option.style.display = matches ? '' : 'none';
            if (matches) hasVisibleOptions = true;
        });
        
        // Show/hide no results message
        if (searchTerm && !hasVisibleOptions) {
            noResults.classList.remove('hidden');
            select.style.display = 'none';
        } else {
            noResults.classList.add('hidden');
            select.style.display = '';
        }
        
        // Auto-select if only one match
        if (searchTerm && hasVisibleOptions) {
            const visibleOptions = Array.from(options).filter(opt => opt.style.display !== 'none');
            if (visibleOptions.length === 1) {
                select.value = visibleOptions[0].value;
                this.handleValueChange(select);
            }
        }
    }

    handleMultiSelectSearch(searchInput, searchTerm) {
        const container = searchInput.closest('.searchable-multi-select-container');
        const multiContainer = container.querySelector('.multi-select-container');
        const noResults = container.querySelector('.no-results');
        const options = multiContainer.querySelectorAll('.multi-select-option');
        
        let hasVisibleOptions = false;
        
        options.forEach(option => {
            const text = option.dataset.value || '';
            const matches = !searchTerm || text.includes(searchTerm);
            
            option.style.display = matches ? '' : 'none';
            if (matches) hasVisibleOptions = true;
        });
        
        // Show/hide no results message
        if (searchTerm && !hasVisibleOptions) {
            noResults.classList.remove('hidden');
        } else {
            noResults.classList.add('hidden');
        }
    }

    handleClearSelection(button) {
        const container = button.closest('.searchable-multi-select-container');
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Update the condition value
        const conditionIndex = parseInt(button.closest('.condition').dataset.index);
        const condition = this.conditions[conditionIndex];
        condition.value = [];
        
        this.updateSelectionSummary(container);
        this.updateQuery();
    }

    handleSearchKeydown(e) {
        const searchInput = e.target;
        const container = searchInput.closest('.searchable-select-container, .searchable-multi-select-container');
        
        switch (e.key) {
            case 'Escape':
                searchInput.value = '';
                this.handleSearch(searchInput);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (container.classList.contains('searchable-select-container')) {
                    const select = container.querySelector('.searchable-select');
                    const visibleOptions = Array.from(select.querySelectorAll('option:not([value=""]):not([style*="display: none"])'));
                    if (visibleOptions.length === 1) {
                        select.value = visibleOptions[0].value;
                        this.handleValueChange(select);
                        searchInput.value = visibleOptions[0].textContent;
                    }
                }
                break;
                
            case 'ArrowDown':
            case 'ArrowUp':
                e.preventDefault();
                // TODO: Implement keyboard navigation through options
                break;
        }
    }

    updateSelectionSummary(container) {
        const selectedCount = container.querySelectorAll('input[type="checkbox"]:checked').length;
        const summaryElement = container.querySelector('.selected-count');
        const clearButton = container.querySelector('.clear-selection-btn');
        
        if (summaryElement) {
            summaryElement.textContent = `${selectedCount} selected`;
        }
        
        if (clearButton) {
            clearButton.style.display = selectedCount > 0 ? '' : 'none';
        }
    }

    addCondition() {
        this.conditions.push({
            field: '',
            operator: '',
            value: '',
            logic: 'AND'
        });
        this.render();
    }

    removeCondition(button) {
        const conditionIndex = parseInt(button.closest('.condition').dataset.index);
        this.conditions.splice(conditionIndex, 1);
        this.render();
        this.updateQuery();
    }

    renderSingleCondition(index) {
        const conditionElement = this.container.querySelector(`[data-index="${index}"]`);
        if (conditionElement) {
            conditionElement.outerHTML = this.renderCondition(this.conditions[index], index);
        }
    }

    generateFormula() {
        if (this.conditions.length === 0) return '';

        const validConditions = this.conditions.filter(c => c.field && c.operator && c.value !== '');
        if (validConditions.length === 0) return '';

        const formulaParts = validConditions.map((condition, index) => {
            let formula = this.generateConditionFormula(condition);
            
            if (index > 0 && condition.logic) {
                formula = `${condition.logic}(${formula})`;
            }
            
            return formula;
        });

        return formulaParts.length === 1 ? formulaParts[0] : formulaParts.join(', ');
    }

    generateConditionFormula(condition) {
        const field = `{${condition.field}}`;
        const value = condition.value;
        
        switch (condition.operator) {
            case '=':
                return `${field} = "${value}"`;
            case '!=':
                return `${field} != "${value}"`;
            case '>':
                return `${field} > ${this.formatValue(value)}`;
            case '>=':
                return `${field} >= ${this.formatValue(value)}`;
            case '<':
                return `${field} < ${this.formatValue(value)}`;
            case '<=':
                return `${field} <= ${this.formatValue(value)}`;
            case 'CONTAINS':
                return `FIND("${value}", ${field})`;
            case 'NOT_CONTAINS':
                return `NOT(FIND("${value}", ${field}))`;
            case 'STARTS_WITH':
                return `LEFT(${field}, ${value.length}) = "${value}"`;
            case 'ENDS_WITH':
                return `RIGHT(${field}, ${value.length}) = "${value}"`;
            case 'HAS':
                if (Array.isArray(value)) {
                    return value.map(v => `FIND("${v}", ${field})`).join(' OR ');
                }
                return `FIND("${value}", ${field})`;
            case 'HAS_ALL':
                if (Array.isArray(value)) {
                    return value.map(v => `FIND("${v}", ${field})`).join(' AND ');
                }
                return `FIND("${value}", ${field})`;
            case 'NOT_HAS':
                if (Array.isArray(value)) {
                    return value.map(v => `NOT(FIND("${v}", ${field}))`).join(' AND ');
                }
                return `NOT(FIND("${value}", ${field}))`;
            default:
                return '';
        }
    }

    formatValue(value) {
        // Check if value is numeric
        if (!isNaN(value) && !isNaN(parseFloat(value))) {
            return value;
        }
        return `"${value}"`;
    }

    getFieldsSummary() {
        if (this.selectedFields.length === 0) {
            return 'All fields';
        }
        return this.selectedFields.join(', ');
    }

    getSortSummary() {
        if (!this.sortField) {
            return 'No sorting';
        }
        return `${this.sortField} (${this.sortDirection})`;
    }

    updateQuery() {
        // Update the preview displays
        const formulaDisplay = this.container.querySelector('#formula-display');
        const fieldsSummary = this.container.querySelector('#fields-summary');
        const sortSummary = this.container.querySelector('#sort-summary');
        const limitSummary = this.container.querySelector('#limit-summary');

        if (formulaDisplay) formulaDisplay.textContent = this.generateFormula();
        if (fieldsSummary) fieldsSummary.textContent = this.getFieldsSummary();
        if (sortSummary) sortSummary.textContent = this.getSortSummary();
        if (limitSummary) limitSummary.textContent = this.maxRecords;

        // Notify parent component
        this.onQueryChange(this.getQueryParameters());
    }

    getQueryParameters() {
        return {
            fields: this.selectedFields.length > 0 ? this.selectedFields : [],
            filterByFormula: this.generateFormula(),
            sort: this.sortField ? [{ field: this.sortField, direction: this.sortDirection }] : [],
            maxRecords: this.maxRecords
        };
    }

    // Public method to get current query state
    getQuery() {
        return this.getQueryParameters();
    }

    // Public method to set query state
    setQuery(queryParams) {
        if (queryParams.fields) {
            this.selectedFields = queryParams.fields;
        }
        
        if (queryParams.sort && queryParams.sort.length > 0) {
            this.sortField = queryParams.sort[0].field;
            this.sortDirection = queryParams.sort[0].direction || 'asc';
        }
        
        if (queryParams.maxRecords) {
            this.maxRecords = queryParams.maxRecords;
        }
        
        // TODO: Parse filterByFormula back into conditions (complex)
        
        this.render();
        this.updateQuery();
    }
}

// Export for use in other components
window.AirtableQueryBuilder = AirtableQueryBuilder;
