const { OpenAI } = require("openai");

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY, 
});

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Método no permitido" };
  }

  try {
    const { messages, system } = JSON.parse(event.body);

    const apiMessages = [];
    if (system) {
      apiMessages.push({ role: "system", content: system });
    }
    apiMessages.push(...messages);

    const completion = await openai.chat.completions.create({
      model: "google/gemma-4-31b-it:free",
      messages: apiMessages,
    });

    const aiResponse = completion.choices[0].message.content;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ content: aiResponse }),
    };
  } catch (error) {
    console.error("Error en la función de chat de OpenRouter:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Error interno procesando el chat con OpenRouter." }),
    };
  }
};