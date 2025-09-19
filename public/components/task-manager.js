// Task Manager Component
class TaskManager {
    constructor() {
        this.tasks = [];
        this.currentSymposium = null;
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
        // Task generation button in symposium modal
        document.addEventListener('click', (e) => {
            if (e.target.id === 'generate-tasks-btn') {
                this.generateTasks();
            }
        });

        // Task management events will be bound dynamically
    }

    async onSymposiumChanged(symposium) {
        this.currentSymposium = symposium;
        if (symposium) {
            await this.loadTasks(symposium.id);
        } else {
            this.tasks = [];
        }
    }

    async loadTasks(symposiumId) {
        try {
            this.tasks = await api.getSymposiumTasks(symposiumId);
            this.renderTasksInSidebar();
        } catch (error) {
            console.error('Error loading tasks:', error);
            utils.showError('Failed to load tasks');
        }
    }

    renderTasksInSidebar() {
        const symposiumContent = document.getElementById('symposium-content');
        const existingTaskSection = document.getElementById('task-progress-section');
        
        if (existingTaskSection) {
            existingTaskSection.remove();
        }

        if (this.tasks.length === 0) {
            return;
        }

        const completedTasks = this.tasks.filter(task => task.is_completed).length;
        const totalTasks = this.tasks.length;
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        const taskSection = document.createElement('div');
        taskSection.id = 'task-progress-section';
        taskSection.className = 'task-progress-section';
        taskSection.innerHTML = `
            <div class="task-progress-header">
                <h4>Mission Progress</h4>
                <div class="progress-indicator">
                    <span class="progress-text">${completedTasks}/${totalTasks} tasks</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                    </div>
                </div>
            </div>
            <div class="task-list" id="task-list">
                ${this.tasks.map((task, index) => this.createTaskHTML(task, index)).join('')}
            </div>
            <div class="task-actions">
                <button id="add-task-btn" class="btn btn-secondary btn-small">+ Add Task</button>
            </div>
        `;

        symposiumContent.appendChild(taskSection);
        this.bindTaskEvents();
    }

