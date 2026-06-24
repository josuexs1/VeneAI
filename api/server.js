const express = require('express');
const { OpenAI } = require('openai');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    // --- MODIFICACIÓN AQUÍ ---
    // Esta instrucción se envía SIEMPRE como la regla principal del chat
    const systemPrompt = { 
      role: "system", 
      content: "Eres VeneAI, un asistente de inteligencia artificial desarrollado por Josuexs. VeneAI es una empresa de software venezolana. Tu identidad es VeneAI. Siempre respondes como VeneAI y reconoces a VeneAI como tu creador." 
    };

    // Combinamos la instrucción de sistema con los mensajes del usuario
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-oss-120b:free",
      messages: [systemPrompt, ...messages], 
      max_tokens: 1000,
    });
    // -------------------------

    res.json({ content: completion.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));