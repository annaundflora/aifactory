export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatParams {
  model: string;
  messages: ChatMessage[];
  timeout?: number;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function chat(params: ChatParams): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY ist nicht gesetzt. Bitte in .env konfigurieren."
    );
  }

  const controller = new AbortController();
  const timeoutMs = params.timeout ?? 30000;
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: params.model,
          messages: params.messages,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `OpenRouter API Fehler (${response.status}): ${errorText || response.statusText}`
      );
    }

    const data: OpenRouterResponse = await response.json();

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter lieferte keine Antwort.");
    }

    return content;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `OpenRouter request timed out after ${timeoutMs / 1000} seconds`
      );
    }
    throw error;
  }
}

export const openRouterClient = {
  chat,
};
