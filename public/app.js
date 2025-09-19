// Main Application Entry Point
class SymposiumApp {
    constructor() {
        this.init();
    }

    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeApp();
            });
        } else {
            this.initializeApp();
        }
    }

    initializeApp() {
        console.log('🎭 Symposium App Initializing...');
        
        // All components are already initialized via their respective files
        // This file serves as the main entry point and can handle global app logic
        
        this.setupGlobalErrorHandling();
        this.setupKeyboardShortcuts();
        
        console.log('✅ Symposium App Ready!');
    }

    setupGlobalErrorHandling() {
        // Global error handler for unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            utils.showError('An unexpected error occurred. Please try again.');
            event.preventDefault();
        });

        // Global error handler for JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            // Don't show error popup for every JS error as it might be too intrusive
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Escape key to close modals
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal) {
                    activeModal.classList.remove('active');
                }
            }

            // Ctrl/Cmd + Enter to send message from anywhere
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const messageInput = document.getElementById('message-input');
                if (!messageInput.disabled && messageInput.value.trim()) {
                    chatInterface.sendMessage();
                }
            }

            // Ctrl/Cmd + N to create new symposium
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (symposiumManager) {
                    symposiumManager.showCreateModal();
                }
            }

            // Ctrl/Cmd + K to add consultant
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const symposium = symposiumManager?.getCurrentSymposium();
                if (symposium && consultantManager) {
                    consultantManager.showCreateModal();
                }
            }
        });
    }
}

// Initialize the app
const app = new SymposiumApp();

// Make app globally available for debugging
window.symposiumApp = app;

// Development helpers (only in development)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.dev = {
        // Helper functions for debugging
        getState() {
            return {
                symposium: symposiumManager?.getCurrentSymposium(),
                consultant: consultantManager?.getActiveConsultant(),
                consultants: consultantManager?.getConsultants(),
                messages: messageManager?.getMessages(),
                visibility: messageManager?.getMessageVisibility()
            };
        },
        
        clearData() {
            if (confirm('Clear all local data? This will refresh the page.')) {
                localStorage.clear();
                sessionStorage.clear();
                location.reload();
            }
        },
        
        exportData() {
            const data = this.getState();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `symposium-data-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };
    
    console.log('🔧 Development mode enabled. Use window.dev for debugging helpers.');
}
