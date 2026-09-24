import { execFile } from "child_process";

function runGitCommand(
  args: string[]
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      execFile(
        "git",
        args,
        {
          cwd: process.cwd(),
          timeout: 30000,
          maxBuffer:
            1024 * 1024,
        },
        (
          error,
          stdout,
          stderr
        ) => {
          if (error) {
            reject(
              new Error(
                stderr ||
                  stdout ||
                  error.message
              )
            );

            return;
          }

          resolve(
            stdout.trim()
          );
        }
      );
    }
  );
}

export async function getGitStatus() {
  const output =
    await runGitCommand([
      "status",
      "--short",
    ]);

  return {
    success: true,
    output:
      output ||
      "Working tree is clean.",
  };
}

export async function commitAndPush(
  message: string
) {
  // ==========================================
  // CHECK STATUS
  // ==========================================

  const status =
    await getGitStatus();

  if (
    status.output ===
    "Working tree is clean."
  ) {
    return {
      success: true,
      output:
        "There are no changes to commit.",
    };
  }

  // ==========================================
  // ADD CHANGES
  // ==========================================

  await runGitCommand([
    "add",
    ".",
  ]);

  // ==========================================
  // COMMIT
  // ==========================================

  const commitOutput =
    await runGitCommand([
      "commit",
      "-m",
      message,
    ]);

  // ==========================================
  // PUSH TO GITHUB
  // ==========================================

  const pushOutput =
    await runGitCommand([
      "push",
    ]);

  return {
    success: true,

    output:
      [
        "Changes committed.",
        commitOutput,
        "Changes pushed to GitHub.",
        pushOutput,
      ]
        .filter(Boolean)
        .join("\n"),
  };
}