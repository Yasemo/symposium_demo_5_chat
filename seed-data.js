import { ConsultantTemplateManager } from "./consultants/consultant-factory.js";

// Seed data for demonstration purposes
export async function seedDatabase(db) {
    console.log("Seeding database with example data...");
    
    try {
        // Check if data already exists
        const existingSymposiums = await db.prepare("SELECT COUNT(*) as count FROM symposiums").get();
        if (existingSymposiums.count > 0) {
            console.log("Database already has data, skipping seed.");
            return;
        }

        // Create example symposium
        const symposium = await db.prepare(`
            INSERT INTO symposiums (name, description, created_at) 
            VALUES (?, ?, datetime('now')) 
            RETURNING *
        `).get(
            "Digital Product Launch Strategy",
            "A collaborative symposium to develop a comprehensive strategy for launching a new SaaS product. We need to cover market research, product positioning, pricing strategy, marketing channels, and launch timeline. Each consultant brings specialized expertise to help create a winning go-to-market plan."
        );

        console.log("Created symposium:", symposium.name);

        // Create example consultants
        const consultants = [
            {
                name: "Market Research Analyst",
                model: "anthropic/claude-3.5-sonnet",
                system_prompt: "You are a senior market research analyst with 15+ years of experience in SaaS and tech markets. Your expertise includes competitive analysis, market sizing, customer segmentation, and identifying market opportunities. You provide data-driven insights and help validate market assumptions. You always back your recommendations with research methodologies and market data. You're analytical, thorough, and excel at identifying market trends and customer pain points.",
                consultant_type: "standard"
            },
            {
                name: "Product Marketing Strategist", 
                model: "openai/gpt-4o",
                system_prompt: "You are a product marketing strategist specializing in SaaS product launches. You excel at product positioning, messaging, pricing strategy, and go-to-market planning. You understand how to translate product features into customer benefits and create compelling value propositions. You're strategic, creative, and skilled at developing marketing frameworks that drive product adoption. You always consider the customer journey and competitive landscape in your recommendations.",
                consultant_type: "standard"
            },
            {
                name: "Growth Marketing Expert",
                model: "google/gemini-pro-1.5",
                system_prompt: "You are a growth marketing expert focused on scalable customer acquisition and retention strategies. Your expertise includes digital marketing channels, conversion optimization, customer lifecycle marketing, and growth experimentation. You're data-driven, creative, and excel at building marketing funnels that drive sustainable growth. You understand both B2B and B2C marketing dynamics and can recommend the most effective channels for different target audiences.",
                consultant_type: "standard"
            },
            {
                name: "Business Strategy Consultant",
                model: "anthropic/claude-3-opus",
                system_prompt: "You are a senior business strategy consultant with expertise in strategic planning, business model design, and organizational development. You help companies make critical strategic decisions and develop long-term competitive advantages. You're analytical, strategic, and excel at seeing the big picture while considering operational details. You provide frameworks for decision-making and help align business objectives with market opportunities.",
                consultant_type: "standard"
            },
            {
                name: "Airtable Data Assistant",
                model: "anthropic/claude-3.5-sonnet",
                system_prompt: "You are an Airtable Data Assistant specialized in querying and analyzing data from Airtable databases. You help users retrieve information from their Airtable bases by interpreting natural language queries and converting them into appropriate database operations. You can answer questions about record counts, find specific entries, analyze data patterns, and provide insights based on the data. You're knowledgeable about Airtable's structure and can work with various field types including text, numbers, dates, attachments, and relationships. When users ask about their data, you query the connected Airtable base and provide clear, formatted responses with the relevant information. You always limit results to a maximum of 20 records to keep responses manageable. If the Airtable connection isn't configured, you guide users through the setup process.",
                consultant_type: "airtable"
            }
        ];

        for (const consultant of consultants) {
            const createdConsultant = await db.prepare(`
                INSERT INTO consultants (symposium_id, name, model, system_prompt, consultant_type, created_at) 
                VALUES (?, ?, ?, ?, ?, datetime('now')) 
                RETURNING *
            `).get(symposium.id, consultant.name, consultant.model, consultant.system_prompt, consultant.consultant_type);
            
            console.log("Created consultant:", createdConsultant.name);
        }

        // Create a welcome message
        const welcomeMessage = await db.prepare(`
            INSERT INTO messages (symposium_id, consultant_id, content, is_user, timestamp) 
            VALUES (?, ?, ?, ?, datetime('now')) 
            RETURNING *
        `).get(
            symposium.id,
            null,
            "Welcome to the Digital Product Launch Strategy symposium! 🚀\n\nI've assembled a team of expert consultants to help you develop a comprehensive go-to-market strategy:\n\n• Market Research Analyst - for competitive analysis and market validation\n• Product Marketing Strategist - for positioning and messaging\n• Growth Marketing Expert - for customer acquisition strategies  \n• Business Strategy Consultant - for strategic planning and business model optimization\n\nFeel free to ask any consultant about their area of expertise, or pose questions to the group. Each consultant can see the full conversation history, so they'll build on each other's insights to give you the best strategic advice.\n\nWhat aspect of your product launch would you like to explore first?",
            0
        );

        console.log("✅ Database seeded successfully with example symposium and consultants!");
        
    } catch (error) {
        console.error("Error seeding database:", error);
    }
}
