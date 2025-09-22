import { BaseConsultant } from "./base-consultant.js";

export class AirtableConsultant extends BaseConsultant {
  async executeApiCall(apiAction) {
    // Get Airtable configuration dynamically
    const { AirtableService } = await import("../airtable-client.js");
    const airtableService = new AirtableService(this.db);
    const config = await airtableService.getAirtableConfig(this.id);
    
    if (!config) {
      throw new Error("Airtable configuration not found");
    }

    const { AirtableClient } = await import("../airtable-client.js");
    const client = new AirtableClient(config.api_key, config.base_id);

    // Execute the query based on the action parameters
    const queryParams = apiAction.parameters || {
      filterByFormula: '',
      fields: [],
      maxRecords: 20,
      sort: []
    };

    // Use table name from query parameters, not config
    const tableName = queryParams.table_name || config.table_name;
    if (!tableName) {
      throw new Error("Table name is required");
    }

    // Get table schema
    const tableSchema = await client.getTableSchema(tableName);

    const result = await client.select(tableName, queryParams);
    
    return {
      records: result.records,
      recordCount: result.records.length,
      tableSchema: tableSchema
    };
  }

  async interpretRequest(userMessage, context) {
    // For the new query builder approach, we don't need LLM interpretation
    // The query parameters come pre-structured from the UI
    // This method is kept for compatibility but will not be used for form-based queries
    
    if (!this.apiConfig) {
      return { needsApiCall: false };
    }

    // For direct chat messages (not from the query builder), we can still provide basic interpretation
    // but without generating complex formulas
    return {
      needsApiCall: true,
      action: "query_airtable",
      parameters: {
        filterByFormula: '',
        fields: [],
        maxRecords: 20,
        sort: []
      }
    };
  }

  async formatResponse(userMessage, apiAction, apiResponse, context) {
    if (!apiResponse) {
      return await super.formatResponse(userMessage, apiAction, apiResponse, context);
    }

    // Generate markdown table programmatically - no LLM needed
    return this.generateMarkdownTable(apiResponse, apiAction.parameters);
  }

  generateMarkdownTable(apiResponse, queryParams) {
    const { records, recordCount, tableSchema } = apiResponse;
    
    if (recordCount === 0) {
      return `## Query Results: No records found\n\n**Query Details:**\n- Table: ${tableSchema.name}\n- Filters: ${queryParams.filterByFormula || 'None'}\n- Records: 0`;
    }

    // Get all unique field names from the records
    const allFields = new Set();
    records.forEach(record => {
      Object.keys(record.fields).forEach(field => allFields.add(field));
    });
    
    const fieldNames = Array.from(allFields);
    
    // Create table header
    let markdown = `## Query Results: ${recordCount} record${recordCount !== 1 ? 's' : ''} from "${tableSchema.name}" table\n\n`;
    
    // Create markdown table
    const headers = fieldNames.map(field => this.cleanFieldName(field));
    markdown += `| ${headers.join(' | ')} |\n`;
    markdown += `|${headers.map(() => '---').join('|')}|\n`;
    
    // Add table rows
    records.forEach(record => {
      const row = fieldNames.map(field => {
        const value = record.fields[field];
        return this.formatFieldValue(value, field, tableSchema);
      });
      markdown += `| ${row.join(' | ')} |\n`;
    });
    
    // Add query details
    markdown += `\n**Query Details:**\n`;
    markdown += `- Table: ${tableSchema.name}\n`;
    
    if (queryParams.filterByFormula) {
      markdown += `- Filters: \`${queryParams.filterByFormula}\`\n`;
    } else {
      markdown += `- Filters: None\n`;
    }
    
    if (queryParams.fields && queryParams.fields.length > 0) {
      markdown += `- Fields: ${queryParams.fields.join(', ')}\n`;
    } else {
      markdown += `- Fields: All fields\n`;
    }
    
    if (queryParams.sort && queryParams.sort.length > 0) {
      const sortDesc = queryParams.sort.map(s => `${s.field} (${s.direction})`).join(', ');
      markdown += `- Sort: ${sortDesc}\n`;
    }
    
    markdown += `- Records: ${recordCount}${queryParams.maxRecords ? ` (limit: ${queryParams.maxRecords})` : ''}\n`;
    
    return markdown;
  }

  cleanFieldName(fieldName) {
    // Clean field names for table headers
    return fieldName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  formatFieldValue(value, fieldName, tableSchema) {
    if (value === null || value === undefined) {
      return '';
    }
    
    // Handle different data types
    if (Array.isArray(value)) {
      // Multiple select or linked records
      return value.join(', ');
    }
    
    if (typeof value === 'object') {
      // Handle attachment objects, user objects, etc.
      if (value.url) {
        return `[${value.filename || 'File'}](${value.url})`;
      }
      if (value.name) {
        return value.name;
      }
      if (value.email) {
        return `${value.name || value.email} <${value.email}>`;
      }
      return JSON.stringify(value);
    }
    
    if (typeof value === 'boolean') {
      return value ? '✓' : '✗';
    }
    
    if (typeof value === 'number') {
      // Format numbers nicely
      return value.toLocaleString();
    }
    
    if (typeof value === 'string') {
      // Handle dates
      if (this.isDateString(value)) {
        return this.formatDate(value);
      }
      
      // Truncate very long text
      if (value.length > 100) {
        return value.substring(0, 97) + '...';
      }
      
      // Escape pipe characters for markdown table
      return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    }
    
    return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  }

  isDateString(str) {
    // Check if string looks like a date
    const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/;
    return dateRegex.test(str);
  }

  formatDate(dateStr) {
    try {
      const date = new Date(dateStr);
      if (dateStr.includes('T')) {
        // DateTime
        return date.toLocaleString();
      } else {
        // Date only
        return date.toLocaleDateString();
      }
    } catch (error) {
      return dateStr;
    }
  }
}
