// Airtable Configuration Component
class AirtableConfig {
    constructor() {
        this.currentConsultant = null;
        this.init();
    }

    init() {
        this.createModal();
        this.bindEvents();
        
        // Listen for consultant changes
        window.addEventListener('consultantChanged', (e) => {
            this.onConsultantChanged(e.detail);
        });
    }

    createModal() {
        const modalHTML = `
            <div id="airtable-config-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Configure Airtable Connection</h2>
                        <button class="modal-close" id="airtable-config-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="config-step" id="step-credentials">
                            <h3>Step 1: Enter Airtable Credentials</h3>
                            <div class="form-group">
                                <label for="airtable-base-id">Base ID</label>
                                <input type="text" id="airtable-base-id" placeholder="appXXXXXXXXXXXXXX" />
                                <small>Find this in your Airtable base URL or API documentation</small>
                            </div>
                            <div class="form-group">
                                <label for="airtable-api-key">API Key</label>
                                <input type="password" id="airtable-api-key" placeholder="keyXXXXXXXXXXXXXX" />
                                <small>Create a personal access token in your Airtable account</small>
                            </div>
                            <div class="form-actions">
                                <button id="test-connection-btn" class="btn btn-secondary">Test Connection</button>
                            </div>
                            <div id="connection-status" class="status-message"></div>
                        </div>

                        <div class="config-step" id="step-table" style="display: none;">
                            <h3>Step 2: Select Table</h3>
                            <div class="form-group">
                                <label for="airtable-table-select">Choose Table</label>
                                <select id="airtable-table-select">
                                    <option value="">Select a table...</option>
                                </select>
                            </div>
                            <div id="table-info" class="table-info"></div>
                        </div>

                        <div class="config-step" id="step-complete" style="display: none;">
                            <h3>✅ Configuration Complete</h3>
                            <p>Your Airtable Data Assistant is now connected and ready to query your data!</p>
                            <div class="example-queries">
                                <h4>Try asking questions like:</h4>
                                <ul>
                                    <li>"How many records are in the database?"</li>
                                    <li>"Show me the latest 10 entries"</li>
                                    <li>"Find all records where status is active"</li>
                                    <li>"What are the different categories in the data?"</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="airtable-config-cancel" class="btn btn-secondary">Cancel</button>
                        <button id="airtable-config-save" class="btn btn-primary" disabled>Save Configuration</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    bindEvents() {
        const modal = document.getElementById('airtable-config-modal');
        const closeBtn = document.getElementById('airtable-config-close');
        const cancelBtn = document.getElementById('airtable-config-cancel');
        const saveBtn = document.getElementById('airtable-config-save');
        const testBtn = document.getElementById('test-connection-btn');
        const tableSelect = document.getElementById('airtable-table-select');

        // Close modal events
        closeBtn.addEventListener('click', () => this.hideModal());
        cancelBtn.addEventListener('click', () => this.hideModal());
        
        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideModal();
            }
        });

        // Test connection
        testBtn.addEventListener('click', () => this.testConnection());

        // Table selection
        tableSelect.addEventListener('change', () => this.onTableSelected());

        // Save configuration
        saveBtn.addEventListener('click', () => this.saveConfiguration());

        // Input validation
        const baseIdInput = document.getElementById('airtable-base-id');
        const apiKeyInput = document.getElementById('airtable-api-key');
        
        [baseIdInput, apiKeyInput].forEach(input => {
            input.addEventListener('input', () => this.validateInputs());
        });
    }

    onConsultantChanged(consultant) {
        this.currentConsultant = consultant;
        
        // Check if this is an Airtable consultant and show config button
        if (consultant && consultant.consultant_type === 'airtable') {
            this.showConfigButton();
            this.checkExistingConfig();
        } else {
            this.hideConfigButton();
        }
    }

    showConfigButton() {
        // Add config button to consultant info if it doesn't exist
        const consultantInfo = document.querySelector('.consultant-info');
        if (consultantInfo && !document.getElementById('airtable-config-btn')) {
            const configBtn = document.createElement('button');
            configBtn.id = 'airtable-config-btn';
            configBtn.className = 'btn btn-secondary btn-sm';
            configBtn.innerHTML = '⚙️ Configure Airtable';
            configBtn.addEventListener('click', () => this.showModal());
            
            consultantInfo.appendChild(configBtn);
        }
    }

    hideConfigButton() {
        const configBtn = document.getElementById('airtable-config-btn');
        if (configBtn) {
            configBtn.remove();
        }
    }

    async checkExistingConfig() {
        if (!this.currentConsultant) return;

        try {
            const config = await api.getAirtableConfig(this.currentConsultant.id);
            const configBtn = document.getElementById('airtable-config-btn');
            
            if (config.configured && configBtn) {
                configBtn.innerHTML = '⚙️ Reconfigure Airtable';
                configBtn.classList.add('configured');
            }
        } catch (error) {
            console.error('Error checking Airtable config:', error);
        }
    }

    showModal() {
        const modal = document.getElementById('airtable-config-modal');
        modal.classList.add('active');
        
        // Reset form
        this.resetForm();
        
        // Load existing config if available
        this.loadExistingConfig();
    }

    hideModal() {
        const modal = document.getElementById('airtable-config-modal');
        modal.classList.remove('active');
    }

    resetForm() {
        document.getElementById('airtable-base-id').value = '';
        document.getElementById('airtable-api-key').value = '';
        document.getElementById('airtable-table-select').innerHTML = '<option value="">Select a table...</option>';
        
        // Reset steps
        document.getElementById('step-credentials').style.display = 'block';
        document.getElementById('step-table').style.display = 'none';
        document.getElementById('step-complete').style.display = 'none';
        
        // Reset status
        document.getElementById('connection-status').innerHTML = '';
        document.getElementById('airtable-config-save').disabled = true;
        
        this.validateInputs();
    }

    async loadExistingConfig() {
        if (!this.currentConsultant) return;

        try {
            const config = await api.getAirtableConfig(this.currentConsultant.id);
            if (config.configured) {
                document.getElementById('airtable-base-id').value = config.base_id || '';
                if (config.table_name) {
                    // Show table step and populate
                    document.getElementById('step-table').style.display = 'block';
                    const tableSelect = document.getElementById('airtable-table-select');
                    tableSelect.innerHTML = `<option value="${config.table_name}" selected>${config.table_name}</option>`;
                    document.getElementById('airtable-config-save').disabled = false;
                }
            }
        } catch (error) {
            console.error('Error loading existing config:', error);
        }
    }

    validateInputs() {
        const baseId = document.getElementById('airtable-base-id').value.trim();
        const apiKey = document.getElementById('airtable-api-key').value.trim();
        const testBtn = document.getElementById('test-connection-btn');
        
        const isValid = baseId.startsWith('app') && baseId.length >= 17 && 
                       apiKey.startsWith('key') && apiKey.length >= 17;
        
        testBtn.disabled = !isValid;
    }

    async testConnection() {
        const baseId = document.getElementById('airtable-base-id').value.trim();
        const apiKey = document.getElementById('airtable-api-key').value.trim();
        const statusDiv = document.getElementById('connection-status');
        const testBtn = document.getElementById('test-connection-btn');
        
        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        statusDiv.innerHTML = '<div class="status-loading">Testing connection...</div>';

        try {
            const result = await api.testAirtableConnection({ base_id: baseId, api_key: apiKey });
            
            if (result.success) {
                statusDiv.innerHTML = '<div class="status-success">✅ Connection successful!</div>';
                await this.loadTables(baseId, apiKey);
            } else {
                statusDiv.innerHTML = `<div class="status-error">❌ Connection failed: ${result.error}</div>`;
            }
        } catch (error) {
            statusDiv.innerHTML = `<div class="status-error">❌ Connection failed: ${error.message}</div>`;
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = 'Test Connection';
        }
    }

    async loadTables(baseId, apiKey) {
        try {
            const result = await api.getAirtableTables({ base_id: baseId, api_key: apiKey });
            
            if (result.success && result.tables) {
                const tableSelect = document.getElementById('airtable-table-select');
                tableSelect.innerHTML = '<option value="">Select a table...</option>';
                
                result.tables.forEach(table => {
                    const option = document.createElement('option');
                    option.value = table.name;
                    option.textContent = `${table.name} (${table.fieldCount} fields)`;
                    tableSelect.appendChild(option);
                });
                
                // Show table selection step
                document.getElementById('step-table').style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading tables:', error);
            document.getElementById('connection-status').innerHTML = 
                `<div class="status-error">❌ Failed to load tables: ${error.message}</div>`;
        }
    }

    onTableSelected() {
        const tableSelect = document.getElementById('airtable-table-select');
        const saveBtn = document.getElementById('airtable-config-save');
        
        if (tableSelect.value) {
            saveBtn.disabled = false;
            
            // Show table info
            const tableInfo = document.getElementById('table-info');
            tableInfo.innerHTML = `
                <div class="selected-table">
                    <strong>Selected Table:</strong> ${tableSelect.value}
                    <p>This table will be used for all data queries from the Airtable Data Assistant.</p>
                </div>
            `;
        } else {
            saveBtn.disabled = true;
        }
    }

    async saveConfiguration() {
        if (!this.currentConsultant) return;

        const baseId = document.getElementById('airtable-base-id').value.trim();
        const apiKey = document.getElementById('airtable-api-key').value.trim();
        const tableName = document.getElementById('airtable-table-select').value;
        const saveBtn = document.getElementById('airtable-config-save');

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            await api.saveAirtableConfig({
                consultant_id: this.currentConsultant.id,
                base_id: baseId,
                api_key: apiKey,
                table_name: tableName
            });

            // Show completion step
            document.getElementById('step-credentials').style.display = 'none';
            document.getElementById('step-table').style.display = 'none';
            document.getElementById('step-complete').style.display = 'block';

            // Update config button
            const configBtn = document.getElementById('airtable-config-btn');
            if (configBtn) {
                configBtn.innerHTML = '⚙️ Reconfigure Airtable';
                configBtn.classList.add('configured');
            }

            utils.showSuccess('Airtable configuration saved successfully!');

            // Auto-close after a delay
            setTimeout(() => {
                this.hideModal();
            }, 3000);

        } catch (error) {
            console.error('Error saving configuration:', error);
            utils.showError(`Failed to save configuration: ${error.message}`);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Configuration';
        }
    }
}

// Initialize Airtable configuration
window.airtableConfig = new AirtableConfig();
