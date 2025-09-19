import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.208.0/http/file_server.ts";
import { Database } from "https://deno.land/x/sqlite3@0.11.1/mod.ts";
import { initDatabase } from "./database.js";
import { getOpenRouterModels, getOpenRouterAuth, chatWithOpenRouter } from "./openrouter.js";
import { seedDatabase } from "./seed-data.js";

const db = new Database("symposium.db");
await initDatabase(db);
await seedDatabase(db);

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

    default:
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

function createConsultant(db, { symposium_id, name, model, system_prompt }) {
  const stmt = db.prepare(
    "INSERT INTO consultants (symposium_id, name, model, system_prompt, created_at) VALUES (?, ?, ?, ?, datetime('now')) RETURNING *"
  );
  return stmt.get(symposium_id, name, model, system_prompt);
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

async function handleChat(db, { symposium_id, consultant_id, message }) {
  // Get symposium details
  const symposium = db.prepare("SELECT * FROM symposiums WHERE id = ?").get(symposium_id);
  
  // Get consultant details
  const consultant = db.prepare("SELECT * FROM consultants WHERE id = ?").get(consultant_id);
  
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
  const context = buildContext(symposium, consultant, visibleMessages, message);
  
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

function buildContext(symposium, consultant, messages, userMessage) {
  let context = `You are participating in a symposium called "${symposium.name}". `;
  context += `Symposium description: ${symposium.description}\n\n`;
  context += `Your role as a consultant: ${consultant.system_prompt}\n\n`;
  
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
