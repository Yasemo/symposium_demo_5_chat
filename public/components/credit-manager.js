// Credit Manager Component
class CreditManager {
    constructor() {
        this.credits = null;
        this.isLoading = false;
        this.error = null;
        this.refreshInterval = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadCredits();
        this.startAutoRefresh();
    }

    bindEvents() {
        // Listen for credit display clicks to refresh
        const creditDisplay = document.getElementById('credit-display');
        if (creditDisplay) {
            creditDisplay.addEventListener('click', () => {
                this.loadCredits();
            });
        }
    }

    async loadCredits() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.error = null;
        this.updateDisplay();

        try {
            const response = await api.getAuth();
            this.totalCredits = response.total_credits || 0;
            this.totalUsage = response.total_usage || 0;
            this.remainingCredits = response.remaining_credits || 0;
            this.isFreeTier = response.is_free_tier || false;
            this.error = null;
        } catch (error) {
            console.error('Error loading credits:', error);
            this.error = error.message;
            this.totalCredits = null;
            this.totalUsage = null;
            this.remainingCredits = null;
        } finally {
            this.isLoading = false;
            this.updateDisplay();
        }
    }

    startAutoRefresh() {
        // Refresh credits every 5 minutes
        this.refreshInterval = setInterval(() => {
            this.loadCredits();
        }, 5 * 60 * 1000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    updateDisplay() {
        const creditAmount = document.querySelector('.credit-amount');
        if (!creditAmount) return;

        if (this.isLoading) {
            creditAmount.textContent = 'Loading...';
            creditAmount.className = 'credit-amount loading';
            return;
        }

        if (this.error) {
            creditAmount.textContent = 'Error';
            creditAmount.className = 'credit-amount error';
            creditAmount.title = this.error;
            return;
        }

        if (this.remainingCredits !== null && this.remainingCredits !== undefined) {
            // Handle free tier accounts
            if (this.isFreeTier) {
                creditAmount.textContent = 'Free Tier';
                creditAmount.className = 'credit-amount success';
                creditAmount.title = 'Free Tier Account - No credit limit';
                return;
            }

            const formattedCredits = this.formatCredits(this.remainingCredits);
            creditAmount.textContent = formattedCredits;
            creditAmount.className = 'credit-amount success';

            // Add tooltip with more details
            let tooltip = `Remaining: $${this.remainingCredits.toFixed(4)}`;
            if (this.totalCredits > 0) {
                tooltip += `\nTotal Credits: $${this.totalCredits.toFixed(4)}`;
            }
            if (this.totalUsage > 0) {
                tooltip += `\nTotal Usage: $${this.totalUsage.toFixed(4)}`;
            }
            creditAmount.title = tooltip;
        } else {
            creditAmount.textContent = 'N/A';
            creditAmount.className = 'credit-amount';
            creditAmount.title = 'Credit information not available for this account';
        }
    }

    formatCredits(credits) {
        if (credits === 0) return '$0.00';

        // Format as currency
        if (credits >= 1) {
            return `$${credits.toFixed(2)}`;
        } else if (credits >= 0.01) {
            return `$${credits.toFixed(4)}`;
        } else {
            return `< $0.01`;
        }
    }

    getCredits() {
        return this.credits;
    }

    getUsage() {
        return this.usage;
    }

    getLimit() {
        return this.limit;
    }

    isFreeTier() {
        return this.isFreeTier;
    }

    hasError() {
        return this.error !== null;
    }

    destroy() {
        this.stopAutoRefresh();
    }
}

// Initialize credit manager
window.creditManager = new CreditManager();
