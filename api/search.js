exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const { query } = JSON.parse(event.body);

    // Ejemplo usando Tavily API para obtener resultados limpios para IA
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: query,
        search_depth: "basic",
      }),
    });

    const data = await response.json();
    
    // Extraemos los fragmentos de texto relevantes de la búsqueda
    const resultsText = data.results.map(r => `Título: ${r.title}\nContenido: ${r.content}\n`).join("\n");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ results: resultsText }), // Tu script busca la propiedad 'results' o 'text'
    };
  } catch (error) {
    console.error("Error en la función de búsqueda:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ results: "No se pudo obtener resultados de búsqueda." }),
    };
  }
};