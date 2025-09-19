import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.208.0/http/file_server.ts";
import { DatabaseFactory, initDatabase } from "./database-factory.js";
import { getOpenRouterModels, getOpenRouterAuth, chatWithOpenRouter } from "./openrouter.js";
import { seedDatabase } from "./seed-data.js";
import { AirtableService } from "./airtable-client.js";
import { ConsultantFactory, ConsultantConfigManager, ConsultantTemplateManager } from "./consultants/consultant-factory.js";

const db = await DatabaseFactory.create();
await initDatabase(db);

// Initialize consultant templates after database is created
const templateManager = new ConsultantTemplateManager(db);
await templateManager.seedDefaultTemplates();

await seedDatabase(db);

// Initialize Airtable service
const airtableService = new AirtableService(db);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function handler(req) {
  const url = new URL(req.url);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // API routes
  if (url.pathname.startsWith("/api/")) {
    try {
      const response = await handleApiRequest(req, url, db);
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("API Error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Serve static files
  return serveDir(req, {
    fsRoot: "public",
    urlRoot: "",
    showDirListing: false,
    enableCors: true,
  });
}

async function handleApiRequest(req, url, db) {
  const path = url.pathname.replace("/api", "");
  const method = req.method;

  switch (path) {
    case "/models":
      if (method === "GET") {
        return await getOpenRouterModels();
      }
      break;

    case "/auth":
      if (method === "GET") {
        return await getOpenRouterAuth();
      }
      break;

    case "/symposiums":
      if (method === "GET") {
        return await getSymposiums(db);
      } else if (method === "POST") {
        const body = await req.json();
        return await createSymposium(db, body);
      }
      break;

    case "/consultants":
      if (method === "GET") {
        const symposiumId = url.searchParams.get("symposium_id");
        return await getConsultants(db, symposiumId);
      } else if (method === "POST") {
        const body = await req.json();
        return await createConsultant(db, body);
      }
      break;

    case "/messages":
      if (method === "GET") {
        const symposiumId = url.searchParams.get("symposium_id");
        return await getMessages(db, symposiumId);
      } else if (method === "POST") {
        const body = await req.json();
        return await createMessage(db, body);
      }
      break;

    case "/chat":
      if (method === "POST") {
        const body = await req.json();
        return await handleChat(db, body);
      }
      break;

    case "/message-visibility":
      if (method === "POST") {
        const body = await req.json();
        return toggleMessageVisibility(db, body);
      }
      break;

    case "/clear-messages":
      if (method === "POST") {
        const body = await req.json();
        return clearMessages(db, body);
      }
      break;

    case "/airtable/config":
      if (method === "GET") {
        const consultantId = url.searchParams.get("consultant_id");
        return await getAirtableConfig(consultantId);
      } else if (method === "POST") {
        const body = await req.json();
        return await saveAirtableConfig(body);
      }
      break;

    case "/airtable/test-connection":
      if (method === "POST") {
        const body = await req.json();
        return await testAirtableConnection(body);
      }
      break;

    case "/airtable/tables":
      if (method === "POST") {
        const body = await req.json();
        return await getAirtableTables(body);
      }
      break;

    case "/consultant-templates":
      if (method === "GET") {
        return await getConsultantTemplates(db);
      }
      break;

    case "/consultant-config":
      if (method === "GET") {
        const consultantId = url.searchParams.get("consultant_id");
        return await getConsultantConfig(db, consultantId);
      } else if (method === "POST") {
        const body = await req.json();
        return await saveConsultantConfig(db, body);
      }
      break;

    case "/knowledge-base":
      if (method === "GET") {
        const symposiumId = url.searchParams.get("symposium_id");
        return getKnowledgeBaseCards(db, symposiumId);
      } else if (method === "POST") {
        const body = await req.json();
        return createKnowledgeBaseCard(db, body);
      }
      break;

    case "/knowledge-base/from-message":
      if (method === "POST") {
        const body = await req.json();
        return createCardFromMessage(db, body);
      }
      break;

    case "/knowledge-base/toggle-visibility":
      if (method === "POST") {
        const body = await req.json();
        return toggleCardVisibility(db, body);
      }
      break;

    case "/symposium-tasks":
      if (method === "GET") {
        const symposiumId = url.searchParams.get("symposium_id");
        return getSymposiumTasks(db, symposiumId);
      } else if (method === "POST") {
        const body = await req.json();
        return createSymposiumTask(db, body);
      }
      break;

    case "/symposium-tasks/reorder":
      if (method === "PUT") {
        const body = await req.json();
        return reorderSymposiumTasks(db, body);
      }
      break;

    case "/generate-tasks":
      if (method === "POST") {
        const body = await req.json();
        return generateTasksFromDescription(body);
      }
      break;

    default:
      // Handle consultant deletion with ID in path
      if (path.startsWith("/consultants/") && method === "DELETE") {
        const consultantId = path.split("/")[2];
        return deleteConsultant(db, consultantId);
      }
      // Handle message operations with ID in path
      if (path.startsWith("/messages/") && path.split("/").length === 3) {
        const messageId = path.split("/")[2];
        if (method === "PUT") {
          const body = await req.json();
          return editMessage(db, messageId, body);
        } else if (method === "DELETE") {
          return deleteMessage(db, messageId);
        }
      }
      // Handle knowledge base card operations with ID in path
      if (path.startsWith("/knowledge-base/") && path.split("/").length === 3) {
        const cardId = path.split("/")[2];
        if (method === "PUT") {
          const body = await req.json();
          return updateKnowledgeBaseCard(db, cardId, body);
        } else if (method === "DELETE") {
          return deleteKnowledgeBaseCard(db, cardId);
        }
      }
      // Handle symposium task operations with ID in path
      if (path.startsWith("/symposium-tasks/") && path.split("/").length === 3) {
        const taskId = path.split("/")[2];
        if (method === "PUT") {
          const body = await req.json();
          return updateSymposiumTask(db, taskId, body);
        } else if (method === "DELETE") {
          return deleteSymposiumTask(db, taskId);
        }
      }
      throw new Error("Not found");
  }
}

// Database operations
async function getSymposiums(db) {
  const stmt = db.prepare("SELECT * FROM symposiums ORDER BY created_at DESC");
  return await stmt.all();
}

async function createSymposium(db, { name, description }) {
  const stmt = db.prepare(
    "INSERT INTO symposiums (name, description, created_at) VALUES (?, ?, datetime('now')) RETURNING *"
  );
  return await stmt.get(name, description);
}

async function getConsultants(db, symposiumId) {
  const stmt = db.prepare("SELECT * FROM consultants WHERE symposium_id = ? ORDER BY created_at");
  return await stmt.all(symposiumId);
}

async function createConsultant(db, { symposium_id, name, model, system_prompt, consultant_type = 'standard' }) {
  const stmt = db.prepare(
    "INSERT INTO consultants (symposium_id, name, model, system_prompt, consultant_type, created_at) VALUES (?, ?, ?, ?, ?, datetime('now')) RETURNING *"
  );
  return await stmt.get(symposium_id, name, model, system_prompt, consultant_type);
}

async function deleteConsultant(db, consultantId) {
  if (!consultantId || isNaN(consultantId)) {
    throw new Error('Valid consultant ID is required');
  }

  // Check if consultant exists
  const consultant = await db.prepare("SELECT * FROM consultants WHERE id = ?").get(consultantId);
  if (!consultant) {
    throw new Error('Consultant not found');
  }

  // Delete the consultant (CASCADE will handle related records)
  const stmt = db.prepare("DELETE FROM consultants WHERE id = ?");
  const result = await stmt.run(consultantId);

  if (result.changes === 0) {
    throw new Error('Failed to delete consultant');
  }

  return {
    success: true,
    deletedConsultant: consultant
  };
}

function getMessages(db, symposiumId) {
  const stmt = db.prepare(`
    SELECT m.*, c.name as consultant_name,
           mv.consultant_id as visibility_consultant_id,
           mv.is_hidden
    FROM messages m
    LEFT JOIN consultants c ON m.consultant_id = c.id
    LEFT JOIN message_visibility mv ON m.id = mv.message_id
    WHERE m.symposium_id = ?
    ORDER BY m.timestamp, mv.consultant_id
    LIMIT 100
  `);
  const rows = stmt.all(symposiumId);

  // Group visibility data by message
  const messages = [];
  const messageMap = new Map();

  rows.forEach(row => {
    const messageId = row.id;
    if (!messageMap.has(messageId)) {
      // Create message object without visibility fields
      const message = { ...row };
      delete message.visibility_consultant_id;
      delete message.is_hidden;

      // Add visibility array
      message.visibility = [];
      messages.push(message);
      messageMap.set(messageId, message);
    }

    // Add visibility data if it exists
    if (row.visibility_consultant_id !== null) {
      messageMap.get(messageId).visibility.push({
        consultant_id: row.visibility_consultant_id,
        is_hidden: row.is_hidden === 1
      });
    }
  });

  return messages;
}

function createMessage(db, { symposium_id, consultant_id, content, is_user }) {
  const stmt = db.prepare(
    "INSERT INTO messages (symposium_id, consultant_id, content, is_user, timestamp) VALUES (?, ?, ?, ?, datetime('now')) RETURNING *"
  );
  return stmt.get(symposium_id, consultant_id, content, is_user ? 1 : 0);
}

function toggleMessageVisibility(db, { message_id, consultant_id, is_hidden }) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO message_visibility (message_id, consultant_id, is_hidden) 
    VALUES (?, ?, ?)
  `);
  stmt.run(message_id, consultant_id, is_hidden ? 1 : 0);
  return { success: true };
}

function clearMessages(db, { symposium_id }) {
  // First delete message visibility records to avoid orphaned records
  const deleteVisibilityStmt = db.prepare(`
    DELETE FROM message_visibility
    WHERE message_id IN (
      SELECT id FROM messages WHERE symposium_id = ?
    )
  `);
  deleteVisibilityStmt.run(symposium_id);

  // Then delete all messages for the symposium
  const deleteMessagesStmt = db.prepare("DELETE FROM messages WHERE symposium_id = ?");
  const result = deleteMessagesStmt.run(symposium_id);

  return {
    success: true,
    deletedCount: result.changes
  };
}

// Unified handleChat using the new consultant framework
async function handleChat(db, { symposium_id, consultant_id, message }) {
  // Get symposium details
  const symposium = db.prepare("SELECT * FROM symposiums WHERE id = ?").get(symposium_id);
  
  // Get consultant details
  const consultantData = db.prepare("SELECT * FROM consultants WHERE id = ?").get(consultant_id);
  
  // Create user message
  const userMessage = createMessage(db, {
    symposium_id,
    consultant_id,
    content: message,
    is_user: true
  });

  try {
    // Create consultant instance using the factory
    const consultant = await ConsultantFactory.createConsultant(db, consultantData);
    
    // Get visible messages for context
    const visibleMessages = db.prepare(`
      SELECT m.*, c.name as consultant_name
      FROM messages m
      LEFT JOIN consultants c ON m.consultant_id = c.id
      LEFT JOIN message_visibility mv ON m.id = mv.message_id AND mv.consultant_id = ?
      WHERE m.symposium_id = ? AND (mv.is_hidden IS NULL OR mv.is_hidden = 0)
      ORDER BY m.timestamp
      LIMIT 50
    `).all(consultant_id, symposium_id);

    // Build context
    const context = buildContext(db, symposium, consultantData, visibleMessages, message);
    
    // Process message using the standardized consultant framework
    const response = await consultant.processMessage(message, context);
    
    // Save assistant response
    const assistantMessage = createMessage(db, {
      symposium_id,
      consultant_id,
      content: response,
      is_user: false
    });

    return {
      userMessage,
      assistantMessage,
      response
    };

  } catch (error) {
    console.error('Error in unified chat handler:', error);
    const errorResponse = `I encountered an error while processing your request: ${error.message}`;
    
    const assistantMessage = createMessage(db, {
      symposium_id,
      consultant_id,
      content: errorResponse,
      is_user: false
    });

    return {
      userMessage,
      assistantMessage,
      response: errorResponse
    };
  }
}

async function handleAirtableChat(db, { symposium_id, consultant_id, message }) {
  // Get consultant details
  const consultant = db.prepare("SELECT * FROM consultants WHERE id = ?").get(consultant_id);
  
  // Create user message
  const userMessage = createMessage(db, {
    symposium_id,
    consultant_id,
    content: message,
    is_user: true
  });

  try {
    // Query Airtable using the service
    const result = await airtableService.queryAirtable(consultant_id, message, consultant.model, chatWithOpenRouter);
    
    let response;
    if (result.success) {
      response = result.response;
    } else {
      response = result.error;
    }

    // Save assistant response
    const assistantMessage = createMessage(db, {
      symposium_id,
      consultant_id,
      content: response,
      is_user: false
    });

    return {
      userMessage,
      assistantMessage,
      response,
      airtableData: result.success ? result.data : null
    };

  } catch (error) {
    console.error('Error in Airtable chat:', error);
    const errorResponse = `I encountered an error while querying the database: ${error.message}`;
    
    const assistantMessage = createMessage(db, {
      symposium_id,
      consultant_id,
      content: errorResponse,
      is_user: false
    });

    return {
      userMessage,
      assistantMessage,
      response: errorResponse
    };
  }
}

// Airtable API handlers
async function getAirtableConfig(consultantId) {
  if (!consultantId) {
    throw new Error('Consultant ID is required');
  }
  
  const config = await airtableService.getAirtableConfig(consultantId);
  if (config) {
    // Don't return the API key for security
    return {
      consultant_id: config.consultant_id,
      base_id: config.base_id,
      table_name: config.table_name,
      configured: true
    };
  }
  
  return { configured: false };
}

async function saveAirtableConfig({ consultant_id, base_id, api_key, table_name }) {
  if (!consultant_id || !base_id || !api_key) {
    throw new Error('Consultant ID, Base ID, and API Key are required');
  }
  
  await airtableService.saveAirtableConfig(consultant_id, base_id, api_key, table_name);
  return { success: true };
}

async function testAirtableConnection({ base_id, api_key, table_name }) {
  if (!base_id || !api_key) {
    throw new Error('Base ID and API Key are required');
  }
  
  return await airtableService.testAirtableConnection(base_id, api_key, table_name);
}

async function getAirtableTables({ base_id, api_key }) {
  if (!base_id || !api_key) {
    throw new Error('Base ID and API Key are required');
  }
  
  return await airtableService.getAvailableTables(base_id, api_key);
}

// Consultant Template and Configuration API handlers
async function getConsultantTemplates(db) {
  const templateManager = new ConsultantTemplateManager(db);
  return await templateManager.getTemplates();
}

async function getConsultantConfig(db, consultantId) {
  if (!consultantId) {
    throw new Error('Consultant ID is required');
  }
  
  const configManager = new ConsultantConfigManager(db);
  const config = await configManager.getApiConfig(consultantId);
  
  if (config) {
    // Don't return sensitive data, just indicate it's configured
    return {
      consultant_id: consultantId,
      api_type: config.api_type,
      configured: true,
      config_fields: Object.keys(config.config)
    };
  }
  
  return { configured: false };
}

async function saveConsultantConfig(db, { consultant_id, api_type, config }) {
  if (!consultant_id || !api_type || !config) {
    throw new Error('Consultant ID, API type, and configuration are required');
  }
  
  const configManager = new ConsultantConfigManager(db);
  await configManager.saveApiConfig(consultant_id, api_type, config);
  
  return { success: true };
}

// Knowledge Base Card operations (now global)
function getKnowledgeBaseCards(db, symposiumId = null) {
  // Return global knowledge base cards
  const stmt = db.prepare(`
    SELECT kb.*, m.content as source_message_content, c.name as source_consultant_name
    FROM knowledge_base_cards kb
    LEFT JOIN messages m ON kb.source_message_id = m.id
    LEFT JOIN consultants c ON m.consultant_id = c.id
    WHERE kb.is_global = 1
    ORDER BY kb.created_at DESC
  `);
  return stmt.all();
}

function createKnowledgeBaseCard(db, { symposium_id = null, title, content, card_type = 'user_created', source_message_id = null }) {
  const stmt = db.prepare(`
    INSERT INTO knowledge_base_cards (symposium_id, title, content, card_type, source_message_id, is_global, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    RETURNING *
  `);
  return stmt.get(symposium_id, title, content, card_type, source_message_id);
}

function createCardFromMessage(db, { symposium_id, message_id, title }) {
  // Get the message content
  const message = db.prepare("SELECT * FROM messages WHERE id = ?").get(message_id);
  if (!message) {
    throw new Error('Message not found');
  }

  // Create card with message content
  const stmt = db.prepare(`
    INSERT INTO knowledge_base_cards (symposium_id, title, content, card_type, source_message_id, created_at, updated_at)
    VALUES (?, ?, ?, 'consultant_response', ?, datetime('now'), datetime('now'))
    RETURNING *
  `);
  return stmt.get(symposium_id, title, message.content, message_id);
}

function updateKnowledgeBaseCard(db, cardId, { title, content }) {
  const stmt = db.prepare(`
    UPDATE knowledge_base_cards 
    SET title = ?, content = ?, updated_at = datetime('now')
    WHERE id = ?
    RETURNING *
  `);
  const result = stmt.get(title, content, cardId);
  if (!result) {
    throw new Error('Card not found');
  }
  return result;
}

function deleteKnowledgeBaseCard(db, cardId) {
  const stmt = db.prepare("DELETE FROM knowledge_base_cards WHERE id = ?");
  const result = stmt.run(cardId);
  if (result.changes === 0) {
    throw new Error('Card not found');
  }
  return { success: true };
}

function toggleCardVisibility(db, { card_id, is_visible }) {
  const stmt = db.prepare(`
    UPDATE knowledge_base_cards 
    SET is_visible = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(is_visible ? 1 : 0, card_id);
  if (result.changes === 0) {
    throw new Error('Card not found');
  }
  return { success: true };
}

// Message edit and delete operations
function editMessage(db, messageId, { content }) {
  if (!messageId || isNaN(messageId)) {
    throw new Error('Valid message ID is required');
  }
  
  if (!content || content.trim() === '') {
    throw new Error('Message content is required');
  }

  // Check if message exists
  const message = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
  if (!message) {
    throw new Error('Message not found');
  }

  // Update the message content and set updated_at timestamp
  const stmt = db.prepare(`
    UPDATE messages 
    SET content = ?, updated_at = datetime('now')
    WHERE id = ?
    RETURNING *
  `);
  const result = stmt.get(content.trim(), messageId);
  
  if (!result) {
    throw new Error('Failed to update message');
  }

  return {
    success: true,
    message: result
  };
}

function deleteMessage(db, messageId) {
  if (!messageId || isNaN(messageId)) {
    throw new Error('Valid message ID is required');
  }

  // Check if message exists
  const message = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
  if (!message) {
    throw new Error('Message not found');
  }

  // Delete message visibility records first (CASCADE should handle this, but being explicit)
  const deleteVisibilityStmt = db.prepare("DELETE FROM message_visibility WHERE message_id = ?");
  deleteVisibilityStmt.run(messageId);

  // Delete the message (knowledge base cards will have their source_message_id set to NULL due to ON DELETE SET NULL)
  const deleteMessageStmt = db.prepare("DELETE FROM messages WHERE id = ?");
  const result = deleteMessageStmt.run(messageId);

  if (result.changes === 0) {
    throw new Error('Failed to delete message');
  }

  return {
    success: true,
    deletedMessage: message
  };
}

function buildContext(db, symposium, consultant, messages, userMessage) {
  let context = `You are participating in a symposium called "${symposium.name}". `;
  context += `Symposium description: ${symposium.description}\n\n`;
  
  // Add task progress context
  const tasks = db.prepare(`
    SELECT title, description, is_completed, order_index 
    FROM symposium_tasks 
    WHERE symposium_id = ? 
    ORDER BY order_index
  `).all(symposium.id);
  
  if (tasks.length > 0) {
    context += "Mission Progress:\n";
    tasks.forEach(task => {
      const status = task.is_completed ? "[✓]" : "[ ]";
      context += `${status} ${task.title}`;
      if (task.description) {
        context += ` - ${task.description}`;
      }
      context += "\n";
    });
    context += "\n";
  }
  
  context += `Your role as a consultant: ${consultant.system_prompt}\n\n`;
  
  // Add global knowledge base context (now decoupled from symposiums)
  const knowledgeBaseCards = db.prepare(`
    SELECT title, content FROM knowledge_base_cards 
    WHERE is_visible = 1 AND is_global = 1
    ORDER BY created_at
  `).all();
  
  if (knowledgeBaseCards.length > 0) {
    context += "Knowledge Base Context:\n";
    knowledgeBaseCards.forEach(card => {
      context += `${card.title}: ${card.content}\n`;
    });
    context += "\n";
  }
  
  if (messages.length > 0) {
    context += "Previous conversation history:\n";
    messages.forEach(msg => {
      const speaker = msg.is_user ? "User" : (msg.consultant_name || "Assistant");
      context += `${speaker}: ${msg.content}\n`;
    });
    context += "\n";
  }
  
  context += `Current user message: ${userMessage}`;
  
  return context;
}

// Symposium Task operations
function getSymposiumTasks(db, symposiumId) {
  if (!symposiumId) {
    throw new Error('Symposium ID is required');
  }
  
  const stmt = db.prepare(`
    SELECT * FROM symposium_tasks 
    WHERE symposium_id = ? 
    ORDER BY order_index, created_at
  `);
  return stmt.all(symposiumId);
}

function createSymposiumTask(db, { symposium_id, title, description = null, order_index = null }) {
  if (!symposium_id || !title) {
    throw new Error('Symposium ID and title are required');
  }
  
  // If no order_index provided, get the next available index
  if (order_index === null) {
    const maxOrderStmt = db.prepare(`
      SELECT COALESCE(MAX(order_index), -1) + 1 as next_order 
      FROM symposium_tasks 
      WHERE symposium_id = ?
    `);
    const result = maxOrderStmt.get(symposium_id);
    order_index = result.next_order;
  }
  
  const stmt = db.prepare(`
    INSERT INTO symposium_tasks (symposium_id, title, description, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    RETURNING *
  `);
  return stmt.get(symposium_id, title, description, order_index);
}

function updateSymposiumTask(db, taskId, { title, description, is_completed }) {
  if (!taskId || isNaN(taskId)) {
    throw new Error('Valid task ID is required');
  }
  
  // Check if task exists
  const task = db.prepare("SELECT * FROM symposium_tasks WHERE id = ?").get(taskId);
  if (!task) {
    throw new Error('Task not found');
  }
  
  const stmt = db.prepare(`
    UPDATE symposium_tasks 
    SET title = COALESCE(?, title), 
        description = COALESCE(?, description), 
        is_completed = COALESCE(?, is_completed),
        updated_at = datetime('now')
    WHERE id = ?
    RETURNING *
  `);
  
  // Handle undefined values by passing null instead
  const result = stmt.get(
    title !== undefined ? title : null, 
    description !== undefined ? description : null, 
    is_completed !== undefined ? (is_completed ? 1 : 0) : null, 
    taskId
  );
  
  if (!result) {
    throw new Error('Failed to update task');
  }
  
  return {
    success: true,
    task: result
  };
}

function deleteSymposiumTask(db, taskId) {
  if (!taskId || isNaN(taskId)) {
    throw new Error('Valid task ID is required');
  }
  
  // Check if task exists
  const task = db.prepare("SELECT * FROM symposium_tasks WHERE id = ?").get(taskId);
  if (!task) {
    throw new Error('Task not found');
  }
  
  const stmt = db.prepare("DELETE FROM symposium_tasks WHERE id = ?");
  const result = stmt.run(taskId);
  
  if (result.changes === 0) {
    throw new Error('Failed to delete task');
  }
  
  return {
    success: true,
    deletedTask: task
  };
}

function reorderSymposiumTasks(db, { symposium_id, task_orders }) {
  if (!symposium_id || !Array.isArray(task_orders)) {
    throw new Error('Symposium ID and task orders array are required');
  }
  
  // Update each task's order_index
  const updateStmt = db.prepare(`
    UPDATE symposium_tasks 
    SET order_index = ?, updated_at = datetime('now')
    WHERE id = ? AND symposium_id = ?
  `);
  
  task_orders.forEach(({ task_id, order_index }) => {
    updateStmt.run(order_index, task_id, symposium_id);
  });
  
  return { success: true };
}

// Task generation using LLM
async function generateTasksFromDescription({ description }) {
  if (!description || description.trim() === '') {
    throw new Error('Description is required for task generation');
  }
  
  const prompt = `Based on the following symposium description, generate 5-8 specific, actionable tasks that would help accomplish the symposium's goals. Each task should be clear, measurable, and contribute to the overall mission.

Symposium Description: "${description}"

Please respond with a JSON array of tasks, where each task has a "title" (brief, actionable) and "description" (more detailed explanation). Format:

[
  {
    "title": "Task title here",
    "description": "Detailed description of what needs to be done"
  }
]

Focus on creating tasks that are:
- Specific and actionable
- Logically ordered (if there are dependencies)
- Realistic and achievable
- Directly related to the symposium's purpose`;

  try {
    const response = await chatWithOpenRouter("openai/gpt-4o", prompt);
    
    // Try to parse the JSON response
    let tasks;
    try {
      // Extract JSON from response if it's wrapped in markdown or other text
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      tasks = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', parseError);
      // Fallback: create basic tasks from description
      tasks = [
        {
          title: "Define project scope and objectives",
          description: "Clearly outline what needs to be accomplished based on the symposium description"
        },
        {
          title: "Research and gather information",
          description: "Collect relevant data and insights related to the symposium topic"
        },
        {
          title: "Develop action plan",
          description: "Create a detailed plan for achieving the symposium goals"
        },
        {
          title: "Execute primary activities",
          description: "Carry out the main work required for the symposium"
        },
        {
          title: "Review and refine outcomes",
          description: "Evaluate results and make necessary improvements"
        }
      ];
    }
    
    // Validate the tasks array
    if (!Array.isArray(tasks)) {
      throw new Error('Generated tasks must be an array');
    }
    
    // Ensure each task has required fields
    const validatedTasks = tasks.map((task, index) => ({
      title: task.title || `Task ${index + 1}`,
      description: task.description || 'No description provided'
    }));
    
    return {
      success: true,
      tasks: validatedTasks
    };
    
  } catch (error) {
    console.error('Error generating tasks:', error);
    return {
      success: false,
      error: error.message,
      // Provide fallback tasks
      tasks: [
        {
          title: "Plan and organize symposium activities",
          description: "Develop a comprehensive plan for achieving the symposium objectives"
        },
        {
          title: "Execute core symposium work",
          description: "Carry out the primary activities needed to fulfill the symposium mission"
        },
        {
          title: "Monitor progress and adjust",
          description: "Track advancement and make necessary adjustments to stay on course"
        },
        {
          title: "Complete and document outcomes",
          description: "Finalize all work and document the results and learnings"
        }
      ]
    };
  }
}

console.log("Starting Symposium server on http://localhost:8000");
await serve(handler, { port: 8000 });
