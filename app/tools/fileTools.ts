import fs from "fs";
import path from "path";
import { execFile } from "child_process";

const WORKSPACE = path.join(
  process.cwd(),
  "workspace"
);

function safePath(relativePath: string) {
  const cleanPath = relativePath
    .replace(/^\/+/, "")
    .replace(/\.\./g, "");

  const fullPath = path.join(
    WORKSPACE,
    cleanPath
  );

  if (
    fullPath !== WORKSPACE &&
    !fullPath.startsWith(
      WORKSPACE + path.sep
    )
  ) {
    throw new Error("Invalid path.");
  }

  return fullPath;
}

export function createFolder(
  folderName: string
) {
  const safeName = folderName
    .replace(
      /[^a-zA-Z0-9 _-]/g,
      ""
    )
    .trim();

  if (!safeName) {
    throw new Error(
      "Invalid folder name."
    );
  }

  const folderPath =
    safePath(safeName);

  fs.mkdirSync(folderPath, {
    recursive: true,
  });

  return {
    success: true,
    path: folderPath,
  };
}

export function createFile(
  filePath: string,
  content: string = ""
) {
  const fullPath =
    safePath(filePath);

  const directory =
    path.dirname(fullPath);

  fs.mkdirSync(directory, {
    recursive: true,
  });

  fs.writeFileSync(
    fullPath,
    content,
    "utf8"
  );

  return {
    success: true,
    path: fullPath,
  };
}

export function readFile(
  filePath: string
) {
  const fullPath =
    safePath(filePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(
      "File does not exist."
    );
  }

  return {
    success: true,
    path: fullPath,
    content: fs.readFileSync(
      fullPath,
      "utf8"
    ),
  };
}

// ==========================================
// RUN PYTHON FILE
// ==========================================

export function runPythonFile(
  filePath: string
): Promise<{
  success: boolean;
  output: string;
}> {
  return new Promise(
    (resolve, reject) => {
      try {
        const fullPath =
          safePath(filePath);

        if (!fs.existsSync(fullPath)) {
          reject(
            new Error(
              `File does not exist: ${filePath}`
            )
          );
          return;
        }

        execFile(
          "python3",
          [fullPath],
          {
            cwd: WORKSPACE,
            timeout: 10000,
            maxBuffer:
              1024 * 1024,
          },
          (
            error,
            stdout,
            stderr
          ) => {
            if (error) {
              resolve({
                success: false,
                output:
                  stderr ||
                  stdout ||
                  error.message,
              });

              return;
            }

            resolve({
              success: true,
              output:
                stdout.trim() ||
                "(Program produced no output.)",
            });
          }
        );
      } catch (error) {
        reject(error);
      }
    }
  );
}

// ==========================================
// PYTHON SYNTAX CHECK
// ==========================================

export function checkPythonSyntax(
  filePath: string
): Promise<{
  success: boolean;
  output: string;
}> {
  return new Promise(
    (resolve, reject) => {
      try {
        const fullPath =
          safePath(filePath);

        if (!fs.existsSync(fullPath)) {
          reject(
            new Error(
              `File does not exist: ${filePath}`
            )
          );

          return;
        }

        execFile(
          "python3",
          [
            "-m",
            "py_compile",
            fullPath,
          ],
          {
            cwd: WORKSPACE,
            timeout: 10000,
            maxBuffer:
              1024 * 1024,
          },
          (
            error,
            stdout,
            stderr
          ) => {
            if (error) {
              resolve({
                success: false,
                output:
                  stderr ||
                  stdout ||
                  error.message,
              });

              return;
            }

            resolve({
              success: true,
              output:
                "Python syntax is valid.",
            });
          }
        );
      } catch (error) {
        reject(error);
      }
    }
  );
}

// ==========================================
// AUTOMATIC PYTHON TEST + FIX
// ==========================================

