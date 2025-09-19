import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";

const env = await load();
const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY || Deno.env.get("OPENROUTER_API_KEY");
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

if (!OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY not found in environment variables");
}

export async function getOpenRouterModels() {
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Filter and format models with pricing information
    const models = data.data
      .filter(model => !model.id.includes("free") && model.pricing) // Filter out free models and ensure pricing exists
      .map(model => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description || "",
        context_length: model.context_length || 0,
        pricing: {
          prompt: parseFloat(model.pricing.prompt || 0),
          completion: parseFloat(model.pricing.completion || 0),
        },
        top_provider: model.top_provider || {},
      }))
      .sort((a, b) => {
        // Sort by total cost (prompt + completion) ascending
        const aCost = a.pricing.prompt + a.pricing.completion;
        const bCost = b.pricing.prompt + b.pricing.completion;
        return aCost - bCost;
      });

    return { models };
  } catch (error) {
    console.error("Error fetching OpenRouter models:", error);
    throw new Error("Failed to fetch available models");
  }
}

export async function getOpenRouterCredits() {
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/credits`, {
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log("OpenRouter Credits Response:", data); // Debug logging

    // Parse credits response
    const creditsData = data.data || data;

    return {
      total_credits: creditsData.total_credits || 0,
      total_usage: creditsData.total_usage || 0,
      remaining_credits: (creditsData.total_credits || 0) - (creditsData.total_usage || 0),
      is_free_tier: false, // Credits endpoint implies paid account
      rate_limit: {}
    };
  } catch (error) {
    console.error("Error fetching OpenRouter credits:", error);
    throw new Error(`Failed to get credit information: ${error.message}`);
  }
}

// Keep the old function for backward compatibility (can be removed later)
export async function getOpenRouterAuth() {
  return await getOpenRouterCredits();
}

export async function chatWithOpenRouter(model, message) {
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:8000",
        "X-Title": "Symposium Chat App",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: message,
          },
        ],
        temperature: 0.7,
        max_tokens: 10000,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Invalid response format from OpenRouter");
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error calling OpenRouter chat:", error);
    throw new Error(`Failed to get response from ${model}: ${error.message}`);
  }
}
