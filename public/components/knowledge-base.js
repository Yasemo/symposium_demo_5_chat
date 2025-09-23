// Knowledge Base Component
class KnowledgeBase {
    constructor() {
        this.cards = [];
        this.tags = [];
        this.currentEditingCard = null;
        this.currentEditingTag = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadTags();
        
        // Initialize modal state
        this.modalOpen = false;
        this.currentSearchTerm = '';
        this.selectedTagFilters = [];
        this.currentSort = 'updated_desc';
        this.currentView = 'grid';
        
        // Listen for symposium changes
        window.addEventListener('symposiumChanged', (e) => {
            this.onSymposiumChanged(e.detail);
        });
    }

    bindEvents() {
        const addCardBtn = document.getElementById('add-card-btn');
        const modal = document.getElementById('knowledge-card-modal');
        const form = document.getElementById('knowledge-card-form');
        const cancelBtn = document.getElementById('cancel-card');
        const previewToggle = document.getElementById('preview-toggle');
        const cardContent = document.getElementById('card-content');
        const wordCount = document.getElementById('word-count');

        // Tag management events
        const createTagBtn = document.getElementById('create-tag-btn');
        const tagNameInput = document.getElementById('tag-name-input');
        const tagColorInput = document.getElementById('tag-color-input');

        // Add card button
        addCardBtn.addEventListener('click', () => {
            this.openCardModal();
        });

        // Tag creation
        createTagBtn.addEventListener('click', () => {
            this.handleCreateTag();
        });

        // Enter key to create tag
        tagNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleCreateTag();
            }
        });

        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCard();
        });

        // Cancel button
        cancelBtn.addEventListener('click', () => {
            this.closeCardModal();
        });

        // Close modal on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeCardModal();
            }
        });

        // Close button
        modal.querySelector('.close-btn').addEventListener('click', () => {
            this.closeCardModal();
        });

        // Preview toggle
        previewToggle.addEventListener('click', () => {
            this.togglePreview();
        });

        // Word count update
        cardContent.addEventListener('input', () => {
            this.updateWordCount();
        });

        // Auto-save (save after user stops typing for 2 seconds)
        let saveTimeout;
        cardContent.addEventListener('input', () => {
            if (this.currentEditingCard && this.currentEditingCard.id) {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    this.autoSave();
                }, 2000);
            }
        });

        // Knowledge Base expand button
        const expandBtn = document.getElementById('knowledge-base-expand-btn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => {
                this.openFullModal();
            });
        }

        // Bind modal events
        this.bindModalEvents();
    }

    async onSymposiumChanged(symposium) {
        // Knowledge base is now global, so we always load all cards
        await this.loadCards();
        this.enableAddCard();
    }

    async loadCards() {
        try {
            // Load global knowledge base cards (no symposium_id needed)
            this.cards = await api.getKnowledgeBaseCards();
            this.renderCards();
            
            // Update modal if open
            if (this.modalOpen) {
                this.filterAndRenderModalCards();
            }
        } catch (error) {
            console.error('Error loading cards:', error);
            alert('Failed to load cards: ' + error.message);
        }
    }

    // Dispatch tags updated event
    dispatchTagsUpdated() {
        window.dispatchEvent(new CustomEvent('tagsUpdated'));
    }

    renderCards() {
        const container = document.getElementById('knowledge-base-cards');
        
        if (this.cards.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No knowledge base cards yet</p>
                    <p class="empty-state-hint">Add consultant responses or create your own cards</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.cards.map(card => this.createCardHTML(card)).join('');
        this.bindCardEvents();
    }

    createCardHTML(card) {
        const isVisible = card.is_visible;
        const cardTypeIcon = card.card_type === 'consultant_response' ? '💬' : '📝';
        const truncatedContent = this.truncateContent(card.content, 150);
        const sourceInfo = card.source_consultant_name ? 
            `From ${card.source_consultant_name}` : 
            'User created';

        return `
            <div class="knowledge-card ${isVisible ? '' : 'hidden'}" data-card-id="${card.id}">
                <div class="card-header">
                    <div class="card-type-icon">${cardTypeIcon}</div>
                    <div class="card-title" title="${card.title}">${card.title}</div>
                    <div class="card-controls">
                        <button class="card-control-btn visibility-btn" title="${isVisible ? 'Hide from context' : 'Show in context'}">
                            ${isVisible ? '👁️' : '🚫'}
                        </button>
                        <button class="card-control-btn expand-btn" title="Expand card">📖</button>
                        <button class="card-control-btn delete-btn" title="Delete card">🗑️</button>
                    </div>
                </div>
                <div class="card-content">
                    <div class="card-text">${truncatedContent}</div>
                    <div class="card-meta">
                        <small>${sourceInfo} • ${utils.formatTime(card.created_at)}</small>
                    </div>
                </div>
            </div>
        `;
    }

    bindCardEvents() {
        // Expand buttons
        document.querySelectorAll('.expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cardId = parseInt(btn.closest('.knowledge-card').dataset.cardId);
                this.openCardModal(cardId);
            });
        });

        // Visibility buttons
        document.querySelectorAll('.visibility-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cardId = parseInt(btn.closest('.knowledge-card').dataset.cardId);
                this.toggleCardVisibility(cardId);
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cardId = parseInt(btn.closest('.knowledge-card').dataset.cardId);
                this.deleteCard(cardId);
            });
        });

        // Card click to expand
        document.querySelectorAll('.knowledge-card').forEach(card => {
            card.addEventListener('click', () => {
                const cardId = parseInt(card.dataset.cardId);
                this.openCardModal(cardId);
            });
        });
    }

    truncateContent(content, maxLength) {
        if (content.length <= maxLength) return content;
        
        // If content contains HTML tags, we need to be more careful
        if (content.includes('<') && content.includes('>')) {
            return this.truncateHtmlContent(content, maxLength);
        }
        
        // For plain text, simple truncation is fine
        return content.substring(0, maxLength) + '...';
    }

    truncateHtmlContent(content, maxLength) {
        // Strip HTML tags for length calculation and display
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        
        if (textContent.length <= maxLength) {
            return textContent;
        }
        
        // Truncate the text content and add ellipsis
        return textContent.substring(0, maxLength) + '...';
    }

    async openCardModal(cardId = null) {
        const modal = document.getElementById('knowledge-card-modal');
        const titleElement = document.getElementById('card-modal-title');
        const titleInput = document.getElementById('card-title');
        const contentInput = document.getElementById('card-content');
        const metadataDiv = document.getElementById('card-metadata');
        const previewDiv = document.getElementById('card-preview');
        const previewToggle = document.getElementById('preview-toggle');

        if (cardId) {
            // Edit existing card - default to preview mode
            const card = this.cards.find(c => c.id === cardId);
            if (!card) return;

            this.currentEditingCard = card;
            titleElement.textContent = 'View Knowledge Card';
            titleInput.value = card.title;
            contentInput.value = card.content;

            // Show metadata
            metadataDiv.style.display = 'block';
            document.getElementById('card-source').textContent = 
                card.source_consultant_name ? `${card.source_consultant_name} message` : 'User created';
            document.getElementById('card-created').textContent = utils.formatTime(card.created_at);
            document.getElementById('card-updated').textContent = utils.formatTime(card.updated_at);

            // Load existing tags for this card
            await this.loadCardTagsForModal(cardId);

            // Default to preview mode for existing cards
            await this.showPreviewMode();
        } else {
            // Create new card - start in edit mode
            this.currentEditingCard = { card_type: 'user_created' };
            titleElement.textContent = 'Create Knowledge Card';
            titleInput.value = '';
            contentInput.value = '';
            metadataDiv.style.display = 'none';

            // Clear tag selection for new card
            this.selectedCardTags = [];

            // Start in edit mode for new cards
            this.showEditMode();
        }

        // Render tag selector
        this.renderCardTagSelector();
        this.updateWordCount();
        modal.classList.add('active');
        
        // Focus appropriate element based on mode
        if (cardId) {
            // For existing cards in preview mode, don't focus anything initially
        } else {
            // For new cards, focus the title input
            titleInput.focus();
        }
    }

    async showPreviewMode() {
        const previewDiv = document.getElementById('card-preview');
        const contentTextarea = document.getElementById('card-content');
        const previewToggle = document.getElementById('preview-toggle');
        const titleElement = document.getElementById('card-modal-title');
        
        const content = contentTextarea.value;
        try {
            // Clear the preview div first to prevent DOM corruption
            previewDiv.innerHTML = '';
            
            // Use enhanced markdown renderer
            if (window.enhancedRenderer) {
                const renderedContent = await window.enhancedRenderer.render(content);
                // Create a temporary container to safely set the content
                const tempContainer = document.createElement('div');
                tempContainer.innerHTML = renderedContent;
                // Move all children to the preview div
                while (tempContainer.firstChild) {
                    previewDiv.appendChild(tempContainer.firstChild);
                }
            } else {
                // Fallback to basic marked
                marked.setOptions({
                    breaks: true,
                    gfm: true,
                    headerIds: false,
                    mangle: false,
                });
                previewDiv.innerHTML = marked.parse(content);
            }
        } catch (error) {
            console.error('Preview rendering error:', error);
            previewDiv.innerHTML = content.replace(/\n/g, '<br>');
        }
        
        previewDiv.style.display = 'block';
        contentTextarea.style.display = 'none';
        previewToggle.textContent = 'Edit';
        
        // Update modal title to indicate view mode
        if (this.currentEditingCard && this.currentEditingCard.id) {
            titleElement.textContent = 'View Knowledge Card';
        }
    }

    showEditMode() {
        const previewDiv = document.getElementById('card-preview');
        const contentTextarea = document.getElementById('card-content');
        const previewToggle = document.getElementById('preview-toggle');
        const titleElement = document.getElementById('card-modal-title');
        
        previewDiv.style.display = 'none';
        contentTextarea.style.display = 'block';
        previewToggle.textContent = 'Preview';
        
        // Update modal title to indicate edit mode
        if (this.currentEditingCard && this.currentEditingCard.id) {
            titleElement.textContent = 'Edit Knowledge Card';
        }
    }

    closeCardModal() {
        const modal = document.getElementById('knowledge-card-modal');
        modal.classList.remove('active');
        this.currentEditingCard = null;
        
        // Reset preview mode
        const previewDiv = document.getElementById('card-preview');
        const contentTextarea = document.getElementById('card-content');
        const previewToggle = document.getElementById('preview-toggle');
        
        previewDiv.style.display = 'none';
        contentTextarea.style.display = 'block';
        previewToggle.textContent = 'Preview';
    }

    async saveCard() {
        // Use the new method that handles tags
        await this.saveCardWithTags();
    }

    async autoSave() {
        if (!this.currentEditingCard || !this.currentEditingCard.id) return;

        const titleInput = document.getElementById('card-title');
        const contentInput = document.getElementById('card-content');
        
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();

        if (!title || !content) return;

        try {
            await api.updateKnowledgeBaseCard(this.currentEditingCard.id, {
                title,
                content
            });
            
            // Update local card
            const cardIndex = this.cards.findIndex(c => c.id === this.currentEditingCard.id);
            if (cardIndex !== -1) {
                this.cards[cardIndex].title = title;
                this.cards[cardIndex].content = content;
                this.cards[cardIndex].updated_at = new Date().toISOString();
            }

            // Show subtle save indicator
            const saveIndicator = document.createElement('span');
            saveIndicator.textContent = ' ✓ Saved';
            saveIndicator.style.color = '#059669';
            saveIndicator.style.fontSize = '0.8rem';
            
            const wordCount = document.getElementById('word-count');
            wordCount.appendChild(saveIndicator);
            
            setTimeout(() => {
                if (saveIndicator.parentNode) {
                    saveIndicator.remove();
                }
            }, 2000);

        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }

    async toggleCardVisibility(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        try {
            await api.toggleKnowledgeBaseCardVisibility({
                card_id: cardId,
                is_visible: !card.is_visible
            });

            card.is_visible = !card.is_visible;
            this.renderCards();
            
            // Update modal if it's open
            if (this.modalOpen) {
                this.filterAndRenderModalCards();
                this.updateModalStats();
            }

        } catch (error) {
            console.error('Error toggling card visibility:', error);
            utils.showError('Failed to update card visibility');
        }
    }

    async deleteCard(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        if (!confirm(`Are you sure you want to delete "${card.title}"? This action cannot be undone.`)) {
            return;
        }

        try {
            utils.showLoading();
            await api.deleteKnowledgeBaseCard(cardId);
            
            this.cards = this.cards.filter(c => c.id !== cardId);
            this.renderCards();
            
            utils.showSuccess('Card deleted successfully!');

        } catch (error) {
            console.error('Error deleting card:', error);
            utils.showError('Failed to delete card');
        } finally {
            utils.hideLoading();
        }
    }

    async togglePreview() {
        const previewDiv = document.getElementById('card-preview');
        
        if (previewDiv.style.display === 'none') {
            // Show preview mode
            await this.showPreviewMode();
        } else {
            // Show edit mode
            this.showEditMode();
        }
    }

    updateWordCount() {
        const contentTextarea = document.getElementById('card-content');
        const wordCount = document.getElementById('word-count');
        
        const content = contentTextarea.value.trim();
        const words = content ? content.split(/\s+/).length : 0;
        wordCount.textContent = `${words} words`;
    }

    enableAddCard() {
        const addCardBtn = document.getElementById('add-card-btn');
        addCardBtn.disabled = false;
    }

    disableAddCard() {
        const addCardBtn = document.getElementById('add-card-btn');
        addCardBtn.disabled = true;
    }

    async createCardFromMessage(messageId, messageContent, consultantName) {
        const symposium = symposiumManager.getCurrentSymposium();
        if (!symposium) return;

        // Generate a title from the first line or first 50 characters
        let title = messageContent.split('\n')[0];
        if (title.length > 50) {
            title = title.substring(0, 47) + '...';
        }
        if (!title.trim()) {
            title = `Response from ${consultantName}`;
        }

        try {
            utils.showLoading();
            
            const newCard = await api.createCardFromMessage({
                symposium_id: symposium.id,
                message_id: messageId,
                title: title
            });
            
            this.cards.unshift(newCard);
            this.renderCards();
            
            utils.showSuccess('Added to Knowledge Base!');

        } catch (error) {
            console.error('Error creating card from message:', error);
            utils.showError('Failed to add to Knowledge Base');
        } finally {
            utils.hideLoading();
        }
    }

    getCards() {
        return this.cards;
    }

    getVisibleCards() {
        return this.cards.filter(card => card.is_visible);
    }

    // Tag management methods
    async loadTags() {
        try {
            this.tags = await api.getTags();
            this.renderTagManagement();
        } catch (error) {
            console.error('Error loading tags:', error);
            utils.showError('Failed to load tags');
        }
    }

    renderTagManagement() {
        const container = document.getElementById('existing-tags');
        
        if (this.tags.length === 0) {
            container.innerHTML = '<p class="empty-state-small">No tags created yet</p>';
            return;
        }

        container.innerHTML = this.tags.map(tag => this.createTagHTML(tag)).join('');
        this.bindTagEvents();
    }

    createTagHTML(tag) {
        return `
            <div class="tag-item" data-tag-id="${tag.id}">
                <span class="tag-badge" style="background-color: ${tag.color}">
                    ${tag.name}
                </span>
                <div class="tag-controls">
                    <button class="tag-control-btn edit-tag-btn" title="Edit tag">✏️</button>
                    <button class="tag-control-btn delete-tag-btn" title="Delete tag">🗑️</button>
                </div>
            </div>
        `;
    }

    bindTagEvents() {
        // Edit tag buttons
        document.querySelectorAll('.edit-tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tagId = parseInt(btn.closest('.tag-item').dataset.tagId);
                this.handleEditTag(tagId);
            });
        });

        // Delete tag buttons
        document.querySelectorAll('.delete-tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tagId = parseInt(btn.closest('.tag-item').dataset.tagId);
                this.deleteTag(tagId);
            });
        });
    }

    async handleCreateTag() {
        const nameInput = document.getElementById('tag-name-input');
        const colorInput = document.getElementById('tag-color-input');
        
        const name = nameInput.value.trim();
        const color = colorInput.value;

        if (!name) {
            utils.showError('Please enter a tag name');
            nameInput.focus();
            return;
        }

        const newTag = await this.createTag(name, color);
        if (newTag) {
            // Clear inputs
            nameInput.value = '';
            colorInput.value = '#4f46e5';
            nameInput.focus();
        }
    }

    handleEditTag(tagId) {
        const tag = this.tags.find(t => t.id === tagId);
        if (!tag) return;

        const newName = prompt('Edit tag name:', tag.name);
        if (newName === null) return; // User cancelled
        
        if (!newName.trim()) {
            utils.showError('Tag name cannot be empty');
            return;
        }

        // For now, keep the same color. We could add a color picker modal later
        this.updateTag(tagId, newName.trim(), tag.color);
    }

    async createTag(name, color = '#4f46e5') {
        if (!name || name.trim() === '') {
            utils.showError('Tag name is required');
            return;
        }

        try {
            const newTag = await api.createTag({
                name: name.trim(),
                color: color
            });
            
            this.tags.push(newTag);
            this.renderTagManagement();
            this.dispatchTagsUpdated();
            utils.showSuccess('Tag created successfully!');
            
            return newTag;
        } catch (error) {
            console.error('Error creating tag:', error);
            utils.showError('Failed to create tag: ' + error.message);
        }
    }

    async updateTag(tagId, name, color) {
        try {
            const updatedTag = await api.updateTag(tagId, {
                name: name.trim(),
                color: color
            });
            
            const tagIndex = this.tags.findIndex(t => t.id === tagId);
            if (tagIndex !== -1) {
                this.tags[tagIndex] = updatedTag;
            }
            
            this.renderTagManagement();
            this.renderCards(); // Re-render cards to show updated tags
            this.dispatchTagsUpdated();
            utils.showSuccess('Tag updated successfully!');
            
            return updatedTag;
        } catch (error) {
            console.error('Error updating tag:', error);
            utils.showError('Failed to update tag: ' + error.message);
        }
    }

    async deleteTag(tagId) {
        const tag = this.tags.find(t => t.id === tagId);
        if (!tag) return;

        if (!confirm(`Are you sure you want to delete the tag "${tag.name}"? This will remove it from all cards.`)) {
            return;
        }

        try {
            await api.deleteTag(tagId);
            
            this.tags = this.tags.filter(t => t.id !== tagId);
            this.renderTagManagement();
            this.renderCards(); // Re-render cards to remove deleted tags
            this.dispatchTagsUpdated();
            utils.showSuccess('Tag deleted successfully!');
        } catch (error) {
            console.error('Error deleting tag:', error);
            utils.showError('Failed to delete tag: ' + error.message);
        }
    }

    async loadCardTags(cardId) {
        try {
            return await api.getCardTags(cardId);
        } catch (error) {
            console.error('Error loading card tags:', error);
            return [];
        }
    }

    async setCardTags(cardId, tagIds) {
        try {
            const updatedTags = await api.setCardTags(cardId, { tag_ids: tagIds });
            
            // Update local card data
            const card = this.cards.find(c => c.id === cardId);
            if (card) {
                card.tags = updatedTags;
            }
            
            this.renderCards();
            return updatedTags;
        } catch (error) {
            console.error('Error setting card tags:', error);
            utils.showError('Failed to update card tags');
            return [];
        }
    }

    getTags() {
        return this.tags;
    }

    getTagById(tagId) {
        return this.tags.find(t => t.id === tagId);
    }

    async getCardsByTags(tagIds) {
        if (!Array.isArray(tagIds) || tagIds.length === 0) {
            return [];
        }

        try {
            return await api.getCardsByTags({ tag_ids: tagIds });
        } catch (error) {
            console.error('Error getting cards by tags:', error);
            return [];
        }
    }

    // Card tag selector methods
    async loadCardTagsForModal(cardId) {
        try {
            const cardTags = await this.loadCardTags(cardId);
            this.selectedCardTags = cardTags.map(tag => tag.id);
        } catch (error) {
            console.error('Error loading card tags for modal:', error);
            this.selectedCardTags = [];
        }
    }

    renderCardTagSelector() {
        const container = document.getElementById('card-tag-grid');
        const previewContainer = document.getElementById('selected-tags-preview');
        
        if (this.tags.length === 0) {
            container.innerHTML = '<p class="no-tags-message">No tags available. Create tags first to assign them to cards.</p>';
            previewContainer.innerHTML = '';
            return;
        }

        // Render available tags
        container.innerHTML = this.tags.map(tag => this.createCardTagOptionHTML(tag)).join('');
        
        // Render selected tags preview
        this.renderSelectedTagsPreview();
        
        // Bind events
        this.bindCardTagEvents();
    }

    createCardTagOptionHTML(tag) {
        const isSelected = this.selectedCardTags && this.selectedCardTags.includes(tag.id);
        return `
            <div class="card-tag-option ${isSelected ? 'selected' : ''}" data-tag-id="${tag.id}">
                <span class="card-tag-option-badge" style="background-color: ${tag.color}">
                    ${tag.name}
                </span>
            </div>
        `;
    }

    renderSelectedTagsPreview() {
        const previewContainer = document.getElementById('selected-tags-preview');
        
        if (!this.selectedCardTags || this.selectedCardTags.length === 0) {
            previewContainer.innerHTML = '<p class="no-tags-message">No tags selected</p>';
            return;
        }

        const selectedTags = this.selectedCardTags.map(tagId => this.getTagById(tagId)).filter(Boolean);
        
        previewContainer.innerHTML = `
            <h5>Selected Tags (${selectedTags.length})</h5>
            <div class="selected-tags-list">
                ${selectedTags.map(tag => this.createSelectedTagHTML(tag)).join('')}
            </div>
        `;
    }

    createSelectedTagHTML(tag) {
        return `
            <div class="selected-tag-item">
                <span class="selected-tag-badge" style="background-color: ${tag.color}">
                    ${tag.name}
                </span>
                <button class="remove-selected-tag" data-tag-id="${tag.id}" title="Remove tag">×</button>
            </div>
        `;
    }

    bindCardTagEvents() {
        // Tag option click events
        document.querySelectorAll('.card-tag-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const tagId = parseInt(option.dataset.tagId);
                this.toggleCardTagSelection(tagId);
            });
        });

        // Remove tag events
        document.querySelectorAll('.remove-selected-tag').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tagId = parseInt(btn.dataset.tagId);
                this.toggleCardTagSelection(tagId);
            });
        });
    }

    toggleCardTagSelection(tagId) {
        if (!this.selectedCardTags) {
            this.selectedCardTags = [];
        }

        const index = this.selectedCardTags.indexOf(tagId);
        if (index > -1) {
            // Remove tag
            this.selectedCardTags.splice(index, 1);
        } else {
            // Add tag
            this.selectedCardTags.push(tagId);
        }

        // Re-render the tag selector
        this.renderCardTagSelector();
    }

    async saveCardWithTags() {
        const titleInput = document.getElementById('card-title');
        const contentInput = document.getElementById('card-content');
        
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();

        if (!title || !content) {
            utils.showError('Please fill in both title and content');
            return;
        }

        try {
            utils.showLoading();
            const symposium = symposiumManager.getCurrentSymposium();
            let cardId;

            if (this.currentEditingCard.id) {
                // Update existing card
                const updatedCard = await api.updateKnowledgeBaseCard(this.currentEditingCard.id, {
                    title,
                    content
                });
                
                cardId = this.currentEditingCard.id;
                
                // Update local card
                const cardIndex = this.cards.findIndex(c => c.id === cardId);
                if (cardIndex !== -1) {
                    this.cards[cardIndex] = { ...this.cards[cardIndex], ...updatedCard };
                }
            } else {
                // Create new card
                const newCard = await api.createKnowledgeBaseCard({
                    symposium_id: symposium.id,
                    title,
                    content,
                    card_type: 'user_created'
                });
                
                cardId = newCard.id;
                this.cards.unshift(newCard);
            }

            // Save tags if any are selected
            if (this.selectedCardTags && this.selectedCardTags.length > 0) {
                await this.setCardTags(cardId, this.selectedCardTags);
            } else if (this.currentEditingCard.id) {
                // Clear tags if none selected for existing card
                await this.setCardTags(cardId, []);
            }

            this.renderCards();
            
            // Update modal if it's open
            if (this.modalOpen) {
                this.filterAndRenderModalCards();
                this.updateModalStats();
            }
            
            this.closeCardModal();
            utils.showSuccess('Card saved successfully!');

        } catch (error) {
            console.error('Error saving card:', error);
            utils.showError('Failed to save card');
        } finally {
            utils.hideLoading();
        }
    }

    // Full Modal Methods
    bindModalEvents() {
        // Modal close events
        const modal = document.getElementById('knowledge-base-modal');
        const closeBtn = document.getElementById('kb-modal-close');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeFullModal();
            });
        }

        // Close on backdrop click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeFullModal();
                }
            });
        }

        // Search functionality
        const searchInput = document.getElementById('kb-search-input');
        const searchClear = document.getElementById('kb-search-clear');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.currentSearchTerm = e.target.value;
                this.filterAndRenderModalCards();
            });
        }

        if (searchClear) {
            searchClear.addEventListener('click', () => {
                searchInput.value = '';
                this.currentSearchTerm = '';
                this.filterAndRenderModalCards();
            });
        }

        // Sort functionality
        const sortSelect = document.getElementById('kb-modal-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.filterAndRenderModalCards();
            });
        }

        // View toggle
        const gridViewBtn = document.getElementById('kb-grid-view');
        const listViewBtn = document.getElementById('kb-list-view');
        
        if (gridViewBtn) {
            gridViewBtn.addEventListener('click', () => {
                this.currentView = 'grid';
                this.updateViewToggle();
                this.updateCardsContainerView();
            });
        }

        if (listViewBtn) {
            listViewBtn.addEventListener('click', () => {
                this.currentView = 'list';
                this.updateViewToggle();
                this.updateCardsContainerView();
            });
        }

        // Modal add card button
        const modalAddCardBtn = document.getElementById('kb-modal-add-card-btn');
        if (modalAddCardBtn) {
            modalAddCardBtn.addEventListener('click', () => {
                this.openCardModal();
            });
        }

        // Tag section toggle
        const tagToggle = document.getElementById('kb-toggle-tag-section');
        if (tagToggle) {
            tagToggle.addEventListener('click', () => {
                this.toggleModalTagSection();
            });
        }

        // Modal tag creation
        const modalCreateTagBtn = document.getElementById('kb-modal-create-tag');
        const modalTagNameInput = document.getElementById('kb-modal-tag-name');
        
        if (modalCreateTagBtn) {
            modalCreateTagBtn.addEventListener('click', () => {
                this.handleModalCreateTag();
            });
        }

        if (modalTagNameInput) {
            modalTagNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleModalCreateTag();
                }
            });
        }
    }

    openFullModal() {
        const modal = document.getElementById('knowledge-base-modal');
        if (!modal) return;

        this.modalOpen = true;
        modal.classList.add('active');
        
        // Initialize modal content
        this.renderModalTags();
        this.renderModalTagFilters();
        this.filterAndRenderModalCards();
        this.updateModalStats();
        
        // Focus search input
        const searchInput = document.getElementById('kb-search-input');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
    }

    closeFullModal() {
        const modal = document.getElementById('knowledge-base-modal');
        if (!modal) return;

        this.modalOpen = false;
        modal.classList.remove('active');
        
        // Reset modal state
        this.currentSearchTerm = '';
        this.selectedTagFilters = [];
        
        // Clear search input
        const searchInput = document.getElementById('kb-search-input');
        if (searchInput) {
            searchInput.value = '';
        }
    }

    renderModalTags() {
        const container = document.getElementById('kb-modal-existing-tags');
        if (!container) return;

        if (this.tags.length === 0) {
            container.innerHTML = '<p class="empty-state-small">No tags created yet</p>';
            return;
        }

        container.innerHTML = this.tags.map(tag => this.createModalTagHTML(tag)).join('');
        this.bindModalTagEvents();
    }

    createModalTagHTML(tag) {
        return `
            <div class="tag-item" data-tag-id="${tag.id}">
                <span class="tag-badge" style="background-color: ${tag.color}">
                    ${tag.name}
                </span>
                <div class="tag-controls">
                    <button class="tag-control-btn edit-tag-btn" title="Edit tag">✏️</button>
                    <button class="tag-control-btn delete-tag-btn" title="Delete tag">🗑️</button>
                </div>
            </div>
        `;
    }

    bindModalTagEvents() {
        // Edit tag buttons
        document.querySelectorAll('#kb-modal-existing-tags .edit-tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tagId = parseInt(btn.closest('.tag-item').dataset.tagId);
                this.handleEditTag(tagId);
            });
        });

        // Delete tag buttons
        document.querySelectorAll('#kb-modal-existing-tags .delete-tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tagId = parseInt(btn.closest('.tag-item').dataset.tagId);
                this.deleteTag(tagId);
            });
        });
    }

    renderModalTagFilters() {
        const container = document.getElementById('kb-modal-tag-filters');
        if (!container) return;

        if (this.tags.length === 0) {
            container.innerHTML = '<p class="empty-state-small">No tags available</p>';
            return;
        }

        container.innerHTML = this.tags.map(tag => this.createModalTagFilterHTML(tag)).join('');
        this.bindModalTagFilterEvents();
    }

    createModalTagFilterHTML(tag) {
        const isActive = this.selectedTagFilters.includes(tag.id);
        const cardCount = this.cards.filter(card => 
            card.tags && card.tags.some(cardTag => cardTag.id === tag.id)
        ).length;

        return `
            <div class="kb-tag-filter ${isActive ? 'active' : ''}" data-tag-id="${tag.id}">
                <span class="kb-tag-filter-badge" style="background-color: ${tag.color}">
                    ${tag.name}
                </span>
                <span class="tag-card-count">${cardCount}</span>
            </div>
        `;
    }

    bindModalTagFilterEvents() {
        document.querySelectorAll('.kb-tag-filter').forEach(filter => {
            filter.addEventListener('click', () => {
                const tagId = parseInt(filter.dataset.tagId);
                this.toggleTagFilter(tagId);
            });
        });
    }

    toggleTagFilter(tagId) {
        const index = this.selectedTagFilters.indexOf(tagId);
        if (index > -1) {
            this.selectedTagFilters.splice(index, 1);
        } else {
            this.selectedTagFilters.push(tagId);
        }
        
        this.renderModalTagFilters();
        this.filterAndRenderModalCards();
    }

    filterAndRenderModalCards() {
        let filteredCards = [...this.cards];

        // Apply search filter
        if (this.currentSearchTerm) {
            const searchTerm = this.currentSearchTerm.toLowerCase();
            filteredCards = filteredCards.filter(card =>
                card.title.toLowerCase().includes(searchTerm) ||
                card.content.toLowerCase().includes(searchTerm)
            );
        }

        // Apply tag filters - show cards that have ANY of the selected tags
        if (this.selectedTagFilters.length > 0) {
            filteredCards = filteredCards.filter(card => {
                // If card has no tags, don't show it when filters are active
                if (!card.tags || card.tags.length === 0) {
                    return false;
                }
                // Show card if it has any of the selected tags
                return card.tags.some(tag => 
                    this.selectedTagFilters.includes(tag.id)
                );
            });
        }

        // Apply sorting
        filteredCards.sort((a, b) => {
            switch (this.currentSort) {
                case 'updated_desc':
                    return new Date(b.updated_at) - new Date(a.updated_at);
                case 'created_desc':
                    return new Date(b.created_at) - new Date(a.created_at);
                case 'title_asc':
                    return a.title.localeCompare(b.title);
                case 'title_desc':
                    return b.title.localeCompare(a.title);
                default:
                    return 0;
            }
        });

        this.renderModalCards(filteredCards);
        this.updateModalStats(filteredCards.length);
    }

    renderModalCards(cards) {
        const container = document.getElementById('kb-modal-cards-container');
        if (!container) return;

        if (cards.length === 0) {
            container.innerHTML = `
                <div class="kb-modal-empty-state">
                    <div class="empty-state-icon">📚</div>
                    <h3>No cards found</h3>
                    <p>Try adjusting your search or filter criteria</p>
                </div>
            `;
            return;
        }

        container.innerHTML = cards.map(card => this.createModalCardHTML(card)).join('');
        this.bindModalCardEvents();
    }

    createModalCardHTML(card) {
        const isVisible = card.is_visible;
        const cardTypeIcon = card.card_type === 'consultant_response' ? '💬' : '📝';
        const sourceInfo = card.source_consultant_name ? 
            `From ${card.source_consultant_name}` : 
            'User created';

        const tagsHTML = card.tags && card.tags.length > 0 ? 
            `<div class="kb-modal-card-tags">
                ${card.tags.map(tag => 
                    `<span class="kb-modal-card-tag" style="background-color: ${tag.color}">${tag.name}</span>`
                ).join('')}
            </div>` : '';

        return `
            <div class="kb-modal-card ${isVisible ? '' : 'hidden'}" data-card-id="${card.id}">
                <div class="kb-modal-card-header">
                    <div class="kb-modal-card-type-icon">${cardTypeIcon}</div>
                    <div class="kb-modal-card-title-container">
                        <div class="kb-modal-card-title">${card.title}</div>
                        <div class="kb-modal-card-meta">${sourceInfo} • ${utils.formatTime(card.created_at)}</div>
                    </div>
                </div>
                <div class="kb-modal-card-content">
                    <div class="kb-modal-card-text">${card.content}</div>
                    ${tagsHTML}
                </div>
                <div class="kb-modal-card-footer">
                    <span class="kb-modal-card-source">${sourceInfo}</span>
                    <span class="kb-modal-card-date">${utils.formatTime(card.updated_at)}</span>
                </div>
                <div class="kb-modal-card-controls">
                    <button class="kb-modal-card-control-btn visibility-btn" title="${isVisible ? 'Hide from context' : 'Show in context'}">
                        ${isVisible ? '👁️' : '🚫'}
                    </button>
                    <button class="kb-modal-card-control-btn expand-btn" title="Edit card">✏️</button>
                    <button class="kb-modal-card-control-btn delete-btn" title="Delete card">🗑️</button>
                </div>
            </div>
        `;
    }

    bindModalCardEvents() {
        // Card click to edit
        document.querySelectorAll('.kb-modal-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on control buttons
                if (e.target.closest('.kb-modal-card-controls')) return;
                
                const cardId = parseInt(card.dataset.cardId);
                this.openCardModal(cardId);
            });
        });

        // Visibility buttons
        document.querySelectorAll('.kb-modal-card .visibility-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cardId = parseInt(btn.closest('.kb-modal-card').dataset.cardId);
                this.toggleCardVisibility(cardId);
            });
        });

        // Edit buttons
        document.querySelectorAll('.kb-modal-card .expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cardId = parseInt(btn.closest('.kb-modal-card').dataset.cardId);
                this.openCardModal(cardId);
            });
        });

        // Delete buttons
        document.querySelectorAll('.kb-modal-card .delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cardId = parseInt(btn.closest('.kb-modal-card').dataset.cardId);
                this.deleteCard(cardId);
            });
        });
    }

    updateViewToggle() {
        const gridBtn = document.getElementById('kb-grid-view');
        const listBtn = document.getElementById('kb-list-view');
        
        if (gridBtn && listBtn) {
            gridBtn.classList.toggle('active', this.currentView === 'grid');
            listBtn.classList.toggle('active', this.currentView === 'list');
        }
    }

    updateCardsContainerView() {
        const container = document.getElementById('kb-modal-cards-container');
        if (!container) return;

        container.classList.toggle('grid-view', this.currentView === 'grid');
        container.classList.toggle('list-view', this.currentView === 'list');
    }

    updateModalStats(visibleCount = null) {
        const cardsCountEl = document.getElementById('kb-cards-count');
        const visibleCountEl = document.getElementById('kb-visible-count');
        
        if (cardsCountEl) {
            cardsCountEl.textContent = `${this.cards.length} cards`;
        }
        
        if (visibleCountEl) {
            const count = visibleCount !== null ? visibleCount : this.cards.length;
            visibleCountEl.textContent = `${count} visible`;
        }
    }

    toggleModalTagSection() {
        const section = document.getElementById('kb-modal-tag-section');
        const toggle = document.getElementById('kb-toggle-tag-section');
        
        if (section && toggle) {
            section.classList.toggle('collapsed');
            toggle.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
        }
    }

    async handleModalCreateTag() {
        const nameInput = document.getElementById('kb-modal-tag-name');
        const colorInput = document.getElementById('kb-modal-tag-color');
        
        const name = nameInput.value.trim();
        const color = colorInput.value;

        if (!name) {
            utils.showError('Please enter a tag name');
            nameInput.focus();
            return;
        }

        const newTag = await this.createTag(name, color);
        if (newTag) {
            // Clear inputs
            nameInput.value = '';
            colorInput.value = '#4f46e5';
            nameInput.focus();
            
            // Update modal displays
            this.renderModalTags();
            this.renderModalTagFilters();
        }
    }

    // Override existing methods to update modal when needed
    async loadTags() {
        try {
            this.tags = await api.getTags();
            this.renderTagManagement();
            
            // Update modal if open
            if (this.modalOpen) {
                this.renderModalTags();
                this.renderModalTagFilters();
            }
        } catch (error) {
            console.error('Error loading tags:', error);
            utils.showError('Failed to load tags');
        }
    }

    async loadCards() {
        try {
            // Load global knowledge base cards (no symposium_id needed)
            this.cards = await api.getKnowledgeBaseCards();
            this.renderCards();
            
            // Update modal if open
            if (this.modalOpen) {
                this.filterAndRenderModalCards();
            }
        } catch (error) {
            console.error('Error loading cards:', error);
            alert('Failed to load cards: ' + error.message);
        }
    }
}

// Initialize knowledge base
window.knowledgeBase = new KnowledgeBase();