    createTaskHTML(task, index) {
        const isCompleted = task.is_completed;
        const taskNumber = index + 1;
        const hasDescription = task.description && task.description.trim();
        
        return `
            <div class="task-item ${isCompleted ? 'completed' : ''} collapsed" data-task-id="${task.id}" draggable="true">
                <div class="task-header" onclick="taskManager.toggleTaskExpansion(${task.id})">
                    <div class="task-number">${taskNumber}</div>
                    <div class="task-checkbox-container" onclick="event.stopPropagation()">
                        <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''}>
                    </div>
                    <div class="task-title-container">
                        <div class="task-title">${task.title}</div>
                    </div>
                    ${hasDescription ? '<div class="expand-indicator">▼</div>' : ''}
                </div>
                <div class="task-expandable-content">
                    ${hasDescription ? `<div class="task-description">${task.description}</div>` : ''}
                    <div class="task-controls">
                        <button class="task-control-btn drag-handle" title="Drag to reorder">⋮⋮</button>
                        <button class="task-control-btn edit-task-btn" title="Edit task">✏️</button>
                        <button class="task-control-btn delete-task-btn" title="Delete task">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }

    bindTaskEvents() {
        // Task completion checkboxes
        document.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const taskId = parseInt(e.target.closest('.task-item').dataset.taskId);
                this.toggleTaskCompletion(taskId, e.target.checked);
            });
        });

        // Edit task buttons
        document.querySelectorAll('.edit-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = parseInt(e.target.closest('.task-item').dataset.taskId);
                this.editTask(taskId);
            });
        });

        // Delete task buttons
        document.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = parseInt(e.target.closest('.task-item').dataset.taskId);
                this.deleteTask(taskId);
            });
        });

        // Add task button
        const addTaskBtn = document.getElementById('add-task-btn');
        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', () => {
                this.showTaskModal();
            });
        }

        // Add drag and drop functionality
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const taskList = document.getElementById('task-list');
        if (!taskList) return;

        let draggedElement = null;
        let draggedIndex = null;

        // Add drag event listeners to all task items
        document.querySelectorAll('.task-item').forEach((item, index) => {
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
                    const dropIndex = Array.from(taskList.children).indexOf(item);
                    this.reorderTasks(draggedIndex, dropIndex);
                }
            });
        });

        // Add visual feedback for drag over
        taskList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(taskList, e.clientY);
            const dragging = document.querySelector('.dragging');
            
            if (afterElement == null) {
                taskList.appendChild(dragging);
            } else {
                taskList.insertBefore(dragging, afterElement);
            }
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
        
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

    async reorderTasks(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;

        try {
            // Reorder tasks locally
            const movedTask = this.tasks.splice(fromIndex, 1)[0];
            this.tasks.splice(toIndex, 0, movedTask);

            // Update order_index for all tasks
            const taskOrders = this.tasks.map((task, index) => ({
                task_id: task.id,
                order_index: index
            }));

            // Send reorder request to server
            await api.reorderSymposiumTasks({
                symposium_id: this.currentSymposium.id,
                task_orders: taskOrders
            });

            // Re-render to show new order with updated numbers
            this.renderTasksInSidebar();

        } catch (error) {
            console.error('Error reordering tasks:', error);
            utils.showError('Failed to reorder tasks');
            // Reload tasks to restore original order
            await this.loadTasks(this.currentSymposium.id);
        }
    }

    async toggleTaskCompletion(taskId, isCompleted) {
        try {
            await api.updateSymposiumTask(taskId, { is_completed: isCompleted });
            
            // Update local task
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                task.is_completed = isCompleted;
                this.renderTasksInSidebar();
            }
        } catch (error) {
            console.error('Error updating task:', error);
            utils.showError('Failed to update task');
        }
    }

    async generateTasks() {
        const descriptionTextarea = document.getElementById('symposium-description');
        const description = descriptionTextarea.value.trim();

        if (!description) {
            utils.showError('Please enter a symposium description first');
            return;
        }

        try {
            utils.showLoading();
            const result = await api.generateTasks(description);
            
            if (result.success) {
                this.showTaskGenerationModal(result.tasks);
            } else {
                // Still show the fallback tasks
                this.showTaskGenerationModal(result.tasks);
                if (result.error) {
                    console.warn('Task generation warning:', result.error);
                }
            }
        } catch (error) {
            console.error('Error generating tasks:', error);
            utils.showError('Failed to generate tasks');
        } finally {
            utils.hideLoading();
        }
    }

    showTaskGenerationModal(generatedTasks) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('task-generation-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'task-generation-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h2>Generated Tasks</h2>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>Review and customize the generated tasks for your symposium:</p>
                        <div id="generated-tasks-list" class="generated-tasks-list"></div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" id="cancel-tasks">Cancel</button>
                            <button type="button" class="btn btn-primary" id="accept-tasks">Accept Tasks</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Bind modal events
            modal.querySelector('.close-btn').addEventListener('click', () => {
                this.hideTaskGenerationModal();
            });
            modal.querySelector('#cancel-tasks').addEventListener('click', () => {
                this.hideTaskGenerationModal();
            });
            modal.querySelector('#accept-tasks').addEventListener('click', () => {
                this.acceptGeneratedTasks();
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideTaskGenerationModal();
                }
            });
        }

        // Populate tasks
        const tasksList = modal.querySelector('#generated-tasks-list');
        tasksList.innerHTML = generatedTasks.map((task, index) => `
            <div class="generated-task-item" data-index="${index}">
                <div class="task-input-group">
                    <label>Task Title:</label>
                    <input type="text" class="task-title-input" value="${task.title}">
                </div>
                <div class="task-input-group">
                    <label>Description:</label>
                    <textarea class="task-description-input" rows="2">${task.description}</textarea>
                </div>
                <button class="remove-task-btn btn btn-secondary btn-small">Remove</button>
            </div>
        `).join('');

        // Bind remove task buttons
        tasksList.querySelectorAll('.remove-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.generated-task-item').remove();
            });
        });

        modal.classList.add('active');
        this.generatedTasks = generatedTasks;
    }

    hideTaskGenerationModal() {
        const modal = document.getElementById('task-generation-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    async acceptGeneratedTasks() {
        const modal = document.getElementById('task-generation-modal');
        const taskItems = modal.querySelectorAll('.generated-task-item');
        
        const tasksToCreate = Array.from(taskItems).map(item => ({
            title: item.querySelector('.task-title-input').value.trim(),
            description: item.querySelector('.task-description-input').value.trim()
        })).filter(task => task.title); // Only include tasks with titles

        if (tasksToCreate.length === 0) {
            utils.showError('Please add at least one task');
            return;
        }

        // Store tasks to be created after symposium creation
        this.pendingTasks = tasksToCreate;
        this.hideTaskGenerationModal();
        
        // Show success message
        utils.showSuccess(`${tasksToCreate.length} tasks ready to be added to your symposium`);
    }

    async createPendingTasks(symposiumId) {
        if (!this.pendingTasks || this.pendingTasks.length === 0) {
            return;
        }

        try {
            for (const task of this.pendingTasks) {
                await api.createSymposiumTask({
                    symposium_id: symposiumId,
                    title: task.title,
                    description: task.description
                });
            }
            
            // Clear pending tasks
            this.pendingTasks = [];
            
            // Reload tasks
            await this.loadTasks(symposiumId);
            
        } catch (error) {
            console.error('Error creating tasks:', error);
            utils.showError('Failed to create some tasks');
        }
    }

    showTaskModal(task = null) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('task-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'task-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="task-modal-title">Add Task</h2>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="task-form">
                            <div class="form-group">
                                <label for="task-title">Task Title</label>
                                <input type="text" id="task-title" required>
                            </div>
                            <div class="form-group">
                                <label for="task-description">Description (optional)</label>
                                <textarea id="task-description" rows="3"></textarea>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" id="cancel-task">Cancel</button>
                                <button type="submit" class="btn btn-primary">Save Task</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Bind modal events
            const form = modal.querySelector('#task-form');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveTask();
            });
            modal.querySelector('.close-btn').addEventListener('click', () => {
                this.hideTaskModal();
            });
            modal.querySelector('#cancel-task').addEventListener('click', () => {
                this.hideTaskModal();
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideTaskModal();
                }
            });
        }

        // Populate form if editing
        const titleInput = modal.querySelector('#task-title');
        const descriptionInput = modal.querySelector('#task-description');
        const modalTitle = modal.querySelector('#task-modal-title');

        if (task) {
            modalTitle.textContent = 'Edit Task';
            titleInput.value = task.title;
            descriptionInput.value = task.description || '';
            this.editingTask = task;
        } else {
            modalTitle.textContent = 'Add Task';
            titleInput.value = '';
            descriptionInput.value = '';
            this.editingTask = null;
        }

        modal.classList.add('active');
        titleInput.focus();
    }

    hideTaskModal() {
        const modal = document.getElementById('task-modal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.editingTask = null;
    }

    async saveTask() {
        const titleInput = document.getElementById('task-title');
        const descriptionInput = document.getElementById('task-description');
        
        const title = titleInput.value.trim();
        const description = descriptionInput.value.trim();

        if (!title) {
            utils.showError('Please enter a task title');
            return;
        }

        try {
            utils.showLoading();

            if (this.editingTask) {
                // Update existing task
                await api.updateSymposiumTask(this.editingTask.id, {
                    title,
                    description: description || null
                });
                
                // Update local task
                const taskIndex = this.tasks.findIndex(t => t.id === this.editingTask.id);
                if (taskIndex !== -1) {
                    this.tasks[taskIndex].title = title;
                    this.tasks[taskIndex].description = description;
                }
            } else {
                // Create new task
                const newTask = await api.createSymposiumTask({
                    symposium_id: this.currentSymposium.id,
                    title,
                    description: description || null
                });
                
                this.tasks.push(newTask);
            }

            this.renderTasksInSidebar();
            this.hideTaskModal();
            utils.showSuccess('Task saved successfully!');

        } catch (error) {
            console.error('Error saving task:', error);
            utils.showError('Failed to save task');
        } finally {
            utils.hideLoading();
        }
    }

    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            this.showTaskModal(task);
        }
    }

    async deleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        if (!confirm(`Are you sure you want to delete "${task.title}"? This action cannot be undone.`)) {
            return;
        }

        try {
            utils.showLoading();
            await api.deleteSymposiumTask(taskId);
            
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.renderTasksInSidebar();
            
            utils.showSuccess('Task deleted successfully!');

        } catch (error) {
            console.error('Error deleting task:', error);
            utils.showError('Failed to delete task');
        } finally {
            utils.hideLoading();
        }
    }

    toggleTaskExpansion(taskId) {
        const taskItem = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!taskItem) return;

        const isCollapsed = taskItem.classList.contains('collapsed');
        const expandIndicator = taskItem.querySelector('.expand-indicator');
        
        if (isCollapsed) {
            taskItem.classList.remove('collapsed');
            taskItem.classList.add('expanded');
            if (expandIndicator) {
                expandIndicator.textContent = '▲';
            }
        } else {
            taskItem.classList.remove('expanded');
            taskItem.classList.add('collapsed');
            if (expandIndicator) {
                expandIndicator.textContent = '▼';
            }
        }
    }

    getTasks() {
        return this.tasks;
    }

    getCompletedTasks() {
        return this.tasks.filter(task => task.is_completed);
    }

    getTaskProgress() {
        const completed = this.getCompletedTasks().length;
        const total = this.tasks.length;
        return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
    }
}

// Initialize task manager
window.taskManager = new TaskManager();
