import path from "path";

import {
  createFolder,
  createFile,
  testAndFixPythonFile,
} from "../tools/fileTools";

export type ProjectStep = {
  id: number;
  task: string;
};

type GeneratedFile = {
  path: string;
  content: string;
};

function cleanCode(content: string): string {
  let cleaned = content.trim();

  cleaned = cleaned.replace(
    /^```[a-zA-Z0-9_-]*\s*/i,
    ""
  );

  cleaned = cleaned.replace(
    /\s*```$/i,
    ""
  );

  return cleaned.trim();
}

function normalizeFiles(
  value: any
): GeneratedFile[] {
  // Case 1:
  // Direct array
  if (Array.isArray(value)) {
    return value
      .filter(
        (file) =>
          file &&
          typeof file.path ===
            "string" &&
          typeof file.content ===
            "string"
      )
      .map((file) => ({
        path: file.path
          .replace(/^\/+/, "")
          .replace(/\.\./g, ""),
        content: cleanCode(
          file.content
        ),
      }));
  }

  // Case 2:
  // Object containing files
  if (
    value &&
    Array.isArray(value.files)
  ) {
    return normalizeFiles(
      value.files
    );
  }

  // Case 3:
  // Object containing project
  if (
    value &&
    Array.isArray(value.project)
  ) {
    return normalizeFiles(
      value.project
    );
  }

  return [];
}

async function generateProjectFiles(
  projectName: string,
  plan: ProjectStep[]
): Promise<GeneratedFile[]> {
  const response = await fetch(
    "http://127.0.0.1:11434/api/generate",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        model: "llama3.2:3b",

        prompt: `
You are JARVIS, an AI coding agent.

Build this project:

${projectName}

PLAN:

${plan
  .map(
    (step) =>
      `${step.id}. ${step.task}`
  )
  .join("\n")}

Create a small working Python project.

Return ONLY valid JSON.

The JSON must be an ARRAY.

Each item must have exactly:

"path"
"content"

Example:

[
  {
    "path": "calculator.py",
    "content": "def add(a, b):\\n    return a + b"
  },
  {
    "path": "main.py",
    "content": "from calculator import add\\nprint(add(2, 3))"
  },
  {
    "path": "README.md",
    "content": "# Calculator"
  }
]

IMPORTANT:

- Return the JSON array directly.
- Do not put the array inside another string.
- Do not use markdown.
- Do not use code fences.
- Do not create .json files.
- Do not create .spec files.
- Do not create package files.
- Use only .py files and README.md.
- Python code must be valid Python 3.
- Keep the project small.
        `,

        stream: false,

        format: "json",
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Ollama could not generate project files."
    );
  }

  const data =
    await response.json();

  const rawResponse =
    data.response?.trim() || "";

  if (!rawResponse) {
    throw new Error(
      "Ollama returned an empty response."
    );
  }

  console.log(
    "PROJECT GENERATOR RAW RESPONSE:"
  );

  console.log(
    rawResponse
  );

  try {
    let parsed =
      JSON.parse(rawResponse);

    // Sometimes the model returns
    // a JSON string containing JSON.
    if (
      typeof parsed ===
      "string"
    ) {
      try {
        parsed =
          JSON.parse(parsed);
      } catch {
        // Keep original parsed value.
      }
    }

    const files =
      normalizeFiles(parsed);

    if (files.length === 0) {
      throw new Error(
        "No usable project files were found."
      );
    }

    return files;
  } catch (error) {
    console.error(
      "PROJECT GENERATION ERROR:",
      error
    );

    console.error(
      "RAW RESPONSE:",
      rawResponse
    );

    throw new Error(
      "JARVIS could not understand the generated project files."
    );
  }
}

export async function executeProjectPlan(
  projectName: string,
  plan: ProjectStep[]
) {
  const results: string[] = [];

  // ==========================================
  // CREATE PROJECT FOLDER
  // ==========================================

  const folder =
    createFolder(projectName);

  results.push(
    `Created project folder: ${folder.path}`
  );

  // ==========================================
  // GENERATE PROJECT FILES
  // ==========================================

  results.push(
    "JARVIS is generating project files..."
  );

  const files =
    await generateProjectFiles(
      projectName,
      plan
    );

  results.push(
    `Generated ${files.length} project file(s).`
  );

  // ==========================================
  // CREATE FILES
  // ==========================================

  for (const file of files) {
    const filePath =
      path.join(
        projectName,
        file.path
      );

    createFile(
      filePath,
      file.content
    );

    results.push(
      `Created file: ${file.path}`
    );
  }

  // ==========================================
  // FIND PYTHON FILES
  // ==========================================

  const pythonFiles =
    files.filter(
      (file) =>
        file.path
          .toLowerCase()
          .endsWith(".py")
    );

  // ==========================================
  // TEST PYTHON FILES
  // ==========================================

  for (const file of pythonFiles) {
    const pythonPath =
      path.join(
        projectName,
        file.path
      );

    results.push(
      `Testing Python file: ${file.path}`
    );

    try {
      const result =
        await testAndFixPythonFile(
          pythonPath,
          3
        );

      if (result.success) {
        results.push(
          `✓ ${file.path} passed the test.`
        );

        if (
          result.output &&
          result.output !==
            "(Program produced no output.)"
        ) {
          results.push(
            `Output: ${result.output}`
          );
        }
      } else {
        results.push(
          `✗ ${file.path} failed testing.`
        );

        results.push(
          result.output
        );
      }

      results.push(
        `Attempts: ${result.attempts}`
      );
    } catch (error) {
      console.error(
        "PYTHON TEST ERROR:",
        error
      );

      results.push(
        `Could not test ${file.path}.`
      );
    }
  }

  // ==========================================
  // COMPLETE
  // ==========================================

  results.push(
    "Project build completed."
  );

  return {
    success: true,

    projectPath:
      folder.path,

    results,
  };
}