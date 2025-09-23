// Enhanced Markdown Renderer for Symposium Content Cards
class EnhancedMarkdownRenderer {
    constructor() {
        this.plugins = new Map();
        this.initialized = false;
        this.loadingPromises = new Map();
        this.init();
    }

    async init() {
        if (this.initialized) return;
        
        // Load required libraries
        await this.loadLibraries();
        
        // Configure marked with enhanced options
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false,
            sanitize: false, // We'll handle sanitization ourselves
            highlight: (code, lang) => this.highlightCode(code, lang)
        });

        // Register core plugins
        this.registerPlugin('math', new MathPlugin());
        this.registerPlugin('mermaid', new MermaidPlugin());
        this.registerPlugin('chart', new ChartPlugin());
        this.registerPlugin('datatable', new DataTablePlugin());
        this.registerPlugin('callout', new CalloutPlugin());
        this.registerPlugin('interactive', new InteractivePlugin());

        // Add custom renderer extensions
        this.setupCustomRenderers();
        
        this.initialized = true;
    }

    async loadLibraries() {
        const libraries = [
            { name: 'katex', url: 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js', css: 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css' },
            { name: 'mermaid', url: 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js' },
            { name: 'chartjs', url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js' },
            { name: 'hljs', url: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js', css: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css' }
        ];

        for (const lib of libraries) {
            if (!this.loadingPromises.has(lib.name)) {
                this.loadingPromises.set(lib.name, this.loadLibrary(lib));
            }
        }

        await Promise.all(this.loadingPromises.values());
    }

    async loadLibrary({ name, url, css }) {
        // Check if already loaded
        if (window[name] || (name === 'katex' && window.katex) || (name === 'chartjs' && window.Chart) || (name === 'hljs' && window.hljs)) {
            return;
        }

        // Load CSS if provided
        if (css && !document.querySelector(`link[href="${css}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = css;
            document.head.appendChild(link);
        }

        // Load JavaScript
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    registerPlugin(name, plugin) {
        this.plugins.set(name, plugin);
    }

    setupCustomRenderers() {
        const renderer = new marked.Renderer();
        
        // Custom code block renderer for special types
        renderer.code = (code, language, escaped) => {
            return this.renderCodeBlock(code, language, escaped);
        };

        // Custom table renderer with enhanced features
        renderer.table = (header, body) => {
            return this.renderEnhancedTable(header, body);
        };

        // Custom blockquote for callouts
        renderer.blockquote = (quote) => {
            return this.renderCallout(quote);
        };

        marked.use({ renderer });
    }

    async render(markdown, options = {}) {
        await this.init();
        
        try {
            // Stage 1: Extract enhanced features (math, charts, mermaid, etc.)
            const { cleanMarkdown, extractedFeatures } = await this.extractEnhancedFeatures(markdown);
            
            // Stage 2: Render clean markdown with GFM for perfect GitHub compatibility
            let html = await this.renderWithGFM(cleanMarkdown, options);
            
            // Stage 3: Re-inject enhanced features into the GFM HTML
            html = await this.reInjectEnhancedFeatures(html, extractedFeatures);
            
            // Stage 4: Post-process for interactive elements
            html = await this.postProcess(html, options);
            
            return html;
        } catch (error) {
            console.error('Enhanced markdown rendering error:', error);
            // Fallback to basic rendering
            return this.fallbackRender(markdown);
        }
    }

    async extractEnhancedFeatures(markdown) {
        const extractedFeatures = [];
        let cleanMarkdown = markdown;
        let placeholderIndex = 0;

        // Extract math expressions first (both inline and block)
        cleanMarkdown = cleanMarkdown.replace(/\$\$([^$]+)\$\$/g, (match, math) => {
            const placeholder = `__ENHANCED_FEATURE_${placeholderIndex++}__`;
            extractedFeatures.push({
                placeholder,
                type: 'math_block',
                content: math.trim(),
                original: match
            });
            return placeholder;
        });

        cleanMarkdown = cleanMarkdown.replace(/\$([^$]+)\$/g, (match, math) => {
            const placeholder = `__ENHANCED_FEATURE_${placeholderIndex++}__`;
            extractedFeatures.push({
                placeholder,
                type: 'math_inline',
                content: math.trim(),
                original: match
            });
            return placeholder;
        });

        // Extract code blocks with special languages
        cleanMarkdown = cleanMarkdown.replace(/```(mermaid|chart|datatable)\n([\s\S]*?)\n```/g, (match, lang, code) => {
            const placeholder = `__ENHANCED_FEATURE_${placeholderIndex++}__`;
            extractedFeatures.push({
                placeholder,
                type: `code_${lang}`,
                content: code.trim(),
                language: lang,
                original: match
            });
            return placeholder;
        });

        // Extract callouts
        cleanMarkdown = cleanMarkdown.replace(/:::\s*(\w+)\s*\n([\s\S]*?)\n:::/g, (match, type, content) => {
            const placeholder = `__ENHANCED_FEATURE_${placeholderIndex++}__`;
            extractedFeatures.push({
                placeholder,
                type: 'callout',
                calloutType: type,
                content: content.trim(),
                original: match
            });
            return placeholder;
        });

        return { cleanMarkdown, extractedFeatures };
    }

    async renderWithGFM(markdown, options = {}) {
        try {
            // Call the server-side GFM endpoint
            const response = await fetch('/api/render-gfm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    markdown: markdown,
                    options: {
                        baseUrl: options.baseUrl || 'https://github.com',
                        allowMath: true, // Enable math support
                        inline: options.inline || false,
                        ...options
                    }
                })
            });

            const result = await response.json();
            
            if (result.success) {
                return result.html;
            } else {
                console.warn('GFM rendering failed, falling back to marked.js:', result.error);
                return this.fallbackToMarked(markdown);
            }
        } catch (error) {
            console.warn('GFM endpoint unavailable, falling back to marked.js:', error);
            return this.fallbackToMarked(markdown);
        }
    }

    async reInjectEnhancedFeatures(html, extractedFeatures) {
        let processedHtml = html;

        for (const feature of extractedFeatures) {
            let replacement = '';

            switch (feature.type) {
                case 'math_block':
                    replacement = await this.renderMathBlock(feature.content);
                    break;
                case 'math_inline':
                    replacement = await this.renderMathInline(feature.content);
                    break;
                case 'code_mermaid':
                    replacement = this.plugins.get('mermaid').renderCodeBlock(feature.content, feature.language);
                    break;
                case 'code_chart':
                    replacement = this.plugins.get('chart').renderCodeBlock(feature.content, feature.language);
                    break;
                case 'code_datatable':
                    replacement = this.plugins.get('datatable').renderCodeBlock(feature.content, feature.language);
                    break;
                case 'callout':
                    replacement = this.plugins.get('callout').render(feature.calloutType, feature.content);
                    break;
                default:
                    replacement = feature.original; // Fallback to original
            }

            processedHtml = processedHtml.replace(feature.placeholder, replacement);
        }

        return processedHtml;
    }

    async renderMathBlock(math) {
        if (!window.katex) {
            return `<div class="math-error">KaTeX not loaded: ${math}</div>`;
        }

        try {
            const html = katex.renderToString(math, { displayMode: true });
            return `<div class="math-block">${html}</div>`;
        } catch (error) {
            console.warn('KaTeX block render error:', error);
            return `<div class="math-error">Math Error: ${math}</div>`;
        }
    }

    async renderMathInline(math) {
        if (!window.katex) {
            return `<span class="math-error">KaTeX not loaded: ${math}</span>`;
        }

        try {
            const html = katex.renderToString(math, { displayMode: false });
            return `<span class="math-inline">${html}</span>`;
        } catch (error) {
            console.warn('KaTeX inline render error:', error);
            return `<span class="math-error">Math Error: ${math}</span>`;
        }
    }

    fallbackToMarked(markdown) {
        // Configure marked for GFM-like behavior
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false,
            sanitize: false,
            highlight: (code, lang) => this.highlightCode(code, lang)
        });

        return marked.parse(markdown);
    }

    async fallbackRender(markdown) {
        try {
            // Simple fallback - just use marked.js
            return this.fallbackToMarked(markdown);
        } catch (error) {
            console.error('Fallback rendering also failed:', error);
            return markdown.replace(/\n/g, '<br>');
        }
    }

    async preProcess(markdown) {
        let processed = markdown;
        
        // Process each plugin's pre-processing
        for (const [name, plugin] of this.plugins) {
            if (plugin.preProcess) {
                processed = await plugin.preProcess(processed);
            }
        }
        
        return processed;
    }

    async postProcess(html, options) {
        let processed = html;
        
        // Process each plugin's post-processing
        for (const [name, plugin] of this.plugins) {
            if (plugin.postProcess) {
                processed = await plugin.postProcess(processed, options);
            }
        }
        
        return processed;
    }

    renderCodeBlock(code, language, escaped) {
        // Handle special visualization languages
        switch (language) {
            case 'mermaid':
                return this.plugins.get('mermaid').renderCodeBlock(code, language);
            case 'chart':
                return this.plugins.get('chart').renderCodeBlock(code, language);
            case 'datatable':
                return this.plugins.get('datatable').renderCodeBlock(code, language);
            case 'math':
                return this.plugins.get('math').renderCodeBlock(code, language);
            default:
                return this.renderHighlightedCode(code, language);
        }
    }

    renderHighlightedCode(code, language) {
        if (!window.hljs) {
            return `<pre><code class="language-${language || 'plaintext'}">${code}</code></pre>`;
        }

        const validLang = language && hljs.getLanguage(language) ? language : 'plaintext';
        const highlighted = hljs.highlight(code, { language: validLang }).value;
        
        return `
            <div class="code-block-container">
                <div class="code-block-header">
                    <span class="code-language">${validLang}</span>
                    <button class="copy-code-btn" onclick="window.enhancedRenderer.copyCode(this)" title="Copy code">
                        📋
                    </button>
                </div>
                <pre class="hljs"><code class="language-${validLang}">${highlighted}</code></pre>
            </div>
        `;
    }

    highlightCode(code, lang) {
        if (window.hljs && lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(code, { language: lang }).value;
            } catch (err) {
                console.warn('Code highlighting error:', err);
            }
        }
        return code;
    }

    renderEnhancedTable(header, body) {
        const tableId = `table-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        return `
            <div class="enhanced-table-container">
                <div class="table-controls">
                    <input type="text" class="table-search" placeholder="Search table..." 
                           onkeyup="window.enhancedRenderer.filterTable('${tableId}', this.value)">
                    <button class="table-export-btn" onclick="window.enhancedRenderer.exportTable('${tableId}')" title="Export CSV">
                        📊 Export
                    </button>
                </div>
                <div class="table-wrapper">
                    <table id="${tableId}" class="enhanced-table sortable">
                        <thead>${header}</thead>
                        <tbody>${body}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderCallout(quote) {
        // Check if this is a callout (starts with ::: type)
        const calloutMatch = quote.match(/^<p>:::\s*(\w+)\s*\n?(.*?)\n?:::<\/p>$/s);
        if (calloutMatch) {
            const [, type, content] = calloutMatch;
            return this.plugins.get('callout').render(type, content);
        }
        
        // Regular blockquote
        return `<blockquote>${quote}</blockquote>`;
    }

    sanitize(html) {
        // Create a temporary container to safely parse and sanitize HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remove dangerous elements
        const dangerousElements = tempDiv.querySelectorAll('script, iframe, object, embed');
        dangerousElements.forEach(el => el.remove());
        
        // Remove dangerous attributes
        const allElements = tempDiv.querySelectorAll('*');
        allElements.forEach(el => {
            // Remove event handler attributes
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on') || attr.value.includes('javascript:')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        
        return tempDiv.innerHTML;
    }

    // Utility methods for interactive features
    copyCode(button) {
        const codeElement = button.parentElement.nextElementSibling.querySelector('code');
        if (codeElement) {
            navigator.clipboard.writeText(codeElement.textContent).then(() => {
                const originalText = button.textContent;
                button.textContent = '✅';
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            });
        }
    }

    filterTable(tableId, searchTerm) {
        const table = document.getElementById(tableId);
        if (!table) return;

        const rows = table.querySelectorAll('tbody tr');
        const term = searchTerm.toLowerCase();

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    }

    exportTable(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return;

        let csv = '';
        const rows = table.querySelectorAll('tr');
        
        rows.forEach(row => {
            const cols = row.querySelectorAll('td, th');
            const rowData = Array.from(cols).map(col => `"${col.textContent.replace(/"/g, '""')}"`);
            csv += rowData.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `table-${tableId}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }
}

// Math Plugin for KaTeX integration
class MathPlugin {
    constructor() {
        this.inlinePattern = /\$([^$]+)\$/g;
        this.blockPattern = /\$\$([^$]+)\$\$/g;
    }

    async preProcess(markdown) {
        if (!window.katex) return markdown;

        // Process block math first
        markdown = markdown.replace(this.blockPattern, (match, math) => {
            try {
                const html = katex.renderToString(math.trim(), { displayMode: true });
                return `<div class="math-block">${html}</div>`;
            } catch (error) {
                console.warn('KaTeX block render error:', error);
                return `<div class="math-error">Math Error: ${math}</div>`;
            }
        });

        // Process inline math
        markdown = markdown.replace(this.inlinePattern, (match, math) => {
            try {
                const html = katex.renderToString(math.trim(), { displayMode: false });
                return `<span class="math-inline">${html}</span>`;
            } catch (error) {
                console.warn('KaTeX inline render error:', error);
                return `<span class="math-error">Math Error: ${math}</span>`;
            }
        });

        return markdown;
    }
}

// Mermaid Plugin for diagrams
class MermaidPlugin {
    constructor() {
        this.diagramCounter = 0;
    }

    renderCodeBlock(code, language) {
        if (!window.mermaid) {
            return `<div class="mermaid-error">Mermaid library not loaded</div>`;
        }

        const diagramId = `mermaid-${++this.diagramCounter}`;
        
        // Initialize mermaid if not already done
        if (!window.mermaidInitialized) {
            mermaid.initialize({ 
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'loose'
            });
            window.mermaidInitialized = true;
        }

        return `<div class="mermaid-container">
            <div id="${diagramId}" class="mermaid">${code}</div>
        </div>`;
    }

    async postProcess(html, options) {
        if (window.mermaid && html.includes('class="mermaid"')) {
            // Render all mermaid diagrams after DOM is updated
            setTimeout(() => {
                mermaid.init(undefined, document.querySelectorAll('.mermaid'));
            }, 100);
        }
        return html;
    }
}

// Chart Plugin for data visualization
class ChartPlugin {
    constructor() {
        this.chartCounter = 0;
    }

    renderCodeBlock(code, language) {
        if (!window.Chart) {
            return `<div class="chart-error">Chart.js library not loaded</div>`;
        }

        const chartId = `chart-${++this.chartCounter}`;
        
        try {
            const config = this.parseChartConfig(code);
            
            return `
                <div class="chart-container">
                    <canvas id="${chartId}" class="chart-canvas"></canvas>
                    <script type="application/json" class="chart-config">${JSON.stringify(config)}</script>
                </div>
            `;
        } catch (error) {
            return `<div class="chart-error">Chart configuration error: ${error.message}</div>`;
        }
    }

    parseChartConfig(code) {
        // Parse YAML-like chart configuration
        const lines = code.trim().split('\n');
        const config = { type: 'line', data: { datasets: [] }, options: {} };
        
        let currentSection = null;
        let currentDataset = null;
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            if (trimmed.startsWith('type:')) {
                config.type = trimmed.split(':')[1].trim();
            } else if (trimmed === 'data:') {
                currentSection = 'data';
            } else if (trimmed === 'options:') {
                currentSection = 'options';
            } else if (trimmed.startsWith('labels:')) {
                const labelsStr = trimmed.substring(7).trim();
                config.data.labels = JSON.parse(labelsStr);
            } else if (trimmed.startsWith('datasets:')) {
                currentSection = 'datasets';
            } else if (trimmed.startsWith('- label:')) {
                currentDataset = { label: trimmed.substring(8).trim().replace(/['"]/g, '') };
                config.data.datasets.push(currentDataset);
            } else if (currentDataset && trimmed.startsWith('data:')) {
                const dataStr = trimmed.substring(5).trim();
                currentDataset.data = JSON.parse(dataStr);
            } else if (currentDataset && trimmed.includes(':')) {
                const [key, value] = trimmed.split(':').map(s => s.trim());
                try {
                    currentDataset[key] = JSON.parse(value);
                } catch {
                    currentDataset[key] = value.replace(/['"]/g, '');
                }
            }
        }
        
        return config;
    }

    async postProcess(html, options) {
        if (window.Chart && html.includes('chart-container')) {
            setTimeout(() => {
                document.querySelectorAll('.chart-container').forEach(container => {
                    const canvas = container.querySelector('canvas');
                    const configScript = container.querySelector('.chart-config');
                    
                    if (canvas && configScript && !canvas.chart) {
                        try {
                            const config = JSON.parse(configScript.textContent);
                            canvas.chart = new Chart(canvas, config);
                        } catch (error) {
                            console.error('Chart creation error:', error);
                        }
                    }
                });
            }, 100);
        }
        return html;
    }
}

// DataTable Plugin for enhanced tables
class DataTablePlugin {
    renderCodeBlock(code, language) {
        try {
            const config = this.parseTableConfig(code);
            const tableId = `datatable-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            return `
                <div class="datatable-container">
                    <div class="datatable-controls">
                        <input type="text" class="datatable-search" placeholder="Search..." 
                               onkeyup="window.enhancedRenderer.filterTable('${tableId}', this.value)">
                        <button class="datatable-export" onclick="window.enhancedRenderer.exportTable('${tableId}')">
                            Export CSV
                        </button>
                    </div>
                    <div class="datatable-wrapper">
                        ${this.generateTable(config, tableId)}
                    </div>
                </div>
            `;
        } catch (error) {
            return `<div class="datatable-error">DataTable error: ${error.message}</div>`;
        }
    }

    parseTableConfig(code) {
        const lines = code.trim().split('\n');
        const config = { data: [], columns: {}, sortable: true, filterable: true };
        
        let currentSection = null;
        let dataLines = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            if (trimmed.startsWith('data:')) {
                currentSection = 'data';
                // Check if data is on the same line
                const dataOnSameLine = trimmed.substring(5).trim();
                if (dataOnSameLine && dataOnSameLine !== '|') {
                    dataLines.push(dataOnSameLine);
                }
            } else if (trimmed.startsWith('config:')) {
                currentSection = 'config';
            } else if (currentSection === 'data') {
                if (trimmed.startsWith('|')) {
                    // Skip the YAML block scalar indicator
                    continue;
                } else if (trimmed.length > 0) {
                    // This is actual CSV data
                    dataLines.push(trimmed);
                }
            } else if (currentSection === 'config') {
                const colonIndex = trimmed.indexOf(':');
                if (colonIndex > 0) {
                    const key = trimmed.substring(0, colonIndex).trim();
                    const value = trimmed.substring(colonIndex + 1).trim();
                    if (key && value) {
                        try {
                            config[key] = JSON.parse(value);
                        } catch {
                            config[key] = value;
                        }
                    }
                }
            }
        }
        
        // Parse the collected CSV data
        if (dataLines.length > 0) {
            config.data = dataLines.map(row => {
                // Handle CSV parsing with quoted values
                const cells = [];
                let current = '';
                let inQuotes = false;
                
                for (let i = 0; i < row.length; i++) {
                    const char = row[i];
                    if (char === '"' && (i === 0 || row[i-1] === ',')) {
                        inQuotes = true;
                    } else if (char === '"' && inQuotes && (i === row.length - 1 || row[i+1] === ',')) {
                        inQuotes = false;
                    } else if (char === ',' && !inQuotes) {
                        cells.push(current.trim().replace(/^"|"$/g, ''));
                        current = '';
                    } else {
                        current += char;
                    }
                }
                cells.push(current.trim().replace(/^"|"$/g, ''));
                return cells;
            });
        }
        
        return config;
    }

    generateTable(config, tableId) {
        if (!config.data || config.data.length === 0) {
            return '<p>No data available</p>';
        }
        
        const headers = config.data[0];
        const rows = config.data.slice(1);
        
        let html = `<table id="${tableId}" class="enhanced-datatable">`;
        
        // Headers
        html += '<thead><tr>';
        headers.forEach(header => {
            html += `<th class="sortable-header" onclick="window.enhancedRenderer.sortTable('${tableId}', this)">${header}</th>`;
        });
        html += '</tr></thead>';
        
        // Body
        html += '<tbody>';
        rows.forEach(row => {
            html += '<tr>';
            row.forEach(cell => {
                html += `<td>${cell}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody>';
        
        html += '</table>';
        return html;
    }
}

// Callout Plugin for styled notifications
class CalloutPlugin {
    render(type, content) {
        const icons = {
            info: 'ℹ️',
            warning: '⚠️',
            danger: '🚨',
            success: '✅',
            tip: '💡',
            note: '📝'
        };
        
        const icon = icons[type] || icons.info;
        
        return `
            <div class="callout callout-${type}">
                <div class="callout-header">
                    <span class="callout-icon">${icon}</span>
                    <span class="callout-type">${type.toUpperCase()}</span>
                </div>
                <div class="callout-content">${content}</div>
            </div>
        `;
    }
}

// Interactive Plugin for custom elements
class InteractivePlugin {
    async postProcess(html, options) {
        // Process progress bars
        html = html.replace(/<progress\s+value="(\d+)"\s+max="(\d+)">([^<]*)<\/progress>/g, 
            (match, value, max, text) => {
                const percentage = Math.round((value / max) * 100);
                return `
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percentage}%"></div>
                        </div>
                        <span class="progress-text">${text || `${percentage}%`}</span>
                    </div>
                `;
            }
        );
        
        // Process details/summary for collapsible sections
        html = html.replace(/<details>/g, '<details class="collapsible-section">');
        html = html.replace(/<summary>/g, '<summary class="collapsible-header">');
        
        return html;
    }
}

// Initialize global renderer instance
window.enhancedRenderer = new EnhancedMarkdownRenderer();
