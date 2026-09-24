export type PlanStep = {
  id: number;
  task: string;
};

export async function createPlan(
  request: string
): Promise<PlanStep[]> {
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
You are a project planning assistant.

Create a simple step-by-step plan for this project:

${request}

Return ONLY valid JSON.

Use exactly this format:

[
  {
    "id": 1,
    "task": "Create the project folder"
  },
  {
    "id": 2,
    "task": "Create the main file"
  },
  {
    "id": 3,
    "task": "Test the project"
  }
]

Rules:
- Return between 2 and 10 steps.
- Every step must have an id.
- Every step must have a task.
- Do not use markdown.
- Do not use code fences.
- Do not add explanations.
- Return JSON only.
        `,

        stream: false,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Ollama planner request failed."
    );
  }

  const data =
    await response.json();

  const rawPlan =
    data.response?.trim();

  if (!rawPlan) {
    throw new Error(
      "Ollama returned an empty plan."
    );
  }

  try {
    const cleanedPlan =
      rawPlan
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    const plan =
      JSON.parse(cleanedPlan);

    if (!Array.isArray(plan)) {
      throw new Error(
        "Planner did not return an array."
      );
    }

    const validPlan =
      plan
        .filter(
          (step) =>
            step &&
            typeof step.id ===
              "number" &&
            typeof step.task ===
              "string"
        )
        .map((step) => ({
          id: step.id,
          task: step.task.trim(),
        }));

    if (validPlan.length < 2) {
      throw new Error(
        "Planner returned too few steps."
      );
    }

    return validPlan;
  } catch (error) {
    console.error(
      "PLANNER JSON ERROR:",
      error
    );

    console.error(
      "OLLAMA RESPONSE:",
      rawPlan
    );

    throw new Error(
      "JARVIS could not understand the generated plan."
    );
  }
}