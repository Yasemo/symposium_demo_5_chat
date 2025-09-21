// Chat Interface Component
class ChatInterface {
    constructor() {
        this.isProcessing = false;
        this.init();
    }

    init() {
        this.bindEvents();
        
        // Listen for symposium and consultant changes
        window.addEventListener('symposiumChanged', (e) => {
            this.onSymposiumChanged(e.detail);
        });

        window.addEventListener('consultantChanged', (e) => {
            this.onConsultantChanged(e.detail);
        });

        window.addEventListener('objectiveChanged', (e) => {
            this.onObjectiveChanged(e.detail);
        });
    }

    bindEvents() {
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        const clearChatBtn = document.getElementById('clear-chat-btn');

        // Send button click
        sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        // Clear chat button click
        clearChatBtn.addEventListener('click', () => {
            this.clearChat();
        });

        // Enter key to send (Shift+Enter for new line)
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        messageInput.addEventListener('input', () => {
            this.autoResizeTextarea(messageInput);
        });
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }

    async onSymposiumChanged(symposium) {
        if (symposium) {
            // Wait for objectives to be loaded, then load messages for active objective
            this.loadMessagesForCurrentContext();
        } else {
            this.showWelcomeMessage();
            this.disableInput();
        }
    }

    onConsultantChanged(consultant) {
        if (consultant) {
            // Check if this is an API consultant that should use form interface
            if (this.isApiConsultant(consultant)) {
                // Form interface will handle this consultant
                this.disableInput();
            } else {
                // Standard chat interface
                this.enableInput();
            }
        } else {
            this.disableInput();
        }
        
        // Update message visibility indicators
        setTimeout(() => {
            messageManager.updateVisibilityIndicators();
        }, 100);
    }

    isApiConsultant(consultant) {
        // Check if consultant requires form interface
        return consultant.consultant_type !== 'standard' && consultant.consultant_type !== 'pure_llm';
    }

    async onObjectiveChanged(objective) {
        // Load messages for the new objective
        await this.loadMessagesForCurrentContext();
    }

    async loadMessagesForCurrentContext() {
        const symposium = symposiumManager.getCurrentSymposium();
        const objective = objectiveManager?.getActiveObjective();
        
        if (symposium) {
            // Load messages for the current objective (or all if no objective selected)
            await messageManager.loadMessages(symposium.id, objective?.id);
            this.loadMessages();
        }
    }

    async loadMessages() {
        const messages = messageManager.getMessages();
        this.renderMessages(messages);
    }

