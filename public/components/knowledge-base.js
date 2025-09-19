// Knowledge Base Component
class KnowledgeBase {
    constructor() {
        this.cards = [];
        this.currentEditingCard = null;
        this.init();
    }

    init() {
        this.bindEvents();
        
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

        // Add card button
        addCardBtn.addEventListener('click', () => {
            this.openCardModal();
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
        if (symposium) {
            await this.loadCards(symposium.id);
            this.enableAddCard();
        } else {
            this.cards = [];
            this.renderCards();
            this.disableAddCard();
        }
    }

    async loadCards(symposiumId) {
        try {
            this.cards = await api.getKnowledgeBaseCards(symposiumId);
            this.renderCards();
        } catch (error) {
            console.error('Error loading knowledge base cards:', error);
            utils.showError('Failed to load knowledge base cards');
        }
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

    openCardModal(cardId = null) {
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
        } else {
            // Create new card
            this.currentEditingCard = { card_type: 'user_created' };
            titleElement.textContent = 'Create Knowledge Card';
            titleInput.value = '';
            contentInput.value = '';
            metadataDiv.style.display = 'none';
        }

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

            if (this.currentEditingCard.id) {
                // Update existing card
                const updatedCard = await api.updateKnowledgeBaseCard(this.currentEditingCard.id, {
                    title,
                    content
                });
                
                // Update local card
                const cardIndex = this.cards.findIndex(c => c.id === this.currentEditingCard.id);
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
                
                this.cards.unshift(newCard);
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
}

// Initialize knowledge base
window.knowledgeBase = new KnowledgeBase();
