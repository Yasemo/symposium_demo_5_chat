// Objective Manager Component
class ObjectiveManager {
    constructor() {
        this.objectives = [];
        this.activeObjective = null;
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
        // We'll add event bindings when we update the HTML structure
    }

    async onSymposiumChanged(symposium) {
        if (symposium) {
            await this.loadObjectives(symposium.id);
        } else {
            this.objectives = [];
            this.activeObjective = null;
            this.updateUI();
        }
    }

    async loadObjectives(symposiumId) {
        try {
            this.objectives = await api.getObjectives(symposiumId);
            this.updateUI();
            
            // Auto-select first objective if available
            if (this.objectives.length > 0 && !this.activeObjective) {
                this.setActiveObjective(this.objectives[0]);
            }
        } catch (error) {
            console.error('Error loading objectives:', error);
            utils.showError('Failed to load objectives');
        }
    }

    setActiveObjective(objective) {
        this.activeObjective = objective;
        this.updateUI();
        
        // Notify other components
        window.dispatchEvent(new CustomEvent('objectiveChanged', {
            detail: objective
        }));
    }

    updateUI() {
        this.updateObjectivesList();
        this.updateActiveObjective();
    }

    updateObjectivesList() {
        const listContainer = document.getElementById('objectives-list');
        
        if (!listContainer) {
            // Container doesn't exist yet, will be created when we update HTML
            return;
        }
        
        if (this.objectives.length === 0) {
            listContainer.innerHTML = '<p class="empty-state">No objectives yet</p>';
            return;
        }

        listContainer.innerHTML = this.objectives.map(objective => `
            <div class="objective-item ${this.activeObjective?.id === objective.id ? 'active' : ''}" 
                 data-objective-id="${objective.id}">
                <div class="objective-info">
                    <div class="objective-title">${objective.title}</div>
                    <div class="objective-description">${this.truncateText(objective.description, 60)}</div>
                </div>
            </div>
        `).join('');

        // Bind click events for objective selection
        listContainer.querySelectorAll('.objective-item').forEach(item => {
            item.addEventListener('click', () => {
                const objectiveId = parseInt(item.dataset.objectiveId);
                const objective = this.objectives.find(o => o.id === objectiveId);
                if (objective) {
                    this.setActiveObjective(objective);
                }
            });
        });
    }

