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
        } catch (error) {
            console.error('Error creating tag:', error);
            alert('Failed to create tag: ' + error.message);
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
        return content.substring(0, maxLength) + '...';
    }

    async openCardModal(cardId = null) {
        const modal = document.getElementById('knowledge-card-modal');
        const titleElement = document.getElementById('card-modal-title');
        const titleInput = document.getElementById('card-title');
        const contentInput = document.getElementById('card-content');
        const metadataDiv = document.getElementById('card-metadata');

        if (cardId) {
            // Edit existing card
            const card = this.cards.find(c => c.id === cardId);
            if (!card) return;

            this.currentEditingCard = card;
            titleElement.textContent = 'Edit Knowledge Card';
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
        } else {
            // Create new card
            this.currentEditingCard = { card_type: 'user_created' };
            titleElement.textContent = 'Create Knowledge Card';
            titleInput.value = '';
            contentInput.value = '';
            metadataDiv.style.display = 'none';

            // Clear tag selection for new card
            this.selectedCardTags = [];
        }

        // Render tag selector
        this.renderCardTagSelector();
        this.updateWordCount();
        modal.classList.add('active');
        titleInput.focus();
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

    togglePreview() {
        const previewDiv = document.getElementById('card-preview');
        const contentTextarea = document.getElementById('card-content');
        const previewToggle = document.getElementById('preview-toggle');
        
        if (previewDiv.style.display === 'none') {
            // Show preview
            const content = contentTextarea.value;
            try {
                marked.setOptions({
                    breaks: true,
                    gfm: true,
                    headerIds: false,
                    mangle: false,
                });
                previewDiv.innerHTML = marked.parse(content);
            } catch (error) {
                previewDiv.innerHTML = content.replace(/\n/g, '<br>');
            }
            
            previewDiv.style.display = 'block';
            contentTextarea.style.display = 'none';
            previewToggle.textContent = 'Edit';
        } else {
            // Show editor
            previewDiv.style.display = 'none';
            contentTextarea.style.display = 'block';
            previewToggle.textContent = 'Preview';
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
            this.closeCardModal();
            utils.showSuccess('Card saved successfully!');

        } catch (error) {
            console.error('Error saving card:', error);
            utils.showError('Failed to save card');
        } finally {
            utils.hideLoading();
        }
    }
}

// Initialize knowledge base
window.knowledgeBase = new KnowledgeBase();
