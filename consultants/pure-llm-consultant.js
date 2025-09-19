import { BaseConsultant } from "./base-consultant.js";

export class PureLLMConsultant extends BaseConsultant {
  async executeApiCall(apiAction) {
    // Pure LLM consultants don't make external API calls
    return null;
  }

  async interpretRequest(userMessage, context) {
    // Pure LLM consultants never need API calls
    return { needsApiCall: false };
  }

  async formatResponse(userMessage, apiAction, apiResponse, context) {
    // For pure LLM consultants, we just use the base implementation
    // which will call the LLM with the system prompt and context
    return await super.formatResponse(userMessage, apiAction, apiResponse, context);
  }
}
