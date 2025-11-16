import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AICompleteOptions = {
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" | "text" };
};

export async function aiComplete(
  messages: Message[],
  options?: AICompleteOptions
): Promise<string> {
  const primaryModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const fallbackModel = process.env.OPENAI_MODEL_FALLBACK || "gpt-4o";

  try {
    console.log(`[AI] Using model: ${primaryModel}`);

    const res = await client.chat.completions.create({
      model: primaryModel,
      messages,
      ...options,
    });

    return res.choices[0]?.message?.content || "";
  } catch (err) {
    console.warn(
      `[AI] Primary model "${primaryModel}" failed. Retrying with fallback "${fallbackModel}". Error:`,
      err
    );

    const res = await client.chat.completions.create({
      model: fallbackModel,
      messages,
      ...options,
    });

    return res.choices[0]?.message?.content || "";
  }
}