    renderMessages(messages) {
        const chatContainer = document.getElementById('chat-messages');
        
        if (messages.length === 0) {
            chatContainer.innerHTML = `
                <div class="welcome-message">
                    <h2>Start Your Symposium</h2>
                    <p>Add consultants and begin your collaborative conversation.</p>
                </div>
            `;
            return;
        }

        chatContainer.innerHTML = messages.map(message => this.createMessageHTML(message)).join('');
        
        // Bind visibility toggle events
        messageManager.bindVisibilityToggleEvents();
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    createMessageHTML(message) {
        const isUser = message.is_user;
        const author = isUser ? 'You' : (message.consultant_name || 'Assistant');
        const avatarText = isUser ? 'U' : (message.consultant_name ? message.consultant_name[0].toUpperCase() : 'A');
        const time = utils.formatTime(message.timestamp);
        const visibilityToggle = messageManager.createVisibilityToggle(message.id);
        const colorClass = isUser ? '' : this.getConsultantColorClass(message.consultant_id);
        
        // Add "Add to Knowledge Base" button for consultant messages
        const knowledgeBaseButton = !isUser ? 
            `<button class="add-to-kb-btn" data-message-id="${message.id}" title="Add to Knowledge Base">📚</button>` : '';

        // Add edit and delete buttons for all messages
        const editButton = `<button class="edit-message-btn" data-message-id="${message.id}" title="Edit message">✏️</button>`;
        const deleteButton = `<button class="delete-message-btn" data-message-id="${message.id}" title="Delete message">🗑️</button>`;
        
        // Show "edited" indicator if message was edited
        const editedIndicator = message.updated_at ? '<span class="edited-indicator" title="This message was edited">(edited)</span>' : '';

        return `
            <div class="message ${isUser ? 'user' : 'assistant'}" data-message-id="${message.id}">
                <div class="message-avatar ${colorClass}">${avatarText}</div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-author">${author}</span>
                        <span class="message-time">${time} ${editedIndicator}</span>
                    </div>
                    <div class="message-text" data-message-id="${message.id}">${this.formatMessageText(message.content)}</div>
                    <div class="message-controls">
                        ${visibilityToggle}
                        ${knowledgeBaseButton}
                        ${editButton}
                        ${deleteButton}
                    </div>
                </div>
            </div>
        `;
    }

    formatMessageText(text) {
        // Render markdown using marked library
        try {
            // Configure marked for security and GitHub-like rendering
            marked.setOptions({
                breaks: true, // Convert line breaks to <br>
                gfm: true, // GitHub Flavored Markdown
                headerIds: false, // Don't add IDs to headers
                mangle: false, // Don't mangle email addresses
            });

            // Render markdown and sanitize (marked is generally safe, but being extra careful)
            const rendered = marked.parse(text);

            // Add some basic sanitization for common XSS vectors
            return rendered.replace(/<script[^>]*>.*?<\/script>/gi, '')
                          .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
                          .replace(/javascript:/gi, '');
        } catch (error) {
            console.error('Error rendering markdown:', error);
            // Fallback to plain text with line breaks
            return text.replace(/\n/g, '<br>');
        }
    }

    async sendMessage() {
        if (this.isProcessing) return;

        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();
        
        if (!message) return;

        const symposium = symposiumManager.getCurrentSymposium();
        const consultant = consultantManager.getActiveConsultant();

        if (!symposium || !consultant) {
            utils.showError('Please select a symposium and consultant first');
            return;
        }

        try {
            this.isProcessing = true;
            this.disableInput();

            // Clear input immediately
            messageInput.value = '';
            this.autoResizeTextarea(messageInput);

            // Add user message immediately to chat
            const userMessage = {
                id: Date.now(), // Temporary ID
                content: message,
                is_user: true,
                timestamp: new Date().toISOString(),
                consultant_name: null
            };
            this.addMessageToChat(userMessage);

            // Show typing bubble
            this.showTypingBubble(consultant.name);

            // Get current objective
            const objective = objectiveManager?.getActiveObjective();
            
            // Send message to API
            const response = await api.sendMessage({
                symposium_id: symposium.id,
                consultant_id: consultant.id,
                objective_id: objective?.id,
                message: message
            });

            // Remove typing bubble
            this.hideTypingBubble();

            // Add messages to message manager (replace temporary user message)
            messageManager.addMessage(response.userMessage);
            messageManager.addMessage(response.assistantMessage);

            // Re-render messages
            this.loadMessages();

        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingBubble();
            utils.showError('Failed to send message: ' + error.message);
            
            // Restore message in input on error
            messageInput.value = message;
            this.autoResizeTextarea(messageInput);
            
        } finally {
            this.isProcessing = false;
            this.enableInput();
        }
    }

    enableInput() {
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        const consultant = consultantManager.getActiveConsultant();
        
        if (consultant) {
            messageInput.disabled = false;
            sendBtn.disabled = false;
            messageInput.placeholder = `Message ${consultant.name}...`;
            messageInput.focus();
        }
    }

    disableInput() {
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        
        messageInput.disabled = true;
        sendBtn.disabled = true;
        messageInput.placeholder = 'Select a consultant to start chatting...';
    }

    showWelcomeMessage() {
        const chatContainer = document.getElementById('chat-messages');
        chatContainer.innerHTML = `
            <div class="welcome-message">
                <h2>Welcome to Symposium</h2>
                <p>Create a symposium and add consultants to start your collaborative conversation.</p>
            </div>
        `;
    }

    scrollToBottom() {
        const chatContainer = document.getElementById('chat-messages');
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    addMessage(message) {
        const chatContainer = document.getElementById('chat-messages');
        
        // Remove welcome message if it exists
        const welcomeMessage = chatContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        // Add new message
        const messageHTML = this.createMessageHTML(message);
        chatContainer.insertAdjacentHTML('beforeend', messageHTML);
        
        // Bind events for new message
        messageManager.bindVisibilityToggleEvents();
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    addMessageToChat(message) {
        const chatContainer = document.getElementById('chat-messages');
        
        // Remove welcome message if it exists
        const welcomeMessage = chatContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        // Add new message without visibility controls (for temporary messages)
        const isUser = message.is_user;
        const author = isUser ? 'You' : (message.consultant_name || 'Assistant');
        const avatarText = isUser ? 'U' : (message.consultant_name ? message.consultant_name[0].toUpperCase() : 'A');
        const time = utils.formatTime(message.timestamp);

        const messageHTML = `
            <div class="message ${isUser ? 'user' : 'assistant'}" data-message-id="${message.id}">
                <div class="message-avatar">${avatarText}</div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-author">${author}</span>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-text">${this.formatMessageText(message.content)}</div>
                </div>
            </div>
        `;
        
        chatContainer.insertAdjacentHTML('beforeend', messageHTML);
        this.scrollToBottom();
    }

    showTypingBubble(consultantName) {
        const chatContainer = document.getElementById('chat-messages');
        const avatarText = consultantName ? consultantName[0].toUpperCase() : 'A';
        
        const typingBubble = `
            <div class="message assistant typing-bubble" id="typing-bubble">
                <div class="message-avatar">${avatarText}</div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-author">${consultantName}</span>
                        <span class="message-time">typing...</span>
                    </div>
                    <div class="typing-indicator">
                        <div class="typing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        chatContainer.insertAdjacentHTML('beforeend', typingBubble);
        this.scrollToBottom();
    }

    hideTypingBubble() {
        const typingBubble = document.getElementById('typing-bubble');
        if (typingBubble) {
            typingBubble.remove();
        }
    }

    async clearChat() {
        const symposium = symposiumManager.getCurrentSymposium();
        if (!symposium) {
            utils.showError('No symposium selected');
            return;
        }

        if (!confirm('Are you sure you want to clear all chat history? This action cannot be undone.')) {
            return;
        }

        try {
            utils.showLoading();
            
            // Call API to clear messages
            await api.clearMessages(symposium.id);
            
            // Clear local message manager
            messageManager.clearMessages();
            
            // Show welcome message
            this.showWelcomeMessage();
            
            utils.showSuccess('Chat history cleared successfully!');
            
        } catch (error) {
            console.error('Error clearing chat:', error);
            utils.showError('Failed to clear chat history');
        } finally {
            utils.hideLoading();
        }
    }

    getConsultantColorClass(consultantId) {
        if (!consultantId) return '';
        
        // Get all consultants to determine the index
        const consultants = consultantManager.getConsultants();
        const consultantIndex = consultants.findIndex(c => c.id === consultantId);
        
        if (consultantIndex === -1) return '';
        
        // Return color class based on index (1-indexed for CSS classes)
        return `consultant-${(consultantIndex % 10) + 1}`;
    }
}

// Initialize chat interface
window.chatInterface = new ChatInterface();
