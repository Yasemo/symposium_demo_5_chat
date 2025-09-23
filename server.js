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

    case "/tags":
      if (method === "GET") {
        return getTags(db);
      } else if (method === "POST") {
        const body = await req.json();
        return createTag(db, body);
      }
      break;

    case "/cards/by-tags":
      if (method === "POST") {
        const body = await req.json();
        return getCardsByTags(db, body);
      }
      break;

    case "/selected-tags":
      if (method === "GET") {
        const symposiumId = url.searchParams.get("symposium_id");
        const objectiveId = url.searchParams.get("objective_id");
        return getSelectedTags(db, symposiumId, objectiveId);
      } else if (method === "POST") {
        const body = await req.json();
        return setSelectedTags(db, body);
      }
      break;

    case "/objectives":
      if (method === "GET") {
        const symposiumId = url.searchParams.get("symposium_id");
        return await getObjectives(db, symposiumId);
      } else if (method === "POST") {
        const body = await req.json();
        return await createObjective(db, body);
      }
      break;

    case "/objective-tasks":
      if (method === "GET") {
        const objectiveId = url.searchParams.get("objective_id");
        return getObjectiveTasks(db, objectiveId);
      } else if (method === "POST") {
        const body = await req.json();
        return createObjectiveTask(db, body);
      }
      break;

    case "/generate-symposium-structure":
      if (method === "POST") {
        const body = await req.json();
        return generateSymposiumStructure(body);
      }
      break;

    case "/regenerate-symposium-structure":
      if (method === "POST") {
        const body = await req.json();
        return regenerateSymposiumStructure(body);
      }
      break;

    case "/generate-tasks":
      if (method === "POST") {
        const body = await req.json();
        return generateTasksFromDescription(body);
      }
      break;


    case "/populate-form":
      if (method === "POST") {
        const body = await req.json();
        return populateFormWithLLM(db, body);
      }
      break;

    case "/execute-consultant-query":
      if (method === "POST") {
        const body = await req.json();
        return executeConsultantQuery(db, body);
      }
      break;

    case "/consultant-table-schema":
      if (method === "POST") {
        const body = await req.json();
        return getConsultantTableSchema(db, body);
      }
      break;

    default:
      // Handle consultant form schema with ID in path
      if (path.startsWith("/consultant-form-schema/") && path.split("/").length === 3) {
        const consultantId = path.split("/")[2];
        if (method === "GET") {
          return getConsultantFormSchema(db, consultantId);
        }
      }
      // Handle consultant context with ID in path
      if (path.startsWith("/consultant-context/") && path.split("/").length === 3) {
        const consultantId = path.split("/")[2];
        if (method === "GET") {
          return getConsultantContext(db, consultantId);
        }
      }
      // Handle consultant operations with ID in path
      if (path.startsWith("/consultants/") && path.split("/").length === 3) {
        const consultantId = path.split("/")[2];
        if (method === "DELETE") {
          return deleteConsultant(db, consultantId);
        } else if (method === "PUT") {
          const body = await req.json();
          return updateConsultant(db, consultantId, body);
        }
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
      // Handle objective operations with ID in path
      if (path.startsWith("/objectives/") && path.split("/").length === 3) {
        const objectiveId = path.split("/")[2];
        if (method === "PUT") {
          const body = await req.json();
          return updateObjective(db, objectiveId, body);
        } else if (method === "DELETE") {
          return deleteObjective(db, objectiveId);
        }
      }
      // Handle objective task operations with ID in path
      if (path.startsWith("/objective-tasks/") && path.split("/").length === 3) {
        const taskId = path.split("/")[2];
        if (method === "PUT") {
          const body = await req.json();
          return updateObjectiveTask(db, taskId, body);
        } else if (method === "DELETE") {
          return deleteObjectiveTask(db, taskId);
        }
      }
      // Handle objective task reordering
      if (path === "/objective-tasks/reorder" && method === "PUT") {
        const body = await req.json();
        return reorderObjectiveTasks(db, body);
      }
      // Handle tag operations with ID in path
      if (path.startsWith("/tags/") && path.split("/").length === 3) {
        const tagId = path.split("/")[2];
        if (method === "PUT") {
          const body = await req.json();
          return updateTag(db, tagId, body);
        } else if (method === "DELETE") {
          return deleteTag(db, tagId);
        }
      }
      // Handle card tag operations
      if (path.startsWith("/cards/") && path.split("/").length === 5 && path.split("/")[3] === "tags") {
        const cardId = path.split("/")[2];
        const tagId = path.split("/")[4];
        console.log(`Card tag operation: ${method} ${path}, cardId: ${cardId}, tagId: ${tagId}`);
        if (method === "POST") {
          return addTagToCard(db, cardId, tagId);
        } else if (method === "DELETE") {
          return removeTagFromCard(db, cardId, tagId);
        }
      }
      // Handle getting tags for a card
      if (path.startsWith("/cards/") && path.split("/").length === 4 && path.split("/")[3] === "tags") {
        const cardId = path.split("/")[2];
        console.log(`Card tags operation: ${method} ${path}, cardId: ${cardId}`);
        if (method === "GET") {
          return getCardTags(db, cardId);
        } else if (method === "POST") {
          const body = await req.json();
          return setCardTags(db, cardId, body);
        }
      }
      // Handle symposium operations with ID in path
      if (path.startsWith("/symposiums/") && path.split("/").length === 3) {
        const symposiumId = path.split("/")[2];
        if (method === "PUT") {
          const body = await req.json();
          return updateSymposium(db, symposiumId, body);
        } else if (method === "DELETE") {
          return deleteSymposium(db, symposiumId);
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
  const symposium = await stmt.get(name, description);
  
  // Create default conversational consultant for the symposium
  await createDefaultConsultant(db, symposium.id);
  
  return symposium;
}

async function createDefaultConsultant(db, symposiumId) {
  const stmt = db.prepare(`
    INSERT INTO consultants (symposium_id, name, model, system_prompt, consultant_type, is_default, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  
  return stmt.run(
    symposiumId,
    "Chat Assistant",
    "openai/gpt-4o",
    "You are a helpful AI assistant. Provide thoughtful, accurate responses to user questions and engage in meaningful conversations. You can help with analysis, brainstorming, problem-solving, and general discussion.",
    "pure_llm",
    1
  );
}

async function updateSymposium(db, symposiumId, { name, description }) {
  if (!symposiumId || isNaN(symposiumId)) {
    throw new Error('Valid symposium ID is required');
  }

  if (!name || !description) {
    throw new Error('Name and description are required');
  }

  // Check if symposium exists
  const symposium = db.prepare("SELECT * FROM symposiums WHERE id = ?").get(symposiumId);
  if (!symposium) {
    throw new Error('Symposium not found');
  }

  // Update the symposium
  const stmt = db.prepare(`
    UPDATE symposiums 
    SET name = ?, description = ?
    WHERE id = ?
    RETURNING *
  `);
  const result = stmt.get(name, description, symposiumId);

  if (!result) {
    throw new Error('Failed to update symposium');
  }

  return {
    success: true,
    symposium: result
  };
}

async function deleteSymposium(db, symposiumId) {
  if (!symposiumId || isNaN(symposiumId)) {
    throw new Error('Valid symposium ID is required');
  }

  // Check if symposium exists
  const symposium = db.prepare("SELECT * FROM symposiums WHERE id = ?").get(symposiumId);
  if (!symposium) {
    throw new Error('Symposium not found');
  }

  // Delete the symposium (CASCADE will handle related records)
  const stmt = db.prepare("DELETE FROM symposiums WHERE id = ?");
  const result = stmt.run(symposiumId);

  if (result.changes === 0) {
    throw new Error('Failed to delete symposium');
  }

  return {
    success: true,
    deletedSymposium: symposium
  };
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

async function updateConsultant(db, consultantId, { name, model, system_prompt }) {
  if (!consultantId || isNaN(consultantId)) {
    throw new Error('Valid consultant ID is required');
  }

  if (!name || !model || !system_prompt) {
    throw new Error('Name, model, and system prompt are required');
  }

  // Check if consultant exists
  const consultant = db.prepare("SELECT * FROM consultants WHERE id = ?").get(consultantId);
  if (!consultant) {
    throw new Error('Consultant not found');
  }

  // Update the consultant
  const stmt = db.prepare(`
    UPDATE consultants 
    SET name = ?, model = ?, system_prompt = ?
    WHERE id = ?
    RETURNING *
  `);
  const result = stmt.get(name, model, system_prompt, consultantId);

  if (!result) {
    throw new Error('Failed to update consultant');
  }

  return {
    success: true,
    consultant: result
  };
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

function getMessages(db, symposiumId, objectiveId = null) {
  let query = `
    SELECT m.*, c.name as consultant_name,
           mv.consultant_id as visibility_consultant_id,
           mv.is_hidden
    FROM messages m
    LEFT JOIN consultants c ON m.consultant_id = c.id
    LEFT JOIN message_visibility mv ON m.id = mv.message_id
    WHERE m.symposium_id = ?`;
  
  const params = [symposiumId];
  
  if (objectiveId) {
    query += ` AND m.objective_id = ?`;
    params.push(objectiveId);
  }
  
  query += ` ORDER BY m.timestamp, mv.consultant_id LIMIT 100`;
  
  const stmt = db.prepare(query);
  const rows = stmt.all(...params);

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

function createMessage(db, { symposium_id, consultant_id, objective_id = null, content, is_user }) {
  const stmt = db.prepare(
    "INSERT INTO messages (symposium_id, consultant_id, objective_id, content, is_user, timestamp) VALUES (?, ?, ?, ?, ?, datetime('now')) RETURNING *"
  );
  return stmt.get(symposium_id, consultant_id, objective_id, content, is_user ? 1 : 0);
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
async function handleChat(db, { symposium_id, consultant_id, objective_id = null, message, selected_tag_ids = [] }) {
  // Get symposium details
  const symposium = db.prepare("SELECT * FROM symposiums WHERE id = ?").get(symposium_id);
  
  // Get consultant details
  const consultantData = db.prepare("SELECT * FROM consultants WHERE id = ?").get(consultant_id);
  
  // Get objective details if provided
  let objective = null;
  if (objective_id) {
    objective = db.prepare("SELECT * FROM objectives WHERE id = ?").get(objective_id);
  }
  
  // Create user message
  const userMessage = createMessage(db, {
    symposium_id,
    consultant_id,
    objective_id,
    content: message,
    is_user: true
  });

  try {
    // Create consultant instance using the factory
    const consultant = await ConsultantFactory.createConsultant(db, consultantData);
    
    // Get visible messages for context (filtered by objective if provided)
    let visibleMessagesQuery = `
      SELECT m.*, c.name as consultant_name
      FROM messages m
      LEFT JOIN consultants c ON m.consultant_id = c.id
      LEFT JOIN message_visibility mv ON m.id = mv.message_id AND mv.consultant_id = ?
      WHERE m.symposium_id = ? AND (mv.is_hidden IS NULL OR mv.is_hidden = 0)`;
    
    const queryParams = [consultant_id, symposium_id];
    
    if (objective_id) {
      visibleMessagesQuery += ` AND m.objective_id = ?`;
      queryParams.push(objective_id);
    }
    
    visibleMessagesQuery += ` ORDER BY m.timestamp LIMIT 50`;
    
    const visibleMessages = db.prepare(visibleMessagesQuery).all(...queryParams);

    // Build context with objective information and selected tags
    const context = buildContext(db, symposium, consultantData, visibleMessages, message, objective, selected_tag_ids);
    
    // Log the full system prompt being sent to the LLM
    console.log('\n=== FULL SYSTEM PROMPT SENT TO LLM ===');
    console.log(context);
    console.log('=== END SYSTEM PROMPT ===\n');
    
    // Process message using the standardized consultant framework
    const response = await consultant.processMessage(message, context);
    
    // Save assistant response
    const assistantMessage = createMessage(db, {
      symposium_id,
      consultant_id,
      objective_id,
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
      objective_id,
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
    INSERT INTO knowledge_base_cards (symposium_id, title, content, card_type, source_message_id, is_visible, is_global, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, 1, datetime('now'), datetime('now'))
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

  // Create card with message content - default to hidden (is_visible = 0)
  const stmt = db.prepare(`
    INSERT INTO knowledge_base_cards (symposium_id, title, content, card_type, source_message_id, is_visible, is_global, created_at, updated_at)
    VALUES (?, ?, ?, 'consultant_response', ?, 0, 1, datetime('now'), datetime('now'))
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

function buildContext(db, symposium, consultant, messages, userMessage, objective = null, selectedTagIds = []) {
  let context = `You are participating in a symposium called "${symposium.name}". `;
  context += `Symposium description: ${symposium.description}\n\n`;
  
  // Add objective-specific context if provided
  if (objective) {
    context += `Current Objective: "${objective.title}"\n`;
    context += `Objective Description: ${objective.description}\n\n`;
    
    // Add objective-specific task progress
    const tasks = db.prepare(`
      SELECT title, description, is_completed, order_index 
      FROM objective_tasks 
      WHERE objective_id = ? 
      ORDER BY order_index
    `).all(objective.id);
    
    if (tasks.length > 0) {
      context += "Mission Progress for Current Objective:\n";
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
  }
  
  // Collect all relevant knowledge base cards
  let allRelevantCards = [];
  
  // Get manually visible cards
  const visibleCards = db.prepare(`
    SELECT kb.*, m.content as source_message_content, c.name as source_consultant_name
    FROM knowledge_base_cards kb
    LEFT JOIN messages m ON kb.source_message_id = m.id
    LEFT JOIN consultants c ON m.consultant_id = c.id
    WHERE kb.is_visible = 1 AND kb.is_global = 1
    ORDER BY kb.created_at
  `).all();
  
  allRelevantCards = [...visibleCards];
  
  // Get tagged cards if tags are selected
  if (selectedTagIds && selectedTagIds.length > 0) {
    const placeholders = selectedTagIds.map(() => '?').join(',');
    const taggedCards = db.prepare(`
      SELECT DISTINCT kb.*, m.content as source_message_content, c.name as source_consultant_name
      FROM knowledge_base_cards kb
      LEFT JOIN messages m ON kb.source_message_id = m.id
      LEFT JOIN consultants c ON m.consultant_id = c.id
      INNER JOIN card_tags ct ON kb.id = ct.card_id
      WHERE ct.tag_id IN (${placeholders}) AND kb.is_global = 1
      ORDER BY kb.created_at
    `).all(...selectedTagIds);
    
    // Merge tagged cards with visible cards, avoiding duplicates
    const existingCardIds = new Set(allRelevantCards.map(card => card.id));
    taggedCards.forEach(card => {
      if (!existingCardIds.has(card.id)) {
        allRelevantCards.push(card);
      }
    });
  }

  // Add knowledge base context if we have relevant cards
  if (allRelevantCards.length > 0) {
    context += "Knowledge Base Context:\n\n";
    allRelevantCards.forEach((card, index) => {
      context += `--- CARD ${index + 1}: ${card.title} ---\n`;
      context += `Type: ${card.card_type}\n`;
      if (card.source_consultant_name) {
        context += `Source: ${card.source_consultant_name}\n`;
      }
      context += `Created: ${new Date(card.created_at).toLocaleDateString()}\n`;
      context += `Content:\n${card.content}\n\n`;
    });
    context += "\n";
  }
  
  context += `Your role as a consultant: ${consultant.system_prompt}\n\n`;
  
  if (messages.length > 0) {
    context += objective ? "Previous conversation for this objective:\n" : "Previous conversation history:\n";
    messages.forEach(msg => {
      const speaker = msg.is_user ? "User" : (msg.consultant_name || "Assistant");
      context += `${speaker}: ${msg.content}\n`;
    });
    context += "\n";
  }
  
  context += `Current user message: ${userMessage}`;
  
  return context;
}


// Objectives operations
async function getObjectives(db, symposiumId) {
  if (!symposiumId) {
    throw new Error('Symposium ID is required');
  }
  
  const stmt = db.prepare(`
    SELECT * FROM objectives 
    WHERE symposium_id = ? 
    ORDER BY order_index, created_at
  `);
  return stmt.all(symposiumId);
}

async function createObjective(db, { symposium_id, title, description, order_index = null }) {
  if (!symposium_id || !title || !description) {
    throw new Error('Symposium ID, title, and description are required');
  }
  
  // If no order_index provided, get the next available index
  if (order_index === null) {
    const maxOrderStmt = db.prepare(`
      SELECT COALESCE(MAX(order_index), -1) + 1 as next_order 
      FROM objectives 
      WHERE symposium_id = ?
    `);
    const result = maxOrderStmt.get(symposium_id);
    order_index = result.next_order;
  }
  
  const stmt = db.prepare(`
    INSERT INTO objectives (symposium_id, title, description, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    RETURNING *
  `);
  return stmt.get(symposium_id, title, description, order_index);
}

async function updateObjective(db, objectiveId, { title, description }) {
  if (!objectiveId || isNaN(objectiveId)) {
    throw new Error('Valid objective ID is required');
  }

  if (!title || !description) {
    throw new Error('Title and description are required');
  }

  // Check if objective exists
  const objective = db.prepare("SELECT * FROM objectives WHERE id = ?").get(objectiveId);
  if (!objective) {
    throw new Error('Objective not found');
  }

  // Update the objective
  const stmt = db.prepare(`
    UPDATE objectives 
    SET title = ?, description = ?, updated_at = datetime('now')
    WHERE id = ?
    RETURNING *
  `);
  const result = stmt.get(title, description, objectiveId);

  if (!result) {
    throw new Error('Failed to update objective');
  }

  return {
    success: true,
    objective: result
  };
}

async function deleteObjective(db, objectiveId) {
  if (!objectiveId || isNaN(objectiveId)) {
    throw new Error('Valid objective ID is required');
  }

  // Check if objective exists
  const objective = db.prepare("SELECT * FROM objectives WHERE id = ?").get(objectiveId);
  if (!objective) {
    throw new Error('Objective not found');
  }

  // Get count of related messages and tasks for user information
  const messageCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE objective_id = ?").get(objectiveId).count;
  const taskCount = db.prepare("SELECT COUNT(*) as count FROM objective_tasks WHERE objective_id = ?").get(objectiveId).count;

  // Delete the objective (CASCADE will handle related records)
  const stmt = db.prepare("DELETE FROM objectives WHERE id = ?");
  const result = stmt.run(objectiveId);

  if (result.changes === 0) {
    throw new Error('Failed to delete objective');
  }

  return {
    success: true,
    deletedObjective: objective,
    deletedMessages: messageCount,
    deletedTasks: taskCount
  };
}

// Objective Tasks operations
function getObjectiveTasks(db, objectiveId) {
  if (!objectiveId) {
    throw new Error('Objective ID is required');
  }
  
  const stmt = db.prepare(`
    SELECT * FROM objective_tasks 
    WHERE objective_id = ? 
    ORDER BY order_index, created_at
  `);
  return stmt.all(objectiveId);
}

function createObjectiveTask(db, { objective_id, title, description = null, order_index = null }) {
  if (!objective_id || !title) {
    throw new Error('Objective ID and title are required');
  }
  
  // If no order_index provided, get the next available index
  if (order_index === null) {
    const maxOrderStmt = db.prepare(`
      SELECT COALESCE(MAX(order_index), -1) + 1 as next_order 
      FROM objective_tasks 
      WHERE objective_id = ?
    `);
    const result = maxOrderStmt.get(objective_id);
    order_index = result.next_order;
  }
  
  const stmt = db.prepare(`
    INSERT INTO objective_tasks (objective_id, title, description, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    RETURNING *
  `);
  return stmt.get(objective_id, title, description, order_index);
}

function updateObjectiveTask(db, taskId, { title, description, is_completed }) {
  if (!taskId || isNaN(taskId)) {
    throw new Error('Valid task ID is required');
  }
  
  // Check if task exists
  const task = db.prepare("SELECT * FROM objective_tasks WHERE id = ?").get(taskId);
  if (!task) {
    throw new Error('Task not found');
  }
  
  const stmt = db.prepare(`
    UPDATE objective_tasks 
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

function deleteObjectiveTask(db, taskId) {
  if (!taskId || isNaN(taskId)) {
    throw new Error('Valid task ID is required');
  }
  
  // Check if task exists
  const task = db.prepare("SELECT * FROM objective_tasks WHERE id = ?").get(taskId);
  if (!task) {
    throw new Error('Task not found');
  }
  
  const stmt = db.prepare("DELETE FROM objective_tasks WHERE id = ?");
  const result = stmt.run(taskId);
  
  if (result.changes === 0) {
    throw new Error('Failed to delete task');
  }
  
  return {
    success: true,
    deletedTask: task
  };
}

function reorderObjectiveTasks(db, { objective_id, task_orders }) {
  if (!objective_id || !Array.isArray(task_orders)) {
    throw new Error('Objective ID and task orders array are required');
  }
  
  console.log('Reordering objective tasks:', { objective_id, task_orders });
  
  try {
    // Use a transaction to ensure atomicity
    const transaction = db.transaction(() => {
      // Update each task's order_index
      const updateStmt = db.prepare(`
        UPDATE objective_tasks 
        SET order_index = ?, updated_at = datetime('now')
        WHERE id = ? AND objective_id = ?
      `);
      
      let updatedCount = 0;
      task_orders.forEach(({ task_id, order_index }) => {
        console.log(`Updating task ${task_id} to order_index ${order_index}`);
        const result = updateStmt.run(order_index, task_id, objective_id);
        console.log(`Update result:`, result);
        updatedCount += result.changes;
      });
      
      console.log(`Total tasks updated: ${updatedCount}`);
      return updatedCount;
    });
    
    // Execute the transaction
    const updatedCount = transaction();
    
    // Verify the changes by querying the database
    const verifyStmt = db.prepare(`
      SELECT id, title, order_index 
      FROM objective_tasks 
      WHERE objective_id = ? 
      ORDER BY order_index
    `);
    const updatedTasks = verifyStmt.all(objective_id);
    console.log('Updated task order in database:', updatedTasks);
    
    return { success: true, updatedCount, updatedTasks };
    
  } catch (error) {
    console.error('Error in reorderObjectiveTasks:', error);
    throw new Error(`Failed to reorder tasks: ${error.message}`);
  }
}

// Regenerate symposium structure with feedback
async function regenerateSymposiumStructure({ description, current_structure, feedback, model = "openai/gpt-4o", iteration = 1 }) {
  if (!description || description.trim() === '') {
    throw new Error('Description is required for symposium structure regeneration');
  }
  
  if (!feedback || feedback.trim() === '') {
    throw new Error('Feedback is required for structure regeneration');
  }
  
  const prompt = `You are helping refine a symposium structure based on user feedback. Here's the context:

Original Description: "${description}"

Current Structure:
${JSON.stringify(current_structure, null, 2)}

User Feedback: "${feedback}"

This is iteration ${iteration} of refinement.

Based on the feedback, please generate an improved structure with 3-5 distinct objectives that address the user's concerns. For each objective, provide 5-8 specific tasks.

Please respond with a JSON object containing an "objectives" array, where each objective has:
- title: Brief, clear objective name
- description: Detailed explanation of what this objective aims to achieve
- tasks: Array of 5-8 tasks, each with "title" and "description"

Format:
{
  "objectives": [
    {
      "title": "Research & Analysis",
      "description": "Gather and analyze relevant information to inform decision-making",
      "tasks": [
        {
          "title": "Literature review",
          "description": "Conduct comprehensive review of existing research and documentation"
        }
      ]
    }
  ]
}

Focus on:
- Addressing the specific feedback provided
- Creating objectives that are distinct and complementary
- Ensuring tasks are actionable and realistic
- Maintaining comprehensive coverage of the symposium scope`;

  try {
    const response = await chatWithOpenRouter(model, prompt);
    
    // Try to parse the JSON response
    let structure;
    try {
      // Extract JSON from response if it's wrapped in markdown or other text
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      structure = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', parseError);
      throw new Error('Failed to parse generated structure. Please try again.');
    }
    
    // Validate the structure
    if (!structure.objectives || !Array.isArray(structure.objectives)) {
      throw new Error('Generated structure must contain an objectives array');
    }
    
    // Ensure each objective has required fields and tasks
    const validatedObjectives = structure.objectives.map((objective, objIndex) => ({
      title: objective.title || `Objective ${objIndex + 1}`,
      description: objective.description || 'No description provided',
      tasks: Array.isArray(objective.tasks) ? objective.tasks.map((task, taskIndex) => ({
        title: task.title || `Task ${taskIndex + 1}`,
        description: task.description || 'No description provided'
      })) : []
    }));
    
    return {
      success: true,
      objectives: validatedObjectives,
      iteration: iteration
    };
    
  } catch (error) {
    console.error('Error regenerating symposium structure:', error);
    return {
      success: false,
      error: error.message,
      iteration: iteration
    };
  }
}

// Generate symposium structure with multiple objectives
async function generateSymposiumStructure({ description, model = "openai/gpt-4o" }) {
  if (!description || description.trim() === '') {
    throw new Error('Description is required for symposium structure generation');
  }
  
  const prompt = `Based on the following symposium description, generate a complete structure with 3-5 distinct objectives that cover different aspects of the goal. For each objective, provide 5-8 specific tasks to accomplish that objective.

Symposium Description: "${description}"

Please respond with a JSON object containing an "objectives" array, where each objective has:
- title: Brief, clear objective name
- description: Detailed explanation of what this objective aims to achieve
- tasks: Array of 5-8 tasks, each with "title" and "description"

Format:
{
  "objectives": [
    {
      "title": "Research & Analysis",
      "description": "Gather and analyze relevant information to inform decision-making",
      "tasks": [
        {
          "title": "Literature review",
          "description": "Conduct comprehensive review of existing research and documentation"
        },
        {
          "title": "Data collection",
          "description": "Gather relevant data from primary and secondary sources"
        }
      ]
    }
  ]
}

Focus on creating objectives that are:
- Distinct and complementary (covering different aspects)
- Logically organized (if there are dependencies)
- Comprehensive (covering the full scope of the symposium)
- Actionable (with concrete tasks)`;

  try {
    const response = await chatWithOpenRouter("openai/gpt-4o", prompt);
    
    // Try to parse the JSON response
    let structure;
    try {
      // Extract JSON from response if it's wrapped in markdown or other text
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      structure = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', parseError);
      // Fallback: create basic structure
      structure = {
        objectives: [
          {
            title: "Planning & Preparation",
            description: "Establish foundation and prepare for symposium execution",
            tasks: [
              { title: "Define scope and objectives", description: "Clearly outline what needs to be accomplished" },
              { title: "Resource assessment", description: "Identify required resources and constraints" },
              { title: "Timeline development", description: "Create realistic timeline for completion" }
            ]
          },
          {
            title: "Research & Analysis",
            description: "Gather information and analyze relevant data",
            tasks: [
              { title: "Information gathering", description: "Collect relevant data and insights" },
              { title: "Analysis and evaluation", description: "Analyze collected information for insights" },
              { title: "Documentation", description: "Document findings and recommendations" }
            ]
          },
          {
            title: "Implementation & Execution",
            description: "Execute the main activities of the symposium",
            tasks: [
              { title: "Execute primary activities", description: "Carry out the main work required" },
              { title: "Monitor progress", description: "Track advancement and make adjustments" },
              { title: "Quality assurance", description: "Ensure outputs meet required standards" }
            ]
          }
        ]
      };
    }
    
    // Validate the structure
    if (!structure.objectives || !Array.isArray(structure.objectives)) {
      throw new Error('Generated structure must contain an objectives array');
    }
    
    // Ensure each objective has required fields and tasks
    const validatedObjectives = structure.objectives.map((objective, objIndex) => ({
      title: objective.title || `Objective ${objIndex + 1}`,
      description: objective.description || 'No description provided',
      tasks: Array.isArray(objective.tasks) ? objective.tasks.map((task, taskIndex) => ({
        title: task.title || `Task ${taskIndex + 1}`,
        description: task.description || 'No description provided'
      })) : []
    }));
    
    return {
      success: true,
      objectives: validatedObjectives
    };
    
  } catch (error) {
    console.error('Error generating symposium structure:', error);
    return {
      success: false,
      error: error.message,
      // Provide fallback structure
      objectives: [
        {
          title: "Planning & Strategy",
          description: "Develop comprehensive plan and strategy for the symposium",
          tasks: [
            { title: "Define objectives", description: "Clearly outline symposium goals and expected outcomes" },
            { title: "Resource planning", description: "Identify and allocate necessary resources" },
            { title: "Timeline creation", description: "Develop realistic timeline with milestones" }
          ]
        },
        {
          title: "Execution & Implementation",
          description: "Execute the main activities and deliverables of the symposium",
          tasks: [
            { title: "Core activities", description: "Carry out primary symposium activities" },
            { title: "Progress monitoring", description: "Track progress and make necessary adjustments" },
            { title: "Quality control", description: "Ensure deliverables meet quality standards" }
          ]
        },
        {
          title: "Review & Completion",
          description: "Finalize outcomes and document results",
          tasks: [
            { title: "Results evaluation", description: "Assess outcomes against initial objectives" },
            { title: "Documentation", description: "Document processes, results, and learnings" },
            { title: "Final review", description: "Conduct comprehensive review and wrap-up" }
          ]
        }
      ]
    };
  }
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

// New Form Interface API handlers
async function getConsultantFormSchema(db, consultantId) {
  if (!consultantId || isNaN(consultantId)) {
    throw new Error('Valid consultant ID is required');
  }

  // Get consultant details
  const consultant = db.prepare("SELECT * FROM consultants WHERE id = ?").get(consultantId);
  if (!consultant) {
    throw new Error('Consultant not found');
  }

  // Get template if available
  let template = null;
  if (consultant.template_id) {
    template = db.prepare("SELECT * FROM consultant_templates WHERE id = ?").get(consultant.template_id);
  }

  // Return form schema based on consultant type or template
  if (template && template.form_schema) {
    return JSON.parse(template.form_schema);
  }

  // Fallback for legacy consultants - determine by consultant_type
  switch (consultant.consultant_type) {
    case 'airtable':
      return getAirtableFormSchema();
    case 'perplexity':
      return getPerplexityFormSchema();
    default:
      throw new Error('This consultant type does not support form interface');
  }
}

function getAirtableFormSchema() {
  return {
    name: 'airtable_query',
    fields: [
      {
        name: 'table_name',
        label: 'Table',
        type: 'select',
        required: true,
        dynamic_options: 'tables'
      },
      {
        name: 'fields',
        label: 'Fields to Return',
        type: 'multi-select',
        required: false,
        dynamic_options: 'table_fields',
        depends_on: 'table_name'
      },
      {
        name: 'filter_formula',
        label: 'Filter Formula',
        type: 'textarea',
        required: false,
        placeholder: 'Airtable formula (e.g., {Status} = "Active")',
        rows: 3
      },
      {
        name: 'sort',
        label: 'Sort By',
        type: 'select',
        required: false,
        dynamic_options: 'table_fields',
        depends_on: 'table_name'
      },
      {
        name: 'max_records',
        label: 'Max Records',
        type: 'number',
        required: false,
        default: 100,
        min: 1,
        max: 1000
      }
    ]
  };
}

function getPerplexityFormSchema() {
  return {
    name: 'perplexity_search',
    fields: [
      {
        name: 'query',
        label: 'Search Query',
        type: 'textarea',
        required: true,
        placeholder: 'Enter your search query or question',
        rows: 3
      },
      {
        name: 'focus',
        label: 'Search Focus',
        type: 'select',
        required: false,
        options: [
          { value: 'internet', label: 'General Internet Search' },
          { value: 'academic', label: 'Academic Sources' },
          { value: 'news', label: 'Recent News' },
          { value: 'reddit', label: 'Reddit Discussions' },
          { value: 'youtube', label: 'YouTube Videos' }
        ]
      }
    ]
  };
}

async function getConsultantContext(db, consultantId) {
  if (!consultantId || isNaN(consultantId)) {
    throw new Error('Valid consultant ID is required');
  }

  // Get consultant details
  const consultant = db.prepare("SELECT * FROM consultants WHERE id = ?").get(consultantId);
  if (!consultant) {
    throw new Error('Consultant not found');
  }

  // Get dynamic context from database
  const contextStmt = db.prepare(`
    SELECT context_type, context_data 
    FROM consultant_dynamic_context 
    WHERE consultant_id = ?
  `);
  const contextRows = contextStmt.all(consultantId);

  const context = {};
  contextRows.forEach(row => {
    try {
      context[row.context_type] = JSON.parse(row.context_data);
    } catch (error) {
      console.error(`Error parsing context data for ${row.context_type}:`, error);
      context[row.context_type] = [];
    }
  });

  // If no context exists, try to refresh it
  if (Object.keys(context).length === 0) {
    await refreshConsultantContext(db, consultantId, consultant.consultant_type);
    
    // Try again after refresh
    const refreshedRows = contextStmt.all(consultantId);
    refreshedRows.forEach(row => {
      try {
        context[row.context_type] = JSON.parse(row.context_data);
      } catch (error) {
        console.error(`Error parsing refreshed context data for ${row.context_type}:`, error);
        context[row.context_type] = [];
      }
    });
  }

  return context;
}

async function refreshConsultantContext(db, consultantId, consultantType) {
  switch (consultantType) {
    case 'airtable':
      await refreshAirtableContext(db, consultantId);
      break;
    case 'perplexity':
      // Perplexity doesn't need dynamic context refresh
      break;
    default:
      console.log(`No context refresh needed for consultant type: ${consultantType}`);
  }
}

async function refreshAirtableContext(db, consultantId) {
  try {
    // Get Airtable configuration
    const config = await airtableService.getAirtableConfig(consultantId);
    if (!config) {
      throw new Error('Airtable configuration not found');
    }

    // Get available tables
    const tablesResult = await airtableService.getAvailableTables(config.base_id, config.api_key);
    if (!tablesResult.success) {
      throw new Error('Failed to fetch Airtable tables');
    }

    const tables = tablesResult.tables.map(table => table.name);
    
    // Get fields for each table
    const tableFields = {};
    for (const table of tablesResult.tables) {
      if (table.fields) {
        tableFields[table.name] = table.fields.map(field => field.name);
      }
    }

    // Store context in database
    const upsertStmt = db.prepare(`
      INSERT OR REPLACE INTO consultant_dynamic_context 
      (consultant_id, context_type, context_data, last_updated) 
      VALUES (?, ?, ?, datetime('now'))
    `);

    upsertStmt.run(consultantId, 'tables', JSON.stringify(tables));
    upsertStmt.run(consultantId, 'table_fields', JSON.stringify(tableFields));

    console.log(`Refreshed Airtable context for consultant ${consultantId}`);

  } catch (error) {
    console.error(`Error refreshing Airtable context for consultant ${consultantId}:`, error);
    // Don't throw - just log the error so the form can still work with empty options
  }
}

async function populateFormWithLLM(db, { consultant_id, instruction, form_schema, dynamic_context }) {
  if (!consultant_id || !instruction || !form_schema) {
    throw new Error('Consultant ID, instruction, and form schema are required');
  }

  // Get consultant details
  const consultant = db.prepare("SELECT * FROM consultants WHERE id = ?").get(consultant_id);
  if (!consultant) {
    throw new Error('Consultant not found');
  }

  // Build context for LLM
  const context = `You are helping to fill out a form for a ${consultant.consultant_type} consultant.
Your role: ${consultant.system_prompt}

CRITICAL AIRTABASE FILTER FORMULA SYNTAX:
IMPORTANT: Airtable filterByFormula uses specific syntax rules:
- Field names: ALWAYS wrap in curly braces {Field_Name}
- String values: ALWAYS wrap in double quotes "value"
- Multiple select fields: Use Find("value", {Field_Name})
- Formulas must evaluate to true/false (truthy/falsy)
- URL encoding: Formulas will be URL-encoded automatically

FILTER FORMULA EXAMPLES:
- Single field equality: {Status} = "Active"
- Multiple select contains: Find("JavaScript", {Skills})
- Numeric comparison: {Rating} >= 4
- Text contains: Find("urgent", {Notes})
- Boolean field: {IsActive} = 1

CRITICAL FIELD NAME MAPPING RULES:
- You MUST use EXACT field names from the schema below (CASE-SENSITIVE)
- Map user terms to the closest matching field name
- Examples: "skills" → "Skill_Emblems", "name" → "Name", "status" → "Status"
- Only use field names that exist in the schema
- NEVER modify field names - use them exactly as shown

STRICT VALUE MATCHING FOR MULTIPLE SELECT FIELDS:
- For multiple select fields, you MUST use EXACT values from the available options
- Values are CASE-SENSITIVE - "Soccer" ≠ "soccer"
- If user says "soccer" but schema has "Soccer", use "Soccer"
- Check the "Available options" for each field and use exact matches only
- Do not assume or modify option values

Available form fields and their options:
${form_schema.fields.map(field => {
  let fieldDesc = `- ${field.name} (${field.type})`;
  if (field.required) fieldDesc += ' [REQUIRED]';
  fieldDesc += '\n';

  if (field.dynamic_options && dynamic_context[field.dynamic_options]) {
    fieldDesc += `  Available options: ${JSON.stringify(dynamic_context[field.dynamic_options])}\n`;
  }

  if (field.depends_on) {
    fieldDesc += `  Depends on: ${field.depends_on}\n`;
  }

  return fieldDesc;
}).join('')}

User instruction: "${instruction}"

INSTRUCTIONS:
1. Map user terms to EXACT field names from the schema
2. For filter_formula: Use proper Airtable syntax with {Field_Name} and "values"
3. For multiple select fields in filters: Use Find("value", {Field_Name})
4. Return ONLY a JSON object with field names as keys and their values
5. For select fields, use exact values from the available options
6. For multi-select fields, return an array of values
7. Only include fields that should be filled based on the instruction

EXAMPLE MAPPINGS:
- User says "find active users" → filter_formula: "{Status} = \\"Active\\""
- User says "find people with JavaScript skills" → filter_formula: "Find(\\"JavaScript\\", {Skills})"
- User says "sort by name" → sort: "Name"
- User says "show only first 50" → max_records: 50`;

  try {
    const response = await chatWithOpenRouter(consultant.model, context);
    
    // Try to parse JSON response
    let formValues;
    try {
      // Extract JSON from response if wrapped in markdown
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      formValues = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse LLM form response:', parseError);
      throw new Error('Failed to parse form values from AI response');
    }

    return {
      success: true,
      form_values: formValues
    };

  } catch (error) {
    console.error('Error populating form with LLM:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function executeConsultantQuery(db, { consultant_id, query_parameters, objective_id = null }) {
  if (!consultant_id || !query_parameters) {
    throw new Error('Consultant ID and query parameters are required');
  }

  // Get consultant details
  const consultant = db.prepare("SELECT * FROM consultants WHERE id = ?").get(consultant_id);
  if (!consultant) {
    throw new Error('Consultant not found');
  }

  // Validate query parameters against schema for Airtable
  if (consultant.consultant_type === 'airtable') {
    await validateAirtableQueryParameters(db, consultant_id, query_parameters);
  }

  try {
    let formattedResponse;
    let apiData = null;

    // Execute API call based on consultant type
    switch (consultant.consultant_type) {
      case 'airtable':
        // Create consultant instance to use programmatic formatting
        const airtableConsultant = await ConsultantFactory.createConsultant(db, consultant);
        
        // Execute the API call
        const apiAction = {
          action: "query_airtable",
          parameters: query_parameters
        };
        
        const apiResponse = await airtableConsultant.executeApiCall(apiAction);
        apiData = apiResponse;
        
        // Use programmatic formatting - NO LLM needed
        formattedResponse = airtableConsultant.generateMarkdownTable(apiResponse, query_parameters);
        
        console.log(`Airtable query results for table "${query_parameters.table_name}":`, JSON.stringify(apiData, null, 2));
        break;

      case 'perplexity':
        // For Perplexity, we still need LLM processing
        const perplexityResponse = await executePerplexityQuery(db, consultant_id, query_parameters);
        formattedResponse = perplexityResponse;
        console.log(`Perplexity query results:`, perplexityResponse);
        break;

      default:
        throw new Error(`Unsupported consultant type: ${consultant.consultant_type}`);
    }

    // Create message record with the formatted response
    const message = createMessage(db, {
      symposium_id: consultant.symposium_id,
      consultant_id: consultant_id,
      objective_id: objective_id,
      content: formattedResponse,
      is_user: false
    });

    return {
      success: true,
      message: message,
      llm_response: formattedResponse,
      api_data: apiData
    };

  } catch (error) {
    console.error('Error executing consultant query:', error);
    
    // Create error message
    const errorMessage = `I encountered an error while executing your query: ${error.message}`;
    const message = createMessage(db, {
      symposium_id: consultant.symposium_id,
      consultant_id: consultant_id,
      objective_id: objective_id,
      content: errorMessage,
      is_user: false
    });

    return {
      success: false,
      message: message,
      llm_response: errorMessage,
      error: error.message
    };
  }
}

async function executeAirtableQuery(db, consultantId, queryParams) {
  // Get Airtable configuration
  const config = await airtableService.getAirtableConfig(consultantId);
  if (!config) {
    throw new Error('Airtable configuration not found');
  }

  // Build Airtable API URL
  let url = `https://api.airtable.com/v0/${config.base_id}/${encodeURIComponent(queryParams.table_name)}`;
  const params = new URLSearchParams();

  // Add query parameters
  if (queryParams.fields && queryParams.fields.length > 0) {
    queryParams.fields.forEach(field => {
      params.append('fields[]', field);
    });
  }

  if (queryParams.filter_formula && queryParams.filter_formula.trim()) {
    params.append('filterByFormula', queryParams.filter_formula.trim());
  }

  if (queryParams.sort && Array.isArray(queryParams.sort) && queryParams.sort.length > 0) {
    queryParams.sort.forEach((sortSpec, index) => {
      params.append(`sort[${index}][field]`, sortSpec.field);
      params.append(`sort[${index}][direction]`, sortSpec.direction || 'asc');
    });
  }

  if (queryParams.max_records) {
    params.append('maxRecords', queryParams.max_records.toString());
  }

  if (params.toString()) {
    url += '?' + params.toString();
  }

  // Execute API call
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${config.api_key}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Airtable API error: ${response.status} ${errorData}`);
  }

  const data = await response.json();
  
  return {
    response: JSON.stringify(data, null, 2),
    data: data
  };
}

async function executePerplexityQuery(db, consultantId, queryParams) {
  // Get Perplexity configuration
  const configManager = new ConsultantConfigManager(db);
  const config = await configManager.getApiConfig(consultantId);

  if (!config || config.api_type !== 'perplexity') {
    throw new Error('Perplexity configuration not found');
  }

  // Build Perplexity API request
  const requestBody = {
    model: 'llama-3.1-sonar-small-128k-online',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful research assistant. Provide accurate, well-sourced information.'
      },
      {
        role: 'user',
        content: queryParams.query
      }
    ]
  };

  // Add focus if specified
  if (queryParams.focus && queryParams.focus !== 'internet') {
    requestBody.search_domain_filter = [queryParams.focus];
  }

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.config.api_key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Perplexity API error: ${response.status} ${errorData}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function validateAirtableQueryParameters(db, consultantId, queryParams) {
  if (!queryParams.table_name) {
    throw new Error('Table name is required');
  }

  try {
    // Get the table schema from the database (should be fresh from form filling)
    const schemaStmt = db.prepare(`
      SELECT context_data FROM consultant_dynamic_context
      WHERE consultant_id = ? AND context_type = ?
    `);
    const schemaRow = schemaStmt.get(consultantId, `table_schema_${queryParams.table_name}`);

    if (!schemaRow) {
      throw new Error(`Schema not found for table "${queryParams.table_name}". Please select the table first to load the schema.`);
    }

    const tableSchema = JSON.parse(schemaRow.context_data);
    const fieldNames = tableSchema.fields.map(field => field.name);

    // Validate filter formula field names
    if (queryParams.filter_formula && queryParams.filter_formula.trim()) {
      const formula = queryParams.filter_formula.trim();
      // Extract field names from curly braces {Field_Name}
      const fieldMatches = formula.match(/\{([^}]+)\}/g);

      if (fieldMatches) {
        for (const match of fieldMatches) {
          const fieldName = match.slice(1, -1); // Remove { }
          if (!fieldNames.includes(fieldName)) {
            throw new Error(`Field "${fieldName}" does not exist in table "${queryParams.table_name}". Available fields: ${fieldNames.join(', ')}`);
          }
        }
      }
    }

    // Validate sort field names
    if (queryParams.sort && Array.isArray(queryParams.sort) && queryParams.sort.length > 0) {
      for (const sortSpec of queryParams.sort) {
        if (sortSpec.field && !fieldNames.includes(sortSpec.field)) {
          throw new Error(`Sort field "${sortSpec.field}" does not exist in table "${queryParams.table_name}". Available fields: ${fieldNames.join(', ')}`);
        }
      }
    }

    // Validate fields array
    if (queryParams.fields && Array.isArray(queryParams.fields)) {
      for (const field of queryParams.fields) {
        if (!fieldNames.includes(field)) {
          throw new Error(`Field "${field}" does not exist in table "${queryParams.table_name}". Available fields: ${fieldNames.join(', ')}`);
        }
      }
    }

    console.log(`Validated query parameters for table "${queryParams.table_name}"`);

  } catch (error) {
    console.error('Error validating query parameters:', error);
    throw error;
  }
}

async function getConsultantTableSchema(db, { consultant_id, table_name }) {
  if (!consultant_id || !table_name) {
    throw new Error('Consultant ID and table name are required');
  }

  try {
    // Get Airtable configuration
    const config = await airtableService.getAirtableConfig(consultant_id);
    if (!config) {
      throw new Error('Airtable configuration not found');
    }

    // Create Airtable client and get fresh table schema
    const { AirtableClient } = await import("./airtable-client.js");
    const client = new AirtableClient(config.api_key, config.base_id);
    const tableSchema = await client.getTableSchema(table_name);

    // Format the schema for the LLM with field details
    const formattedSchema = {
      table_name: tableSchema.name,
      fields: tableSchema.fields.map(field => ({
        name: field.name,
        type: field.type,
        options: field.options || {}
      }))
    };

    console.log(`Retrieved table schema for "${table_name}":`, JSON.stringify(formattedSchema, null, 2));

    // Update the dynamic context in database with fresh schema
    const upsertStmt = db.prepare(`
      INSERT OR REPLACE INTO consultant_dynamic_context
      (consultant_id, context_type, context_data, last_updated)
      VALUES (?, ?, ?, datetime('now'))
    `);

    // Store table-specific field information
    const tableFieldsKey = `table_fields_${table_name}`;
    const fieldNames = formattedSchema.fields.map(field => field.name);
    upsertStmt.run(consultant_id, tableFieldsKey, JSON.stringify(fieldNames));

    // Also store the full schema for this table
    const tableSchemaKey = `table_schema_${table_name}`;
    upsertStmt.run(consultant_id, tableSchemaKey, JSON.stringify(formattedSchema));

    console.log(`Fetched fresh schema for table "${table_name}" with ${formattedSchema.fields.length} fields`);

    return {
      table_name: formattedSchema.table_name,
      fields: formattedSchema.fields
    };

  } catch (error) {
    console.error('Error fetching table schema:', error);
    throw new Error(`Failed to fetch table schema: ${error.message}`);
  }
}

// Tag CRUD operations
function getTags(db) {
  const stmt = db.prepare("SELECT * FROM tags ORDER BY name");
  return stmt.all();
}

function createTag(db, { name, color = '#4f46e5' }) {
  if (!name || name.trim() === '') {
    throw new Error('Tag name is required');
  }

  const stmt = db.prepare(`
    INSERT INTO tags (name, color, created_at)
    VALUES (?, ?, datetime('now'))
    RETURNING *
  `);
  
  try {
    return stmt.get(name.trim(), color);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      throw new Error('A tag with this name already exists');
    }
    throw error;
  }
}

function updateTag(db, tagId, { name, color }) {
  if (!tagId || isNaN(tagId)) {
    throw new Error('Valid tag ID is required');
  }

  // Check if tag exists
  const tag = db.prepare("SELECT * FROM tags WHERE id = ?").get(tagId);
  if (!tag) {
    throw new Error('Tag not found');
  }

  const stmt = db.prepare(`
    UPDATE tags 
    SET name = COALESCE(?, name), color = COALESCE(?, color)
    WHERE id = ?
    RETURNING *
  `);
  
  try {
    const result = stmt.get(
      name !== undefined ? name.trim() : null,
      color !== undefined ? color : null,
      tagId
    );
    
    if (!result) {
      throw new Error('Failed to update tag');
    }
    
    return result;
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      throw new Error('A tag with this name already exists');
    }
    throw error;
  }
}

function deleteTag(db, tagId) {
  if (!tagId || isNaN(tagId)) {
    throw new Error('Valid tag ID is required');
  }

  // Check if tag exists
  const tag = db.prepare("SELECT * FROM tags WHERE id = ?").get(tagId);
  if (!tag) {
    throw new Error('Tag not found');
  }

  // Delete the tag (CASCADE will handle card_tags relationships)
  const stmt = db.prepare("DELETE FROM tags WHERE id = ?");
  const result = stmt.run(tagId);

  if (result.changes === 0) {
    throw new Error('Failed to delete tag');
  }

  return {
    success: true,
    deletedTag: tag
  };
}

// Card-Tag relationship operations
function getCardTags(db, cardId) {
  if (!cardId || isNaN(cardId)) {
    throw new Error('Valid card ID is required');
  }

  const stmt = db.prepare(`
    SELECT t.* FROM tags t
    INNER JOIN card_tags ct ON t.id = ct.tag_id
    WHERE ct.card_id = ?
    ORDER BY t.name
  `);
  
  return stmt.all(cardId);
}

function setCardTags(db, cardId, { tag_ids }) {
  if (!cardId || isNaN(cardId)) {
    throw new Error('Valid card ID is required');
  }

  if (!Array.isArray(tag_ids)) {
    throw new Error('tag_ids must be an array');
  }

  // Check if card exists
  const card = db.prepare("SELECT * FROM knowledge_base_cards WHERE id = ?").get(cardId);
  if (!card) {
    throw new Error('Card not found');
  }

  try {
    // Remove all existing tags for this card
    const deleteStmt = db.prepare("DELETE FROM card_tags WHERE card_id = ?");
    deleteStmt.run(cardId);

    // Add new tags
    if (tag_ids.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO card_tags (card_id, tag_id, created_at)
        VALUES (?, ?, datetime('now'))
      `);

      for (const tagId of tag_ids) {
        if (!isNaN(tagId)) {
          insertStmt.run(cardId, tagId);
        }
      }
    }

    // Return updated tags for the card
    return getCardTags(db, cardId);
  } catch (error) {
    console.error('Error setting card tags:', error);
    throw new Error(`Failed to set card tags: ${error.message}`);
  }
}

function addTagToCard(db, cardId, tagId) {
  if (!cardId || isNaN(cardId)) {
    throw new Error('Valid card ID is required');
  }
  
  if (!tagId || isNaN(tagId)) {
    throw new Error('Valid tag ID is required');
  }

  // Check if card and tag exist
  const card = db.prepare("SELECT * FROM knowledge_base_cards WHERE id = ?").get(cardId);
  if (!card) {
    throw new Error('Card not found');
  }

  const tag = db.prepare("SELECT * FROM tags WHERE id = ?").get(tagId);
  if (!tag) {
    throw new Error('Tag not found');
  }

  const stmt = db.prepare(`
    INSERT INTO card_tags (card_id, tag_id, created_at)
    VALUES (?, ?, datetime('now'))
  `);
  
  try {
    stmt.run(cardId, tagId);
    return { success: true };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      throw new Error('This tag is already assigned to the card');
    }
    throw error;
  }
}

function removeTagFromCard(db, cardId, tagId) {
  if (!cardId || isNaN(cardId)) {
    throw new Error('Valid card ID is required');
  }
  
  if (!tagId || isNaN(tagId)) {
    throw new Error('Valid tag ID is required');
  }

  const stmt = db.prepare("DELETE FROM card_tags WHERE card_id = ? AND tag_id = ?");
  const result = stmt.run(cardId, tagId);

  if (result.changes === 0) {
    throw new Error('Tag assignment not found');
  }

  return { success: true };
}

function getCardsByTags(db, { tag_ids }) {
  if (!Array.isArray(tag_ids) || tag_ids.length === 0) {
    return [];
  }

  // Create placeholders for the IN clause
  const placeholders = tag_ids.map(() => '?').join(',');
  
  const stmt = db.prepare(`
    SELECT DISTINCT kb.*, m.content as source_message_content, c.name as source_consultant_name
    FROM knowledge_base_cards kb
    LEFT JOIN messages m ON kb.source_message_id = m.id
    LEFT JOIN consultants c ON m.consultant_id = c.id
    INNER JOIN card_tags ct ON kb.id = ct.card_id
    WHERE ct.tag_id IN (${placeholders}) AND kb.is_global = 1
    ORDER BY kb.created_at DESC
  `);
  
  return stmt.all(...tag_ids);
}

// Selected tags persistence operations
function getSelectedTags(db, symposiumId, objectiveId = null) {
  if (!symposiumId || isNaN(symposiumId)) {
    throw new Error('Valid symposium ID is required');
  }

  let query = `
    SELECT st.tag_id, t.name, t.color
    FROM selected_tags st
    INNER JOIN tags t ON st.tag_id = t.id
    WHERE st.symposium_id = ?
  `;
  
  const params = [symposiumId];
  
  if (objectiveId) {
    query += ` AND st.objective_id = ?`;
    params.push(objectiveId);
  } else {
    query += ` AND st.objective_id IS NULL`;
  }
  
  query += ` ORDER BY t.name`;
  
  const stmt = db.prepare(query);
  const rows = stmt.all(...params);
  
  return rows.map(row => ({
    id: row.tag_id,
    name: row.name,
    color: row.color
  }));
}

function setSelectedTags(db, { symposium_id, objective_id = null, tag_ids }) {
  if (!symposium_id || isNaN(symposium_id)) {
    throw new Error('Valid symposium ID is required');
  }

  if (!Array.isArray(tag_ids)) {
    throw new Error('tag_ids must be an array');
  }

  try {
    // Remove all existing selected tags for this symposium/objective combination
    let deleteQuery = `DELETE FROM selected_tags WHERE symposium_id = ?`;
    const deleteParams = [symposium_id];
    
    if (objective_id) {
      deleteQuery += ` AND objective_id = ?`;
      deleteParams.push(objective_id);
    } else {
      deleteQuery += ` AND objective_id IS NULL`;
    }
    
    const deleteStmt = db.prepare(deleteQuery);
    deleteStmt.run(...deleteParams);

    // Add new selected tags
    if (tag_ids.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO selected_tags (symposium_id, objective_id, tag_id, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `);

      for (const tagId of tag_ids) {
        if (!isNaN(tagId)) {
          insertStmt.run(symposium_id, objective_id, tagId);
        }
      }
    }

    // Return updated selected tags
    return getSelectedTags(db, symposium_id, objective_id);
  } catch (error) {
    console.error('Error setting selected tags:', error);
    throw new Error(`Failed to set selected tags: ${error.message}`);
  }
}

console.log("Starting Symposium server on http://localhost:8000");
await serve(handler, { port: 8000 });
