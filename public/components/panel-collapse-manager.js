// Panel Collapse Manager Component
class PanelCollapseManager {
    constructor() {
        this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        this.knowledgeBaseCollapsed = localStorage.getItem('knowledgeBaseCollapsed') === 'true';
        this.init();
    }

    init() {
        this.bindEvents();
        this.applyInitialState();
    }

    bindEvents() {
        // Sidebar collapse button
        document.getElementById('sidebar-collapse-btn').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Knowledge base collapse button
        document.getElementById('knowledge-base-collapse-btn').addEventListener('click', () => {
            this.toggleKnowledgeBase();
        });

        // Handle window resize to ensure proper layout
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    applyInitialState() {
        if (this.sidebarCollapsed) {
            this.collapseSidebar();
        }

        if (this.knowledgeBaseCollapsed) {
            this.collapseKnowledgeBase();
        }
    }

    toggleSidebar() {
        if (this.sidebarCollapsed) {
            this.expandSidebar();
        } else {
            this.collapseSidebar();
        }
    }

    toggleKnowledgeBase() {
        if (this.knowledgeBaseCollapsed) {
            this.expandKnowledgeBase();
        } else {
            this.collapseKnowledgeBase();
        }
    }

    collapseSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');

        sidebar.classList.add('collapsed');
        this.sidebarCollapsed = true;
        localStorage.setItem('sidebarCollapsed', 'true');

        // Adjust main content grid
        this.updateMainContentGrid();

        // Notify other components
        window.dispatchEvent(new CustomEvent('sidebarCollapsed', {
            detail: { collapsed: true }
        }));
    }

    expandSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');

        sidebar.classList.remove('collapsed');
        this.sidebarCollapsed = false;
        localStorage.setItem('sidebarCollapsed', 'false');

        // Adjust main content grid
        this.updateMainContentGrid();

        // Notify other components
        window.dispatchEvent(new CustomEvent('sidebarExpanded', {
            detail: { collapsed: false }
        }));
    }

    collapseKnowledgeBase() {
        const knowledgeBase = document.querySelector('.knowledge-base');
        const mainContent = document.querySelector('.main-content');

        knowledgeBase.classList.add('collapsed');
        this.knowledgeBaseCollapsed = true;
        localStorage.setItem('knowledgeBaseCollapsed', 'true');

        // Adjust main content grid
        this.updateMainContentGrid();

        // Notify other components
        window.dispatchEvent(new CustomEvent('knowledgeBaseCollapsed', {
            detail: { collapsed: true }
        }));
    }

    expandKnowledgeBase() {
        const knowledgeBase = document.querySelector('.knowledge-base');
        const mainContent = document.querySelector('.main-content');

        knowledgeBase.classList.remove('collapsed');
        this.knowledgeBaseCollapsed = false;
        localStorage.setItem('knowledgeBaseCollapsed', 'false');

        // Adjust main content grid
        this.updateMainContentGrid();

        // Notify other components
        window.dispatchEvent(new CustomEvent('knowledgeBaseExpanded', {
            detail: { collapsed: false }
        }));
    }

    updateMainContentGrid() {
        const mainContent = document.querySelector('.main-content');
        const sidebarCollapsed = this.sidebarCollapsed;
        const knowledgeBaseCollapsed = this.knowledgeBaseCollapsed;

        if (sidebarCollapsed && knowledgeBaseCollapsed) {
            // Both collapsed - maximize chat area
            mainContent.style.gridTemplateColumns = '60px 1fr 60px';
        } else if (sidebarCollapsed) {
            // Only sidebar collapsed
            mainContent.style.gridTemplateColumns = '60px 2fr 1fr';
        } else if (knowledgeBaseCollapsed) {
            // Only knowledge base collapsed
            mainContent.style.gridTemplateColumns = '1fr 2fr 60px';
        } else {
            // Neither collapsed - normal layout
            mainContent.style.gridTemplateColumns = '1fr 2fr 1fr';
        }
    }

    handleResize() {
        // Ensure layout is correct on resize
        this.updateMainContentGrid();
    }

    // Public methods for external use
    isSidebarCollapsed() {
        return this.sidebarCollapsed;
    }

    isKnowledgeBaseCollapsed() {
        return this.knowledgeBaseCollapsed;
    }
}

// Initialize panel collapse manager
window.panelCollapseManager = new PanelCollapseManager();