    async updateActiveObjective() {
        const container = document.getElementById('active-objective');
        
        if (!container) {
            // Container doesn't exist yet
            return;
        }
        
        if (!this.activeObjective) {
            container.innerHTML = '<p class="empty-state">Select an objective</p>';
            return;
        }

        // Load tasks for the active objective
        try {
            const tasks = await api.getObjectiveTasks(this.activeObjective.id);
            
            const completedTasks = tasks.filter(task => task.is_completed).length;
            const totalTasks = tasks.length;
            const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            container.innerHTML = `
                <div class="objective-details">
                    <h4>${this.activeObjective.title}</h4>
                    <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #6b7280; margin-bottom: 1rem;">
                        ${this.activeObjective.description}
                    </p>
                    
                    ${tasks.length > 0 ? `
                        <div class="objective-progress">
                            <div class="progress-indicator">
                                <span class="progress-text">${completedTasks}/${totalTasks} tasks</span>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="objective-tasks" id="objective-tasks-list">
                            ${tasks.map((task, index) => `
                                <div class="objective-task-item ${task.is_completed ? 'completed' : ''}" 
                                     data-task-id="${task.id}" data-order-index="${task.order_index || index}" draggable="true">
                                    <div class="task-header">
                                        <div class="task-number">${(task.order_index !== undefined ? task.order_index : index) + 1}</div>
                                        <div class="task-checkbox-container">
                                            <input type="checkbox" class="objective-task-checkbox" 
                                                   ${task.is_completed ? 'checked' : ''} 
                                                   data-task-id="${task.id}">
                                        </div>
                                        <div class="task-controls">
                                            <button class="task-control-btn edit-objective-task-btn" 
                                                    data-task-id="${task.id}" title="Edit task">✏️</button>
                                            <button class="task-control-btn delete-objective-task-btn" 
                                                    data-task-id="${task.id}" title="Delete task">🗑️</button>
                                            <button class="task-control-btn drag-handle" title="Drag to reorder">⋮⋮</button>
                                        </div>
                                    </div>
                                    <div class="task-content">
                                        <div class="task-title">${task.title}</div>
                                        ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div class="objective-task-actions">
                            <button class="btn btn-secondary btn-small" id="add-objective-task-btn">+ Add Task</button>
                        </div>
                    ` : '<p class="empty-state">No tasks for this objective</p>'}
                </div>
            `;
            
            // Bind event handlers for the objective tasks
            this.bindObjectiveTaskEvents();
            
        } catch (error) {
            console.error('Error loading objective tasks:', error);
            container.innerHTML = `
                <div class="objective-details">
                    <h4>${this.activeObjective.title}</h4>
                    <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #6b7280;">
                        ${this.activeObjective.description}
                    </p>
                    <p class="empty-state" style="color: #dc2626;">Failed to load tasks</p>
                </div>
            `;
        }
    }

    bindObjectiveTaskEvents() {
        // Task completion checkboxes
        document.querySelectorAll('.objective-task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const taskId = parseInt(e.target.dataset.taskId);
                this.toggleObjectiveTaskCompletion(taskId, e.target.checked);
            });
        });

        // Edit task buttons
        document.querySelectorAll('.edit-objective-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = parseInt(e.target.dataset.taskId);
                this.editObjectiveTask(taskId);
            });
        });

        // Delete task buttons
        document.querySelectorAll('.delete-objective-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = parseInt(e.target.dataset.taskId);
                this.deleteObjectiveTask(taskId);
            });
        });

        // Add task button
        const addTaskBtn = document.getElementById('add-objective-task-btn');
        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', () => {
                this.showObjectiveTaskModal();
            });
        }

        // Setup drag and drop for task reordering
        this.setupObjectiveTaskDragAndDrop();
    }

    async toggleObjectiveTaskCompletion(taskId, isCompleted) {
        console.log('Toggling task completion:', { taskId, isCompleted, taskIdType: typeof taskId });
        
        // Validate taskId
        if (!taskId || isNaN(taskId)) {
            console.error('Invalid task ID:', taskId);
            utils.showError('Invalid task ID');
            return;
        }
        
        try {
            await api.updateObjectiveTask(taskId, { is_completed: isCompleted });
            
            // Refresh the active objective display
            await this.updateActiveObjective();
            
        } catch (error) {
            console.error('Error updating objective task:', error);
            utils.showError('Failed to update task');
            
            // Revert checkbox state - be more specific with selector
            const checkbox = document.querySelector(`.objective-task-checkbox[data-task-id="${taskId}"]`);
            if (checkbox) {
                checkbox.checked = !isCompleted;
            }
        }
    }

    async editObjectiveTask(taskId) {
        try {
            const tasks = await api.getObjectiveTasks(this.activeObjective.id);
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                this.showObjectiveTaskModal(task);
            }
        } catch (error) {
            console.error('Error loading task for editing:', error);
            utils.showError('Failed to load task');
        }
    }

    async deleteObjectiveTask(taskId) {
        try {
            const tasks = await api.getObjectiveTasks(this.activeObjective.id);
            const task = tasks.find(t => t.id === taskId);
            
            if (!task) return;

            if (!confirm(`Are you sure you want to delete "${task.title}"? This action cannot be undone.`)) {
                return;
            }

            utils.showLoading();
            await api.deleteObjectiveTask(taskId);
            
            // Refresh the active objective display
            await this.updateActiveObjective();
            
            utils.showSuccess('Task deleted successfully!');

        } catch (error) {
            console.error('Error deleting objective task:', error);
            utils.showError('Failed to delete task');
        } finally {
            utils.hideLoading();
        }
    }

    showObjectiveTaskModal(task = null) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('objective-task-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'objective-task-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="objective-task-modal-title">Add Task</h2>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="objective-task-form">
                            <div class="form-group">
                                <label for="objective-task-title">Task Title</label>
                                <input type="text" id="objective-task-title" required>
                            </div>
                            <div class="form-group">
                                <label for="objective-task-description">Description (optional)</label>
                                <textarea id="objective-task-description" rows="3"></textarea>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" id="cancel-objective-task">Cancel</button>
                                <button type="submit" class="btn btn-primary">Save Task</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Bind modal events
            const form = modal.querySelector('#objective-task-form');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveObjectiveTask();
            });
            modal.querySelector('.close-btn').addEventListener('click', () => {
                this.hideObjectiveTaskModal();
            });
            modal.querySelector('#cancel-objective-task').addEventListener('click', () => {
                this.hideObjectiveTaskModal();
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideObjectiveTaskModal();
                }
            });
        }

        // Populate form if editing
        const titleInput = modal.querySelector('#objective-task-title');
        const descriptionInput = modal.querySelector('#objective-task-description');
        const modalTitle = modal.querySelector('#objective-task-modal-title');

        if (task) {
            modalTitle.textContent = 'Edit Task';
            titleInput.value = task.title;
            descriptionInput.value = task.description || '';
            this.editingObjectiveTask = task;
        } else {
            modalTitle.textContent = 'Add Task';
            titleInput.value = '';
            descriptionInput.value = '';
            this.editingObjectiveTask = null;
        }

        modal.classList.add('active');
        titleInput.focus();
    }

    hideObjectiveTaskModal() {
        const modal = document.getElementById('objective-task-modal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.editingObjectiveTask = null;
    }

    async saveObjectiveTask() {
        const titleInput = document.getElementById('objective-task-title');
        const descriptionInput = document.getElementById('objective-task-description');
        
        const title = titleInput.value.trim();
        const description = descriptionInput.value.trim();

        if (!title) {
            utils.showError('Please enter a task title');
            return;
        }

        try {
            utils.showLoading();

            if (this.editingObjectiveTask) {
                // Update existing task
                await api.updateObjectiveTask(this.editingObjectiveTask.id, {
                    title,
                    description: description || null
                });
            } else {
                // Create new task
                await api.createObjectiveTask({
                    objective_id: this.activeObjective.id,
                    title,
                    description: description || null
                });
            }

            // Refresh the active objective display
            await this.updateActiveObjective();
            
            this.hideObjectiveTaskModal();
            utils.showSuccess('Task saved successfully!');

        } catch (error) {
            console.error('Error saving objective task:', error);
            utils.showError('Failed to save task');
        } finally {
            utils.hideLoading();
        }
    }

    setupObjectiveTaskDragAndDrop() {
        const tasksList = document.getElementById('objective-tasks-list');
        if (!tasksList) return;

        let draggedElement = null;
        let draggedIndex = null;

        // Add drag event listeners to all task items
        document.querySelectorAll('.objective-task-item').forEach((item, index) => {
            item.addEventListener('dragstart', (e) => {
                draggedElement = item;
                draggedIndex = index;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
                draggedElement = null;
                draggedIndex = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                if (draggedElement && draggedElement !== item) {
                    const dropIndex = Array.from(tasksList.children).indexOf(item);
                    this.reorderObjectiveTasks(draggedIndex, dropIndex);
                }
            });
        });

        // Add visual feedback for drag over
        tasksList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(tasksList, e.clientY);
            const dragging = document.querySelector('.dragging');
            
            if (afterElement == null) {
                tasksList.appendChild(dragging);
            } else {
                tasksList.insertBefore(dragging, afterElement);
            }
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.objective-task-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    async reorderObjectiveTasks(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;

        try {
            // Get current tasks
            const tasks = await api.getObjectiveTasks(this.activeObjective.id);
            
            // Reorder tasks locally
            const movedTask = tasks.splice(fromIndex, 1)[0];
            tasks.splice(toIndex, 0, movedTask);

            // Immediately update the UI with new task numbers
            this.updateTaskNumbers(tasks);

            // Update order_index for all tasks
            const taskOrders = tasks.map((task, index) => ({
                task_id: task.id,
                order_index: index
            }));

            // Send reorder request to server
            await api.reorderObjectiveTasks({
                objective_id: this.activeObjective.id,
                task_orders: taskOrders
            });

            console.log('Task reordering completed successfully');

        } catch (error) {
            console.error('Error reordering objective tasks:', error);
            utils.showError('Failed to reorder tasks');
            // Refresh to restore original order
            await this.updateActiveObjective();
        }
    }

    updateTaskNumbers(tasks) {
        // Update task numbers immediately in the UI
        const taskItems = document.querySelectorAll('.objective-task-item');
        taskItems.forEach((item, index) => {
            const taskNumber = item.querySelector('.task-number');
            if (taskNumber) {
                taskNumber.textContent = index + 1;
            }
            // Update the data attribute as well
            item.setAttribute('data-order-index', index);
        });
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    getActiveObjective() {
        return this.activeObjective;
    }

    getObjectives() {
        return this.objectives;
    }

    async createObjectivesFromStructure(symposiumId, objectives) {
        try {
            utils.showLoading();
            
            const createdObjectives = [];
            
            // Create objectives and their tasks
            for (let i = 0; i < objectives.length; i++) {
                const objectiveData = objectives[i];
                
                // Create objective
                const objective = await api.createObjective({
                    symposium_id: symposiumId,
                    title: objectiveData.title,
                    description: objectiveData.description,
                    order_index: i
                });
                
                createdObjectives.push(objective);
                
                // Create tasks for this objective
                for (let j = 0; j < objectiveData.tasks.length; j++) {
                    const taskData = objectiveData.tasks[j];
                    await api.createObjectiveTask({
                        objective_id: objective.id,
                        title: taskData.title,
                        description: taskData.description,
                        order_index: j
                    });
                }
            }
            
            // Reload objectives
            this.objectives = createdObjectives;
            this.updateUI();
            
            // Auto-select first objective
            if (this.objectives.length > 0) {
                this.setActiveObjective(this.objectives[0]);
            }
            
            utils.showSuccess(`Created ${objectives.length} objectives with tasks!`);
            
        } catch (error) {
            console.error('Error creating objectives:', error);
            utils.showError('Failed to create objectives');
        } finally {
            utils.hideLoading();
        }
    }
}

// Initialize objective manager
window.objectiveManager = new ObjectiveManager();