export async function testAndFixPythonFile(
  filePath: string,
  maxAttempts: number = 3
): Promise<{
  success: boolean;
  output: string;
  attempts: number;
}> {
  const fullPath =
    safePath(filePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `File does not exist: ${filePath}`
    );
  }

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    // ========================================
    // FIRST CHECK PYTHON SYNTAX
    // ========================================

    const syntaxResult =
      await checkPythonSyntax(
        filePath
      );

    if (!syntaxResult.success) {
      const currentCode =
        fs.readFileSync(
          fullPath,
          "utf8"
        );

      const response =
        await fetch(
          "http://127.0.0.1:11434/api/generate",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              model:
                "llama3.2:3b",

              prompt: `
You are an expert Python debugging agent.

Fix this Python program.

PYTHON ERROR:
${syntaxResult.output}

CURRENT PYTHON CODE:
${currentCode}

Rules:

- Return the complete corrected Python program.
- Return Python code only.
- Do not use markdown.
- Do not use code fences.
- Do not explain anything.
- Make the code valid Python 3.
- Check indentation.
- Check loops.
- Make sure break statements are inside loops.
- Make sure continue statements are inside loops.
- Make sure return statements are inside functions.

Return ONLY the corrected Python code.
              `,

              stream: false,
            }),
          }
        );

      if (!response.ok) {
        return {
          success: false,
          output:
            "Could not connect to Ollama to fix the code.",
          attempts: attempt,
        };
      }

      const data =
        await response.json();

      let fixedCode =
        data.response?.trim() ||
        "";

      if (!fixedCode) {
        return {
          success: false,
          output:
            "Ollama did not return corrected code.",
          attempts: attempt,
        };
      }

      fixedCode =
        fixedCode
          .replace(
            /^```python\s*/i,
            ""
          )
          .replace(
            /^```py\s*/i,
            ""
          )
          .replace(
            /^```\s*/i,
            ""
          )
          .replace(
            /\s*```$/i,
            ""
          )
          .trim();

      fs.writeFileSync(
        fullPath,
        fixedCode,
        "utf8"
      );

      continue;
    }

    // ========================================
    // SYNTAX IS VALID
    // ========================================

    const currentCode =
      fs.readFileSync(
        fullPath,
        "utf8"
      );

    // ========================================
    // CHECK IF PROGRAM NEEDS USER INPUT
    // ========================================

    const needsInput =
      /\binput\s*\(/.test(
        currentCode
      );

    if (needsInput) {
      return {
        success: true,

        output:
          "Python syntax is valid. Interactive input() detected, so runtime execution was skipped.",

        attempts: attempt,
      };
    }

    // ========================================
    // RUN NON-INTERACTIVE PROGRAM
    // ========================================

    const result =
      await runPythonFile(
        filePath
      );

    if (result.success) {
      return {
        success: true,
        output: result.output,
        attempts: attempt,
      };
    }

    // ========================================
    // RUNTIME ERROR — ASK OLLAMA TO FIX
    // ========================================

    const response =
      await fetch(
        "http://127.0.0.1:11434/api/generate",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            model:
              "llama3.2:3b",

            prompt: `
You are an expert Python debugging agent.

The Python program produced this runtime error:

${result.output}

CURRENT PYTHON CODE:

${currentCode}

Fix the program.

Rules:

- Return the complete corrected Python program.
- Return Python code only.
- Do not use markdown.
- Do not use code fences.
- Do not explain anything.
- Preserve the intended functionality.
- Make sure the final code is valid Python 3.
- Check indentation carefully.
- Check loops carefully.
- Make sure break is only inside loops.
- Make sure continue is only inside loops.
- Make sure return is only inside functions.

Return ONLY the corrected Python code.
            `,

            stream: false,
          }),
        }
      );

    if (!response.ok) {
      return {
        success: false,
        output:
          "Could not connect to Ollama to fix the code.",
        attempts: attempt,
      };
    }

    const data =
      await response.json();

    let fixedCode =
      data.response?.trim() ||
      "";

    if (!fixedCode) {
      return {
        success: false,
        output:
          "Ollama did not return corrected code.",
        attempts: attempt,
      };
    }

    fixedCode =
      fixedCode
        .replace(
          /^```python\s*/i,
          ""
        )
        .replace(
          /^```py\s*/i,
          ""
        )
        .replace(
          /^```\s*/i,
          ""
        )
        .replace(
          /\s*```$/i,
          ""
        )
        .trim();

    fs.writeFileSync(
      fullPath,
      fixedCode,
      "utf8"
    );
  }

  // ==========================================
  // FINAL TEST
  // ==========================================

  const finalResult =
    await runPythonFile(
      filePath
    );

  return {
    success:
      finalResult.success,

    output:
      finalResult.output,

    attempts:
      maxAttempts,
  };
}