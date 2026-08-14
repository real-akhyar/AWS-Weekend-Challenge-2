import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({});
const modelId = process.env.MODEL_ID || "amazon.nova-lite-v1:0";
const allowedAnimals = new Set(["otter", "frog", "capybara", "crow", "axolotl", "moth"]);
const allowedDays = new Set([
  "I got through a difficult day",
  "I made a brave choice",
  "I feel a little stuck",
  "I did something I am proud of",
  "I need a gentle reset",
]);
const allowedThemes = new Set(["dusk", "moss", "tide"]);

const response = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(body),
});

const cleanText = (value, maxLength) => typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export const handler = async (event) => {
  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { message: "Please send valid JSON." });
  }

  const animal = cleanText(input.animal, 20);
  const day = cleanText(input.day, 80);
  const detail = cleanText(input.detail, 160);
  if (!allowedAnimals.has(animal) || !allowedDays.has(day)) {
    return response(400, { message: "Choose a creature and a day type from the form." });
  }

  const prompt = `Create one encouraging, all-ages compliment creature.
Animal: ${animal}
How their day went: ${day}
Optional detail: ${detail || "None"}

Return only a JSON object with exactly these properties:
- name: a whimsical 1-3 word creature name
- compliment: one warm, original compliment of no more than 38 words
- trait: one playful quirky trait of no more than 18 words
- theme: exactly one of dusk, moss, tide

Do not mention AI, prompts, or JSON. Do not use markdown.`;

  try {
    const result = await client.send(new ConverseCommand({
      modelId,
      messages: [{ role: "user", content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 180, temperature: 0.85 },
    }));
    const text = result.output?.message?.content?.[0]?.text || "";
    const generated = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "").trim());
    const creature = {
      name: cleanText(generated.name, 48),
      compliment: cleanText(generated.compliment, 300),
      trait: cleanText(generated.trait, 160),
      theme: allowedThemes.has(generated.theme) ? generated.theme : "dusk",
    };
    if (!creature.name || !creature.compliment || !creature.trait) throw new Error("Invalid model response");
    return response(200, creature);
  } catch (error) {
    console.error("Creature generation failed", { name: error.name, message: error.message });
    return response(502, { message: "Our creatures are taking a tiny nap. Please try again shortly." });
  }
};
