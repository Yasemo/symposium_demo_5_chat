# 🎭 Symposium - Dynamic Context Management for LLM Consultations

A sophisticated chat application that enables dynamic context management when consulting with multiple LLM experts. Built with Deno, vanilla JavaScript, and SQLite.

## Features

### 🎯 Core Functionality
- **Multi-Consultant Chat**: Create specialized consultants with different LLM models and expertise
- **Dynamic Context Management**: Hide/show messages to control what context each consultant sees
- **Shared Conversation History**: All consultants can see the full conversation flow
- **Real-time Model Selection**: Choose from OpenRouter's available models with pricing information
- **Symposium Organization**: Group consultants around specific topics or goals

### 🔧 Technical Features
- **SQLite Database**: Persistent storage for symposiums, consultants, and messages
- **OpenRouter Integration**: Access to multiple LLM providers and models
- **Message Visibility Control**: Fine-grained control over context sent to each consultant
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Live chat interface with instant responses

## Getting Started

### Prerequisites
- [Deno](https://deno.land/) installed on your system
- OpenRouter API key (included in `.env` file)

### Installation & Setup

1. **Clone or download the project files**

2. **Start the server**:
   ```bash
   deno task start
   ```
   
   Or for development with auto-reload:
   ```bash
   deno task dev
   ```

3. **Open your browser** and navigate to:
   ```
   http://localhost:8000
   ```

### Example Symposium

The application comes pre-loaded with an example "Digital Product Launch Strategy" symposium featuring:

- **Market Research Analyst** (Claude 3.5 Sonnet) - Competitive analysis and market validation
- **Product Marketing Strategist** (GPT-4o) - Product positioning and messaging
- **Growth Marketing Expert** (Gemini Pro 1.5) - Customer acquisition strategies
- **Business Strategy Consultant** (Claude 3 Opus) - Strategic planning and business optimization

## How to Use

### 1. Create a Symposium
- Click "Create Symposium" 
- Enter a name and description for your collaborative session
- The description becomes part of the global context sent to all consultants

### 2. Add Consultants
- Click "Add Consultant"
- Choose an LLM model from the OpenRouter catalog (with pricing info)
- Write a system prompt defining the consultant's expertise and role
- Each consultant can use a different model optimized for their specialty

### 3. Start Chatting
- Select a consultant from the sidebar
- Type your message and press Enter or click Send
- The consultant receives context including:
  - Symposium description
  - Visible conversation history
  - Their specific role/expertise prompt
  - Your current message

### 4. Manage Context
- Hover over any message to see visibility controls
- Click the eye icon (👁️) to hide/show messages for the current consultant
- Hidden messages appear grayed out and won't be sent as context
- This helps manage token usage and focus conversations

## Architecture

### Backend (Deno + SQLite)
- `server.js` - Main server with API endpoints
- `database.js` - SQLite schema and initialization
- `openrouter.js` - OpenRouter API integration
- `seed-data.js` - Example data for demonstration

### Frontend (Vanilla JS)
- `public/index.html` - Main application structure
- `public/styles.css` - Responsive CSS styling
- `public/app.js` - Application initialization
- `public/utils/api.js` - API communication utilities
- `public/components/` - Modular JavaScript components:
  - `symposium-manager.js` - Symposium creation and management
  - `consultant-manager.js` - Consultant creation and selection
  - `chat-interface.js` - Chat UI and message handling
  - `message-manager.js` - Message visibility and context control

### Database Schema
```sql
symposiums: id, name, description, created_at
consultants: id, symposium_id, name, model, system_prompt, created_at
messages: id, symposium_id, consultant_id, content, is_user, timestamp
message_visibility: message_id, consultant_id, is_hidden
```

## Configuration

### Environment Variables
Create a `.env` file with your OpenRouter API key:
```
OPENROUTER_API_KEY=your_api_key_here
```

### Deno Configuration
The `deno.json` file includes:
- Task definitions for easy server startup
- Import maps for standard library modules
- All necessary permissions configured

## Development

### Available Commands
```bash
# Start server
deno task start

# Start with auto-reload for development
deno task dev
```

### Development Tools
When running on localhost, the app includes debugging helpers:
```javascript
// Access current application state
window.dev.getState()

// Export data for backup
window.dev.exportData()

// Clear all data and refresh
window.dev.clearData()
```

### Keyboard Shortcuts
- `Escape` - Close modals
- `Ctrl/Cmd + Enter` - Send message
- `Ctrl/Cmd + N` - Create new symposium
- `Ctrl/Cmd + K` - Add consultant

## Use Cases

### Business Strategy
- Assemble consultants for market analysis, financial planning, and strategic decisions
- Control context to focus each expert on their domain

### Creative Projects
- Collaborate with writing, design, and marketing specialists
- Manage conversation flow to build on each other's ideas

### Technical Planning
- Consult with architecture, security, and DevOps experts
- Hide irrelevant technical details from business-focused consultants

### Research & Analysis
- Coordinate between researchers, analysts, and subject matter experts
- Control information flow to prevent bias or information overload

## Contributing

This is a demonstration project showcasing dynamic context management for LLM consultations. Feel free to extend and modify for your specific needs.

## License

MIT License - feel free to use and modify as needed.
