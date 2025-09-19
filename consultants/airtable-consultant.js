import { BaseConsultant } from "./base-consultant.js";
import { chatWithOpenRouter } from "../openrouter.js";

export class AirtableConsultant extends BaseConsultant {
  async executeApiCall(apiAction) {
    if (!this.apiConfig) {
      throw new Error("Airtable configuration not found");
    }

    const { AirtableClient } = await import("../airtable-client.js");
    const client = new AirtableClient(this.apiConfig.api_key, this.apiConfig.base_id);

    // Get table schema
    const tableSchema = await client.getTableSchema(this.apiConfig.table_name);

    // Execute the query based on the action parameters
    const queryParams = apiAction.parameters || {
      filterByFormula: '',
      fields: [],
      maxRecords: 20,
      sort: []
    };

    const result = await client.select(this.apiConfig.table_name, queryParams);
    
    return {
      records: result.records,
      recordCount: result.records.length,
      tableSchema: tableSchema
    };
  }

  async interpretRequest(userMessage, context) {
    if (!this.apiConfig) {
      return { needsApiCall: false };
    }

    const { AirtableClient } = await import("../airtable-client.js");
    const client = new AirtableClient(this.apiConfig.api_key, this.apiConfig.base_id);
    const tableSchema = await client.getTableSchema(this.apiConfig.table_name);

    const interpretPrompt = `You are an Airtable query interpreter. Given a user query and table schema, determine if an Airtable API call is needed and generate appropriate parameters.

Table Schema:
${JSON.stringify(tableSchema, null, 2)}

User Message: "${userMessage}"

Context: ${context}

Analyze the query and respond with a JSON object containing:
- needsApiCall: boolean (true if the user is asking about data that would be in Airtable)
- action: "query_airtable" (if needsApiCall is true)
- parameters: object with Airtable query parameters:
  - filterByFormula: Airtable formula string (empty string for all records)
  - fields: Array of field names to return (empty array for all fields)
  - maxRecords: Number between 1-20 (20 for counting queries)
  - sort: Array of sort specifications with field and direction

If the user is just having a conversation or asking about something unrelated to the data, set needsApiCall to false.`;

    try {
      const response = await chatWithOpenRouter(this.model, interpretPrompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Ensure maxRecords is within bounds
        if (parsed.parameters && parsed.parameters.maxRecords) {
          parsed.parameters.maxRecords = Math.min(Math.max(parsed.parameters.maxRecords, 1), 20);
        }
        
        return parsed;
      } else {
        return { needsApiCall: false };
      }
    } catch (error) {
      console.error('Error interpreting Airtable request:', error);
      return { needsApiCall: false };
    }
  }

  async formatResponse(userMessage, apiAction, apiResponse, context) {
    if (!apiResponse) {
      return await super.formatResponse(userMessage, apiAction, apiResponse, context);
    }

    const formatPrompt = `You are an Airtable data analyst. Format the following data into a natural, helpful response to the user's query.

Original Query: "${userMessage}"

Table Schema:
${JSON.stringify(apiResponse.tableSchema, null, 2)}

Data Retrieved (${apiResponse.recordCount} records):
${JSON.stringify(apiResponse.records, null, 2)}

Context: ${context}

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
      return await chatWithOpenRouter(this.model, formatPrompt);
    } catch (error) {
      console.error('Error formatting Airtable response:', error);
      // Fallback formatting
      return `Found ${apiResponse.recordCount} records in the database:\n\n${apiResponse.records.map(record => 
        Object.entries(record.fields).map(([key, value]) => `**${key}**: ${value}`).join('\n')
      ).join('\n\n')}`;
    }
  }
}
