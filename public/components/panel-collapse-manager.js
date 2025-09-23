// Panel Collapse Manager Component
class PanelCollapseManager {
    constructor() {
        this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        this.knowledgeBaseCollapsed = localStorage.getItem('knowledgeBaseCollapsed') === 'true';
        this.consultantTabsCollapsed = localStorage.getItem('consultantTabsCollapsed') === 'true';
        this.tagSelectorCollapsed = localStorage.getItem('tagSelectorCollapsed') === 'true';
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

        // Consultant tabs collapse toggle
        const consultantTabsToggle = document.querySelector('[data-section="consultant-tabs"] .collapse-toggle');
        if (consultantTabsToggle) {
            consultantTabsToggle.addEventListener('click', () => {
                this.toggleConsultantTabs();
            });
        }

        // Tag selector collapse toggle
        const tagSelectorToggle = document.querySelector('[data-section="tag-selector"] .collapse-toggle');
        if (tagSelectorToggle) {
            tagSelectorToggle.addEventListener('click', () => {
                this.toggleTagSelector();
            });
        }

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

        if (this.consultantTabsCollapsed) {
            this.collapseConsultantTabs();
        }

        if (this.tagSelectorCollapsed) {
            this.collapseTagSelector();
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

    toggleConsultantTabs() {
        if (this.consultantTabsCollapsed) {
            this.expandConsultantTabs();
        } else {
            this.collapseConsultantTabs();
        }
    }

    toggleTagSelector() {
        if (this.tagSelectorCollapsed) {
            this.expandTagSelector();
        } else {
            this.collapseTagSelector();
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

    collapseConsultantTabs() {
        const consultantTabsContainer = document.querySelector('.consultant-tabs-container.collapsible');

        if (consultantTabsContainer) {
            consultantTabsContainer.classList.add('collapsed');
            this.consultantTabsCollapsed = true;
            localStorage.setItem('consultantTabsCollapsed', 'true');
        }
    }

    expandConsultantTabs() {
        const consultantTabsContainer = document.querySelector('.consultant-tabs-container.collapsible');

        if (consultantTabsContainer) {
            consultantTabsContainer.classList.remove('collapsed');
            this.consultantTabsCollapsed = false;
            localStorage.setItem('consultantTabsCollapsed', 'false');
        }
    }

    collapseTagSelector() {
        const tagSelectorSection = document.querySelector('.tag-selector-section.collapsible');

        if (tagSelectorSection) {
            tagSelectorSection.classList.add('collapsed');
            this.tagSelectorCollapsed = true;
            localStorage.setItem('tagSelectorCollapsed', 'true');
        }
    }

    expandTagSelector() {
        const tagSelectorSection = document.querySelector('.tag-selector-section.collapsible');

        if (tagSelectorSection) {
            tagSelectorSection.classList.remove('collapsed');
            this.tagSelectorCollapsed = false;
            localStorage.setItem('tagSelectorCollapsed', 'false');
        }
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

    isConsultantTabsCollapsed() {
        return this.consultantTabsCollapsed;
    }

    isTagSelectorCollapsed() {
        return this.tagSelectorCollapsed;
    }
}

// Initialize panel collapse manager
window.panelCollapseManager = new PanelCollapseManager();
