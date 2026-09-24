export type ExtractedMemory = {
  category: string;
  key: string;
  value: string;
};

export async function extractMemories(
  message: string
): Promise<ExtractedMemory[]> {
  const response = await fetch(
    "http://127.0.0.1:11434/api/generate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.2:3b",

        prompt: `
You are a memory extraction system.

Read the user's message and extract only useful,
long-term information about the user.

Store information such as:
- personal facts
- preferences
- education
- work
- projects
- goals
- skills
- devices
- routines

Do NOT store temporary requests or normal conversation.

Return ONLY valid JSON.

Format:
[
  {
    "category": "personal",
    "key": "name",
    "value": "John"
  }
]

If there is nothing worth remembering, return:
[]

USER MESSAGE:
${message}
        `,

        stream: false,
      }),
    }
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();

  try {
    const cleaned = data.response
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const memories = JSON.parse(cleaned);

    if (!Array.isArray(memories)) {
      return [];
    }

    return memories;
  } catch {
    return [];
  }
}