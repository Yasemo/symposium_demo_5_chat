import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";

// Simple Airtable client implementation for Deno
class AirtableClient {
  constructor(apiKey, baseId) {
    this.apiKey = apiKey;
    this.baseId = baseId;
    this.baseUrl = `https://api.airtable.com/v0/${baseId}`;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Airtable API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    return await response.json();
  }

  async listTables() {
    try {
      // Get base schema to list tables
      const response = await fetch(`https://api.airtable.com/v0/meta/bases/${this.baseId}/tables`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tables: ${response.status}`);
      }

      const data = await response.json();
      return data.tables || [];
    } catch (error) {
      console.error('Error listing tables:', error);
      throw error;
    }
  }

  async getTableSchema(tableName) {
    try {
      const tables = await this.listTables();
      const table = tables.find(t => t.name === tableName);
      
      if (!table) {
        throw new Error(`Table "${tableName}" not found`);
      }

      return {
        name: table.name,
        fields: table.fields.map(field => ({
          name: field.name,
          type: field.type,
          options: field.options || {}
        }))
      };
    } catch (error) {
      console.error('Error getting table schema:', error);
      throw error;
    }
  }

  async select(tableName, options = {}) {
    try {
      const params = new URLSearchParams();
      
      if (options.filterByFormula) {
        params.append('filterByFormula', options.filterByFormula);
      }
      
      if (options.fields && options.fields.length > 0) {
        options.fields.forEach(field => params.append('fields[]', field));
      }
      
      if (options.maxRecords) {
        params.append('maxRecords', Math.min(options.maxRecords, 20).toString());
      } else {
        params.append('maxRecords', '20'); // Default limit
      }
      
      if (options.sort && options.sort.length > 0) {
        options.sort.forEach((sortSpec, index) => {
          params.append(`sort[${index}][field]`, sortSpec.field);
          params.append(`sort[${index}][direction]`, sortSpec.direction || 'asc');
        });
      }

      const endpoint = `/${encodeURIComponent(tableName)}?${params.toString()}`;
      const data = await this.request(endpoint);
      
      return {
        records: data.records || [],
        offset: data.offset
      };
    } catch (error) {
      console.error('Error selecting records:', error);
      throw error;
    }
  }

  async testConnection(tableName = null) {
    try {
      if (tableName) {
        // Test with specific table
        await this.select(tableName, { maxRecords: 1 });
      } else {
        // Test by listing tables
        await this.listTables();
      }
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}

export class AirtableService {
  constructor(db) {
    this.db = db;
  }

  async getAirtableConfig(consultantId) {
    const stmt = this.db.prepare("SELECT * FROM airtable_configs WHERE consultant_id = ?");
    return stmt.get(consultantId);
  }

  async saveAirtableConfig(consultantId, baseId, apiKey, tableName) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO airtable_configs (consultant_id, base_id, api_key, table_name, created_at) 
      VALUES (?, ?, ?, ?, datetime('now'))
    `);
    return stmt.run(consultantId, baseId, apiKey, tableName);
  }

  async createAirtableClient(consultantId) {
    const config = await this.getAirtableConfig(consultantId);
    if (!config) {
      throw new Error('Airtable configuration not found for this consultant');
    }

    return new AirtableClient(config.api_key, config.base_id);
  }

  async interpretQuery(userQuery, tableSchema, model, chatWithOpenRouter) {
    // Detect query type for better handling
    const queryLower = userQuery.toLowerCase();
    const isCountingQuery = queryLower.includes('how many') || 
                           queryLower.includes('count') || 
                           queryLower.includes('total number') ||
                           queryLower.includes('number of');

    const systemPrompt = `You are an Airtable query interpreter. Given a user query and table schema, generate appropriate Airtable filter formulas and field selections.

Table Schema:
${JSON.stringify(tableSchema, null, 2)}

User Query: "${userQuery}"

IMPORTANT RULES:
1. For counting queries (how many, count, total number), ALWAYS set maxRecords to 20 to retrieve enough records for accurate counting
2. For specific item requests ("show me 5"), respect the requested number but cap at 20
3. For general queries without specific numbers, use 20 as default
4. Empty filterByFormula means "get all records"

Analyze the query and respond with ONLY a JSON object containing:
- filterByFormula: Airtable formula string (use Airtable formula syntax, empty string for all records)
- fields: Array of field names to return (empty array for all fields)
- maxRecords: Number between 1-20 (ALWAYS 20 for counting queries)
- sort: Array of sort specifications with field and direction

Examples:
- "How many doctors are there?" → {"filterByFormula": "{Type} = 'Doctor'", "fields": [], "maxRecords": 20, "sort": []}
- "Count all community members" → {"filterByFormula": "", "fields": [], "maxRecords": 20, "sort": []}
- "How many records in total?" → {"filterByFormula": "", "fields": [], "maxRecords": 20, "sort": []}
- "Show me 5 recent entries" → {"filterByFormula": "", "fields": [], "maxRecords": 5, "sort": [{"field": "Created", "direction": "desc"}]}
- "Find active users" → {"filterByFormula": "{Status} = 'Active'", "fields": [], "maxRecords": 20, "sort": []}

Query Type Detected: ${isCountingQuery ? 'COUNTING QUERY - Use maxRecords: 20' : 'REGULAR QUERY'}

Respond with valid JSON only, no other text.`;

    try {
      const response = await chatWithOpenRouter(model, systemPrompt);
      
      // Try to extract JSON from response
      let jsonMatch = response.match(/\{[\s\S]*\}/);
      let queryParams;
      
      if (jsonMatch) {
        queryParams = JSON.parse(jsonMatch[0]);
      } else {
        queryParams = JSON.parse(response);
      }

      // Post-processing validation for counting queries
      if (isCountingQuery && queryParams.maxRecords < 20) {
        console.log(`🔧 Correcting maxRecords for counting query: ${queryParams.maxRecords} → 20`);
        queryParams.maxRecords = 20;
      }

      // Ensure maxRecords is within bounds
      if (queryParams.maxRecords > 20) {
        queryParams.maxRecords = 20;
      }
      if (queryParams.maxRecords < 1) {
        queryParams.maxRecords = 1;
      }

      return queryParams;
    } catch (error) {
      console.error('Error interpreting query:', error);
      // Fallback to basic query - use 20 for counting queries, 20 for others
      return {
        filterByFormula: '',
        fields: [],
        maxRecords: 20,
        sort: []
      };
    }
  }

  async queryAirtable(consultantId, userQuery, model, chatWithOpenRouter) {
    console.log('\n🔍 === AIRTABLE QUERY START ===');
    console.log('User Query:', userQuery);
    console.log('Consultant ID:', consultantId);
    console.log('Model:', model);

    try {
      const config = await this.getAirtableConfig(consultantId);
      if (!config) {
        console.log('❌ No Airtable configuration found');
        return {
          success: false,
          error: 'Airtable not configured for this consultant. Please configure your Airtable connection first.'
        };
      }

      console.log('📋 Airtable Config:', {
        base_id: config.base_id,
        table_name: config.table_name,
        api_key: config.api_key ? `${config.api_key.substring(0, 8)}...` : 'missing'
      });

      const client = new AirtableClient(config.api_key, config.base_id);
      
      // Get table schema
      console.log('📊 Fetching table schema...');
      const tableSchema = await client.getTableSchema(config.table_name);
      console.log('Table Schema:', JSON.stringify(tableSchema, null, 2));
      
      // Interpret the user query
      console.log('🧠 Interpreting user query with LLM...');
      const queryParams = await this.interpretQuery(userQuery, tableSchema, model, chatWithOpenRouter);
      console.log('Generated Query Parameters:', JSON.stringify(queryParams, null, 2));
      
      // Execute the query
      console.log('🔎 Executing Airtable query...');
      const result = await client.select(config.table_name, queryParams);
      console.log(`📦 Retrieved ${result.records.length} records from Airtable`);
      console.log('Raw Airtable Response:', JSON.stringify(result, null, 2));
      
      // Format the response
      console.log('✨ Formatting response with LLM...');
      const formattedResponse = await this.formatAirtableResponse(
        result.records, 
        userQuery, 
        tableSchema, 
        model, 
        chatWithOpenRouter
      );
      console.log('Formatted Response:', formattedResponse);

      console.log('✅ === AIRTABLE QUERY SUCCESS ===\n');
      return {
        success: true,
        data: result.records,
        response: formattedResponse,
        recordCount: result.records.length
      };

    } catch (error) {
      console.error('❌ === AIRTABLE QUERY ERROR ===');
      console.error('Error details:', error);
      console.error('Stack trace:', error.stack);
      console.log('❌ === AIRTABLE QUERY END ===\n');
      return {
        success: false,
        error: `Failed to query Airtable: ${error.message}`
      };
    }
  }

  async formatAirtableResponse(records, originalQuery, tableSchema, model, chatWithOpenRouter) {
    const systemPrompt = `You are an Airtable data analyst. Format the following data into a natural, helpful response to the user's query.

Original Query: "${originalQuery}"

Table Schema:
${JSON.stringify(tableSchema, null, 2)}

Data Retrieved (${records.length} records):
${JSON.stringify(records, null, 2)}

Provide a natural language response that:
1. Directly answers the user's question
2. Summarizes key findings from the data
3. Presents the information in a clear, organized way
4. Includes relevant statistics or counts when appropriate
5. Uses markdown formatting for better readability

If the query was asking for a count, provide the exact number.
If showing records, format them in a readable table or list.
Be conversational but informative.`;

    try {
      const response = await chatWithOpenRouter(model, systemPrompt);
      return response;
    } catch (error) {
      console.error('Error formatting response:', error);
      // Fallback formatting
      return `Found ${records.length} records in the database:\n\n${records.map(record => 
        Object.entries(record.fields).map(([key, value]) => `**${key}**: ${value}`).join('\n')
      ).join('\n\n')}`;
    }
  }

  async testAirtableConnection(baseId, apiKey, tableName = null) {
    try {
      const client = new AirtableClient(apiKey, baseId);
      return await client.testConnection(tableName);
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAvailableTables(baseId, apiKey) {
    try {
      const client = new AirtableClient(apiKey, baseId);
      const tables = await client.listTables();
      return {
        success: true,
        tables: tables.map(table => ({
          name: table.name,
          id: table.id,
          fieldCount: table.fields ? table.fields.length : 0
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export { AirtableClient };
