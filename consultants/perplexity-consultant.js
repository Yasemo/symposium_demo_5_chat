import { BaseConsultant } from "./base-consultant.js";
import { chatWithOpenRouter } from "../openrouter.js";

export class PerplexityConsultant extends BaseConsultant {
  async executeApiCall(apiAction) {
    if (!this.apiConfig || !this.apiConfig.api_key) {
      throw new Error("Perplexity API key not configured");
    }

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiConfig.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: "You are a helpful research assistant. Provide accurate, up-to-date information with sources when possible."
          },
          {
            role: "user",
            content: apiAction.parameters.query
          }
        ],
        temperature: 0.2,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Perplexity API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Invalid response format from Perplexity");
    }

    return {
      searchResults: data.choices[0].message.content,
      model: data.model,
      usage: data.usage
    };
  }

  async interpretRequest(userMessage, context) {
    const interpretPrompt = `You are a research assistant that uses Perplexity AI for web searches and current information.

User Message: "${userMessage}"
Context: ${context}

Determine if this request requires a web search or current information lookup.

Respond with a JSON object containing:
- needsApiCall: boolean (true if the user is asking for current information, research, facts, news, or anything that would benefit from web search)
- action: "web_search" (if needsApiCall is true)
- parameters: object with:
  - query: string (the search query to send to Perplexity)

Examples of queries that need API calls:
- "What's the latest news about AI?"
- "How does photosynthesis work?"
- "What are the current stock prices?"
- "Research the benefits of meditation"

Examples that don't need API calls:
- "Hello, how are you?"
- "Can you help me with math?"
- Personal opinions or creative tasks`;

    try {
      const response = await chatWithOpenRouter(this.model, interpretPrompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        return { needsApiCall: false };
      }
    } catch (error) {
      console.error('Error interpreting Perplexity request:', error);
      return { needsApiCall: false };
    }
  }

  async formatResponse(userMessage, apiAction, apiResponse, context) {
    if (!apiResponse) {
      return await super.formatResponse(userMessage, apiAction, apiResponse, context);
    }

    const formatPrompt = `${this.getEnhancedSystemPrompt()}

You are a research assistant. The user asked: "${userMessage}"

You performed a web search and received the following information:

${apiResponse.searchResults}

Context: ${context}

Based on the search results, provide a comprehensive, well-formatted response that:
1. Directly answers the user's question
2. Includes the most relevant and up-to-date information
3. Maintains proper attribution to sources when mentioned
4. Uses the enhanced markdown formatting features to create rich, engaging content
5. Is conversational and helpful

Use appropriate visualizations (charts, diagrams, callouts) when the data supports it. Format your response using the enhanced markdown capabilities for maximum clarity and engagement.`;

    try {
      return await chatWithOpenRouter(this.model, formatPrompt);
    } catch (error) {
      console.error('Error formatting Perplexity response:', error);
      // Fallback to raw search results
      return `Based on my research:\n\n${apiResponse.searchResults}`;
    }
  }
}
