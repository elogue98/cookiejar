import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Parsed recipe structure from image recognition
 */
export type ParsedRecipe = {
  title: string;
  ingredients: string[];
  instructions: string[];
  tags?: string[];
  image_url?: string | null;
};

/**
 * Convert File or Buffer to base64 string
 */
async function fileToBase64(file: File | Buffer): Promise<string> {
  if (file instanceof File) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString("base64");
  } else {
    return file.toString("base64");
  }
}

/**
 * Get MIME type from File or infer from Buffer
 */
function getMimeType(file: File | Buffer): string {
  if (file instanceof File) {
    return file.type || "image/jpeg";
  }
  // For Buffer, default to JPEG (most common)
  return "image/jpeg";
}

/**
 * Trim whitespace from strings in an array
 */
function trimArray(arr: string[]): string[] {
  return arr.map((item) => item.trim()).filter((item) => item.length > 0);
}

/**
 * Deduplicate lines in an array (case-insensitive)
 */
function deduplicateArray(arr: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of arr) {
    const lower = item.toLowerCase().trim();
    if (lower && !seen.has(lower)) {
      seen.add(lower);
      result.push(item);
    }
  }

  return result;
}

/**
 * Normalize ingredient formats
 * - Remove leading numbers/bullets if they're just list markers
 * - Normalize spacing
 * - Remove redundant punctuation
 */
function normalizeIngredient(ingredient: string): string {
  let normalized = ingredient.trim();

  // Remove leading list markers like "1.", "-", "•", etc.
  normalized = normalized.replace(/^[\d\s\-•·\u2022\u2023\u25E6\s]+/, "");

  // Normalize multiple spaces to single space
  normalized = normalized.replace(/\s+/g, " ");

  // Remove trailing punctuation that's not part of the ingredient
  normalized = normalized.replace(/[,;]+$/, "");

  return normalized.trim();
}

/**
 * Normalize instruction formats
 * - Remove leading step numbers
 * - Normalize spacing
 */
function normalizeInstruction(instruction: string): string {
  let normalized = instruction.trim();

  // Remove leading step numbers like "Step 1:", "1.", etc.
  normalized = normalized.replace(/^(step\s+\d+[:.]?\s*)/i, "");
  normalized = normalized.replace(/^\d+[.:]\s*/, "");

  // Normalize multiple spaces to single space
  normalized = normalized.replace(/\s+/g, " ");

  return normalized.trim();
}

/**
 * Post-process parsed recipe data
 */
type RawRecipe = {
  title?: unknown;
  ingredients?: unknown;
  instructions?: unknown;
  tags?: unknown;
};

function postProcessRecipe(raw: RawRecipe): ParsedRecipe {
  // Extract and clean title
  const title = typeof raw.title === "string" ? raw.title.trim() : "";

  // Extract and clean ingredients
  let ingredients: string[] = [];
  if (Array.isArray(raw.ingredients)) {
    ingredients = raw.ingredients
      .map((ing) => {
        const str = typeof ing === "string" ? ing : String(ing ?? "");
        return normalizeIngredient(str);
      })
      .filter((ing) => ing.length > 0);
  }
  ingredients = deduplicateArray(ingredients);

  // Extract and clean instructions
  let instructions: string[] = [];
  if (Array.isArray(raw.instructions)) {
    instructions = raw.instructions
      .map((inst) => {
        const str = typeof inst === "string" ? inst : String(inst ?? "");
        return normalizeInstruction(str);
      })
      .filter((inst) => inst.length > 0);
  }
  instructions = deduplicateArray(instructions);

  // Extract and clean tags (optional)
  let tags: string[] | undefined = undefined;
  if (Array.isArray(raw.tags)) {
    tags = raw.tags
      .map((tag) => {
        const str = typeof tag === "string" ? tag : String(tag ?? "");
        return str.toLowerCase().trim();
      })
      .filter((tag) => tag.length > 0);
    tags = Array.from(new Set(tags)); // Deduplicate
    if (tags.length === 0) {
      tags = undefined;
    }
  }

  return {
    title: title || "Untitled Recipe",
    ingredients,
    instructions,
    tags,
    image_url: null, // Image URL is not extracted from the image itself
  };
}

/**
 * Parse recipe from an image using OpenAI Vision API
 * 
 * @param file - Image file (File or Buffer)
 * @returns Parsed recipe with cleaned and normalized data
 */
export async function parseImageRecipe(
  file: File | Buffer
): Promise<ParsedRecipe> {
  // Convert image to base64
  const base64Image = await fileToBase64(file);
  const mimeType = getMimeType(file);

  // Strict system prompt for JSON extraction
  const systemPrompt = `You extract structured recipes from images. Return pure JSON:

{
  "title": "...",
  "ingredients": ["..."],
  "instructions": ["..."],
  "tags": ["..."]
}

Only return JSON. No markdown, no explanations, no code blocks. Just the JSON object.`;

  const userPrompt = `Extract the recipe from this image. Return a JSON object with:
- title: The recipe name
- ingredients: Array of ingredient strings (one per line/item)
- instructions: Array of instruction steps (one per step)
- tags: Optional array of relevant tags (cuisine, dietary, cooking method, etc.)

Handle:
- Phone photos of cookbooks
- Printed recipe cards
- Screenshots of recipes

Return ONLY the JSON object, nothing else.`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      max_tokens: 2000, // Enough for full recipe
      response_format: { type: "json_object" }, // Force JSON response
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI Vision API");
    }

    // Parse JSON response
    let parsed: unknown;
    try {
      // Try direct JSON parse
      parsed = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                       content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } catch {
          throw new Error("Failed to parse JSON from response");
        }
      } else {
        throw new Error("No valid JSON found in response");
      }
    }

    // Post-process and return
    return postProcessRecipe(parsed as RawRecipe);
  } catch (error) {
    console.error("Error parsing image recipe:", error);
    throw new Error(
      `Failed to parse recipe from image: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
