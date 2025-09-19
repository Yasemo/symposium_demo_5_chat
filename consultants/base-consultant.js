import { chatWithOpenRouter } from "../openrouter.js";

// Simple encryption/decryption for API keys (in production, use proper encryption)
function encryptConfig(config) {
  // Simple base64 encoding for now - in production use proper encryption
  return btoa(JSON.stringify(config));
}

function decryptConfig(encryptedConfig) {
  try {
    return JSON.parse(atob(encryptedConfig));
  } catch (error) {
    throw new Error("Failed to decrypt configuration");
  }
}

// Base Consultant Class
export class BaseConsultant {
  constructor(db, consultantData) {
    this.db = db;
    this.id = consultantData.id;
    this.name = consultantData.name;
    this.model = consultantData.model;
    this.systemPrompt = consultantData.system_prompt;
    this.templateId = consultantData.template_id;
    this.apiConfig = null;
  }

  async loadApiConfig() {
    if (this.apiConfig) return this.apiConfig;

    const stmt = this.db.prepare("SELECT * FROM external_api_configs WHERE consultant_id = ? AND is_active = 1");
    const config = stmt.get(this.id);
    
    if (config) {
      this.apiConfig = decryptConfig(config.config_json);
      this.apiType = config.api_type;
    }
    
    return this.apiConfig;
  }

  async logApiInteraction(requestData, responseData, success, errorMessage = null, executionTime = 0) {
    const stmt = this.db.prepare(`
      INSERT INTO api_interaction_logs 
      (consultant_id, api_type, request_data, response_data, success, error_message, execution_time_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      this.id,
      this.apiType || 'unknown',
      JSON.stringify(requestData),
      JSON.stringify(responseData),
      success ? 1 : 0,
      errorMessage,
      executionTime
    );
  }

  async processMessage(userMessage, context) {
    const startTime = Date.now();
    
    try {
      // Step 1: Load API configuration
      await this.loadApiConfig();
      
      // Step 2: Use LLM to interpret the request and plan API action
      const apiAction = await this.interpretRequest(userMessage, context);
      
      // Step 3: Execute external API call if needed
      let apiResponse = null;
      if (apiAction.needsApiCall) {
        apiResponse = await this.executeApiCall(apiAction);
      }
      
      // Step 4: Format response using LLM
      const finalResponse = await this.formatResponse(userMessage, apiAction, apiResponse, context);
      
      // Log successful interaction
      await this.logApiInteraction(
        { userMessage, apiAction },
        { apiResponse, finalResponse },
        true,
        null,
        Date.now() - startTime
      );
      
      return finalResponse;
      
    } catch (error) {
      // Log failed interaction
      await this.logApiInteraction(
        { userMessage },
        null,
        false,
        error.message,
        Date.now() - startTime
      );
      
      throw error;
    }
  }

  async interpretRequest(userMessage, context) {
    // Default implementation - can be overridden by specific consultant types
    const interpretPrompt = `${this.systemPrompt}

Context: ${context}

User Message: "${userMessage}"

Based on your role and the user's message, determine if you need to make an external API call.
Respond with a JSON object containing:
- needsApiCall: boolean
- action: string (if needsApiCall is true, describe what API action to take)
- parameters: object (if needsApiCall is true, provide parameters for the API call)

If no API call is needed, just set needsApiCall to false.`;

    try {
      const response = await chatWithOpenRouter(this.model, interpretPrompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        return { needsApiCall: false };
      }
    } catch (error) {
      console.error('Error interpreting request:', error);
      return { needsApiCall: false };
    }
  }

  async executeApiCall(apiAction) {
    // Base implementation - should be overridden by specific consultant types
    throw new Error("executeApiCall must be implemented by consultant subclass");
  }

  async formatResponse(userMessage, apiAction, apiResponse, context) {
    let formatPrompt = `${this.systemPrompt}

Context: ${context}

User Message: "${userMessage}"`;

    if (apiResponse) {
      formatPrompt += `

API Response Data:
${JSON.stringify(apiResponse, null, 2)}

Based on the API response, provide a natural, helpful response to the user's question. Format the information clearly and conversationally.`;
    } else {
      formatPrompt += `

No external API call was needed. Respond to the user's message based on your role and expertise.`;
    }

    try {
      return await chatWithOpenRouter(this.model, formatPrompt);
    } catch (error) {
      console.error('Error formatting response:', error);
      return "I apologize, but I encountered an error while processing your request.";
    }
  }
}

export { encryptConfig, decryptConfig };
