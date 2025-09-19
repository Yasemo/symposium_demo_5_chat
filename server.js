import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.208.0/http/file_server.ts";
import { Database } from "https://deno.land/x/sqlite3@0.11.1/mod.ts";
import { initDatabase } from "./database.js";
import { getOpenRouterModels, getOpenRouterAuth, chatWithOpenRouter } from "./openrouter.js";
import { seedDatabase } from "./seed-data.js";
import { AirtableService } from "./airtable-client.js";

const db = new Database("symposium.db");
await initDatabase(db);
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
        return getSymposiums(db);
      } else if (method === "POST") {
        const body = await req.json();
        return createSymposium(db, body);
      }
      break;

    case "/consultants":
      if (method === "GET") {
        const symposiumId = url.searchParams.get("symposium_id");
        return getConsultants(db, symposiumId);
      } else if (method === "POST") {
        const body = await req.json();
        return createConsultant(db, body);
      }
      break;

    case "/messages":
      if (method === "GET") {
        const symposiumId = url.searchParams.get("symposium_id");
        return getMessages(db, symposiumId);
      } else if (method === "POST") {
        const body = await req.json();
        return createMessage(db, body);
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
      throw new Error("Not found");
  }
}

// Database operations
function getSymposiums(db) {
  const stmt = db.prepare("SELECT * FROM symposiums ORDER BY created_at DESC");
  return stmt.all();
}

function createSymposium(db, { name, description }) {
  const stmt = db.prepare(
    "INSERT INTO symposiums (name, description, created_at) VALUES (?, ?, datetime('now')) RETURNING *"
  );
  return stmt.get(name, description);
}

function getConsultants(db, symposiumId) {
  const stmt = db.prepare("SELECT * FROM consultants WHERE symposium_id = ? ORDER BY created_at");
  return stmt.all(symposiumId);
}

function createConsultant(db, { symposium_id, name, model, system_prompt, consultant_type = 'standard' }) {
  const stmt = db.prepare(
    "INSERT INTO consultants (symposium_id, name, model, system_prompt, consultant_type, created_at) VALUES (?, ?, ?, ?, ?, datetime('now')) RETURNING *"
  );
  return stmt.get(symposium_id, name, model, system_prompt, consultant_type);
}

function deleteConsultant(db, consultantId) {
  if (!consultantId || isNaN(consultantId)) {
    throw new Error('Valid consultant ID is required');
  }

  // Check if consultant exists
  const consultant = db.prepare("SELECT * FROM consultants WHERE id = ?").get(consultantId);
  if (!consultant) {
    throw new Error('Consultant not found');
  }

  // Delete the consultant (CASCADE will handle related records)
  const stmt = db.prepare("DELETE FROM consultants WHERE id = ?");
  const result = stmt.run(consultantId);

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

// Enhanced handleChat to support Airtable consultants
async function handleChat(db, { symposium_id, consultant_id, message }) {
  // Get symposium details
  const symposium = db.prepare("SELECT * FROM symposiums WHERE id = ?").get(symposium_id);
  
  // Get consultant details
  const consultant = db.prepare("SELECT * FROM consultants WHERE id = ?").get(consultant_id);
  
  // Check if this is an Airtable consultant
  if (consultant.consultant_type === 'airtable') {
    return await handleAirtableChat(db, { symposium_id, consultant_id, message });
  }
  
  // Get visible messages for this consultant
  const visibleMessages = db.prepare(`
    SELECT m.*, c.name as consultant_name
    FROM messages m
    LEFT JOIN consultants c ON m.consultant_id = c.id
    LEFT JOIN message_visibility mv ON m.id = mv.message_id AND mv.consultant_id = ?
    WHERE m.symposium_id = ? AND (mv.is_hidden IS NULL OR mv.is_hidden = 0)
    ORDER BY m.timestamp
    LIMIT 50
  `).all(consultant_id, symposium_id);

  // Create user message
  const userMessage = createMessage(db, {
    symposium_id,
    consultant_id,
    content: message,
    is_user: true
  });

  // Build context for OpenRouter
  const context = buildContext(db, symposium, consultant, visibleMessages, message);
  
  // Get response from OpenRouter
  const response = await chatWithOpenRouter(consultant.model, context);
  
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

// Knowledge Base Card operations
function getKnowledgeBaseCards(db, symposiumId) {
  const stmt = db.prepare(`
    SELECT kb.*, m.content as source_message_content, c.name as source_consultant_name
    FROM knowledge_base_cards kb
    LEFT JOIN messages m ON kb.source_message_id = m.id
    LEFT JOIN consultants c ON m.consultant_id = c.id
    WHERE kb.symposium_id = ?
    ORDER BY kb.created_at DESC
  `);
  return stmt.all(symposiumId);
}

function createKnowledgeBaseCard(db, { symposium_id, title, content, card_type = 'user_created', source_message_id = null }) {
  const stmt = db.prepare(`
    INSERT INTO knowledge_base_cards (symposium_id, title, content, card_type, source_message_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
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
  context += `Your role as a consultant: ${consultant.system_prompt}\n\n`;
  
  // Add knowledge base context
  const knowledgeBaseCards = db.prepare(`
    SELECT title, content FROM knowledge_base_cards 
    WHERE symposium_id = ? AND is_visible = 1 
    ORDER BY created_at
  `).all(symposium.id);
  
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

console.log("Starting Symposium server on http://localhost:8000");
await serve(handler, { port: 8000 });
