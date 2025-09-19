import { AirtableConsultant } from "./airtable-consultant.js";
import { PerplexityConsultant } from "./perplexity-consultant.js";
import { PureLLMConsultant } from "./pure-llm-consultant.js";
import { encryptConfig, decryptConfig } from "./base-consultant.js";

// Consultant Factory
export class ConsultantFactory {
  static async createConsultant(db, consultantData) {
    // Load template information if available
    let template = null;
    if (consultantData.template_id) {
      const stmt = db.prepare("SELECT * FROM consultant_templates WHERE id = ?");
      template = stmt.get(consultantData.template_id);
    }

    // Determine consultant type
    const apiType = template?.api_type || consultantData.consultant_type || 'pure_llm';

    switch (apiType) {
      case 'airtable':
        return new AirtableConsultant(db, consultantData);
      case 'perplexity':
        return new PerplexityConsultant(db, consultantData);
      case 'pure_llm':
      case 'standard':
      default:
        return new PureLLMConsultant(db, consultantData);
    }
  }
}

// Configuration Management
export class ConsultantConfigManager {
  constructor(db) {
    this.db = db;
  }

  async saveApiConfig(consultantId, apiType, config) {
    const encryptedConfig = encryptConfig(config);
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO external_api_configs 
      (consultant_id, api_type, config_json, updated_at) 
      VALUES (?, ?, ?, datetime('now'))
    `);
    
    return stmt.run(consultantId, apiType, encryptedConfig);
  }

  async getApiConfig(consultantId) {
    const stmt = this.db.prepare("SELECT * FROM external_api_configs WHERE consultant_id = ? AND is_active = 1");
    const config = stmt.get(consultantId);
    
    if (config) {
      return {
        ...config,
        config: decryptConfig(config.config_json)
      };
    }
    
    return null;
  }

  async deleteApiConfig(consultantId) {
    const stmt = this.db.prepare("UPDATE external_api_configs SET is_active = 0 WHERE consultant_id = ?");
    return stmt.run(consultantId);
  }
}

// Template Management
export class ConsultantTemplateManager {
  constructor(db) {
    this.db = db;
  }

  async getTemplates() {
    const stmt = this.db.prepare("SELECT * FROM consultant_templates ORDER BY name");
    return stmt.all();
  }

  async getTemplate(id) {
    const stmt = this.db.prepare("SELECT * FROM consultant_templates WHERE id = ?");
    return stmt.get(id);
  }

  async createTemplate(templateData) {
    const stmt = this.db.prepare(`
      INSERT INTO consultant_templates 
      (name, display_name, description, api_type, default_system_prompt, required_config_fields, icon)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    
    return stmt.get(
      templateData.name,
      templateData.display_name,
      templateData.description,
      templateData.api_type,
      templateData.default_system_prompt,
      JSON.stringify(templateData.required_config_fields),
      templateData.icon
    );
  }

  async seedDefaultTemplates() {
    const templates = [
      {
        name: 'pure_llm',
        display_name: 'Pure LLM Assistant',
        description: 'A conversational AI assistant powered purely by language models without external API integrations.',
        api_type: 'pure_llm',
        default_system_prompt: 'You are a helpful AI assistant. Provide thoughtful, accurate responses to user questions and engage in meaningful conversations.',
        required_config_fields: [],
        icon: '🤖'
      },
      {
        name: 'airtable_data_assistant',
        display_name: 'Airtable Data Assistant',
        description: 'Specialized consultant for querying and analyzing data from Airtable databases.',
        api_type: 'airtable',
        default_system_prompt: 'You are an Airtable Data Assistant specialized in querying and analyzing data from Airtable databases. You help users retrieve information from their Airtable bases by interpreting natural language queries and converting them into appropriate database operations.',
        required_config_fields: ['base_id', 'api_key', 'table_name'],
        icon: '📊'
      },
      {
        name: 'perplexity_research_assistant',
        display_name: 'Perplexity Research Assistant',
        description: 'Research assistant that uses Perplexity AI for web searches and current information.',
        api_type: 'perplexity',
        default_system_prompt: 'You are a research assistant that helps users find current information and conduct research using web search capabilities. You provide accurate, up-to-date information with proper source attribution.',
        required_config_fields: ['api_key'],
        icon: '🔍'
      }
    ];

    for (const template of templates) {
      try {
        // Check if template already exists
        const existing = this.db.prepare("SELECT id FROM consultant_templates WHERE name = ?").get(template.name);
        
        if (!existing) {
          await this.createTemplate(template);
          console.log(`Created template: ${template.display_name}`);
        }
      } catch (error) {
        console.error(`Error creating template ${template.name}:`, error);
      }
    }
  }
}
