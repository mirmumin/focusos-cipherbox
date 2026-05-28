const Groq = require('groq-sdk');

// Lazy initialization
let groqClient = null;

async function callGroq(prompt, maxTokens = 1024) {
    try {
        if (!process.env.GROQ_API_KEY) {
            console.warn("GROQ_API_KEY is missing. Skipping AI call.");
            return null;
        }
        
        if (!groqClient) {
            groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }

        const completion = await groqClient.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama3-8b-8192", // Good for speed model.
            max_tokens: maxTokens
        });
        
        return completion.choices[0].message.content;
    } catch (error) {
        console.error("Groq AI Error:", error);
        return null;
    }
}

module.exports = { callGroq };
