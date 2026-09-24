import { NextResponse } from "next/server";

import {
  saveMessage,
  getRecentMessages,
  saveMemory,
  getMemories,
} from "../../lib/memory";

import {
  saveVectorMemory,
  searchVectorMemory,
} from "../../lib/vectorMemory";

import {
  commitAndPush,
} from "../../tools/gitTools";

import { extractMemories } from "../../lib/memoryExtractor";

import {
  setPendingAction,
  getPendingAction,
  clearPendingAction,
} from "../../lib/approval";

import {
  createFolder,
  createFile,
  runPythonFile,
  testAndFixPythonFile,
} from "../../tools/fileTools";

import { createPlan } from "../../lib/planner";

import { executeProjectPlan } from "../../lib/projectExecutor";

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const cleanMessage = message.trim();

    // ==========================================
    // CHECK FOR PENDING APPROVAL
    // ==========================================

    const pendingAction = getPendingAction();

    // ==========================================
    // YES / APPROVE
    // ==========================================

    if (
      pendingAction &&
      /^(yes|yeah|yep|sure|ok|okay|proceed|do it)$/i.test(
        cleanMessage
      )
    ) {
      try {
        // ------------------------------------------
        // CREATE FOLDER
        // ------------------------------------------

        if (
          pendingAction.action ===
          "createFolder"
        ) {
          const folderName =
            pendingAction.data?.folderName;

          const result =
            createFolder(folderName);

          clearPendingAction();

          saveMessage(
            "user",
            cleanMessage
          );

          const reply =
            `Done. The folder "${folderName}" has been created.`;

          saveMessage(
            "assistant",
            reply
          );

          return NextResponse.json({
            reply,
            tool: "createFolder",
            path: result.path,
          });
        }

        // ------------------------------------------
        // CREATE FILE
        // ------------------------------------------

        if (
          pendingAction.action ===
          "createFile"
        ) {
          const filePath =
            pendingAction.data?.filePath;

          const content =
            pendingAction.data?.content ||
            "";

          const result =
            createFile(
              filePath,
              content
            );

          clearPendingAction();

          saveMessage(
            "user",
            cleanMessage
          );

          const reply =
            `Done. The file "${filePath}" has been created.`;

          saveMessage(
            "assistant",
            reply
          );

          return NextResponse.json({
            reply,
            tool: "createFile",
            path: result.path,
          });
        }

        // ------------------------------------------
        // RUN PYTHON FILE
        // ------------------------------------------

        if (
          pendingAction.action ===
          "runPythonFile"
        ) {
          const filePath =
            pendingAction.data?.filePath;

          const result =
            await runPythonFile(
              filePath
            );

          clearPendingAction();

          saveMessage(
            "user",
            cleanMessage
          );

          const reply =
            result.success
              ? `Python program completed successfully.\n\nOutput:\n${result.output}`
              : `The Python program produced an error.\n\n${result.output}`;

          saveMessage(
            "assistant",
            reply
          );

          return NextResponse.json({
            reply,
            tool: "runPythonFile",
            success: result.success,
          });
        }

        // ------------------------------------------
        // TEST AND FIX PYTHON
        // ------------------------------------------

        if (
          pendingAction.action ===
          "testAndFixPythonFile"
        ) {
          const filePath =
            pendingAction.data?.filePath;

          const result =
            await testAndFixPythonFile(
              filePath,
              3
            );

          clearPendingAction();

          saveMessage(
            "user",
            cleanMessage
          );

          const reply =
            result.success
              ? `Testing completed successfully.\n\nOutput:\n${result.output}\n\nAttempts: ${result.attempts}`
              : `The program could not be fixed after ${result.attempts} attempts.\n\nOutput:\n${result.output}`;

          saveMessage(
            "assistant",
            reply
          );

          return NextResponse.json({
            reply,
            tool:
              "testAndFixPythonFile",
            success:
              result.success,
            attempts:
              result.attempts,
          });
        }

        // ------------------------------------------
        // EXECUTE PROJECT PLAN
        // ------------------------------------------

        if (
          pendingAction.action ===
          "executeProjectPlan"
        ) {
          const projectName =
            pendingAction.data
              ?.projectName;

          const plan =
            pendingAction.data?.plan ||
            [];

          const result =
            await executeProjectPlan(
              projectName,
              plan
            );

          clearPendingAction();

          saveMessage(
            "user",
            cleanMessage
          );

          const reply =
            `Project "${projectName}" started.\n\n` +
            result.results.join("\n");

          saveMessage(
            "assistant",
            reply
          );

          return NextResponse.json({
            reply,
            tool:
              "executeProjectPlan",
            success:
              result.success,
            path:
              result.projectPath,
          });
        }

        clearPendingAction();

        return NextResponse.json({
          reply:
            "That action is not available yet.",
        });
      } catch (error) {
        clearPendingAction();

        console.error(
          "APPROVED ACTION ERROR:",
          error
        );

        return NextResponse.json({
          reply:
            "I received your approval, but I couldn't complete the action.",
        });
      }
    }

    // ==========================================
    // NO / CANCEL
    // ==========================================

    if (
      pendingAction &&
      /^(no|nope|cancel|stop|don't|do not)$/i.test(
        cleanMessage
      )
    ) {
      clearPendingAction();

      saveMessage(
        "user",
        cleanMessage
      );

      const reply =
        "Okay. I cancelled that action.";

      saveMessage(
        "assistant",
        reply
      );

      return NextResponse.json({
        reply,
      });
    }

    // ==========================================
    // CREATE FOLDER
    // ==========================================

    if (
      /^create (a )?folder( called| named)? /i.test(
        cleanMessage
      )
    ) {
      const folderName =
        cleanMessage
          .replace(
            /^create (a )?folder( called| named)? /i,
            ""
          )
          .trim();

      if (!folderName) {
        return NextResponse.json({
          reply:
            "Please tell me the folder name.",
        });
      }

      setPendingAction({
        action:
          "createFolder",

        description:
          `Create a folder named "${folderName}"`,

        data: {
          folderName,
        },
      });

      saveMessage(
        "user",
        cleanMessage
      );

      const reply =
        `I can create the folder "${folderName}". Shall I proceed? YES / NO`;

      saveMessage(
        "assistant",
        reply
      );

      return NextResponse.json({
        reply,
        approvalRequired: true,
      });
    }

    // ==========================================
    // CREATE FILE
    // ==========================================

    if (
      /^create (a )?file( called| named)? /i.test(
        cleanMessage
      )
    ) {
      const fileRequest =
        cleanMessage
          .replace(
            /^create (a )?file( called| named)? /i,
            ""
          )
          .trim();

      if (!fileRequest) {
        return NextResponse.json({
          reply:
            "Please tell me what file you want me to create.",
        });
      }

      const codeResponse =
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
You are a coding assistant.

The user wants to create this file:

${fileRequest}

Generate the complete contents of the requested file.

Return ONLY the file contents.
Do not use markdown code fences.
Do not explain the code.
              `,

              stream: false,
            }),
          }
        );

      if (!codeResponse.ok) {
        throw new Error(
          "Could not generate file content."
        );
      }

      const codeData =
        await codeResponse.json();

      const generatedContent =
        codeData.response?.trim() ||
        "";

      if (!generatedContent) {
        return NextResponse.json({
          reply:
            "I couldn't generate the file content.",
        });
      }

      setPendingAction({
        action:
          "createFile",

        description:
          `Create file "${fileRequest}"`,

        data: {
          filePath:
            fileRequest,

          content:
            generatedContent,
        },
      });

      saveMessage(
        "user",
        cleanMessage
      );

      const reply =
        `I generated the code for "${fileRequest}". Shall I create the file? YES / NO`;

      saveMessage(
        "assistant",
        reply
      );

      return NextResponse.json({
        reply,
        approvalRequired: true,
      });
    }

    // ==========================================
    // RUN PYTHON FILE
    // ==========================================

    if (
      /^run (the )?python file /i.test(
        cleanMessage
      )
    ) {
      const filePath =
        cleanMessage
          .replace(
            /^run (the )?python file /i,
            ""
          )
          .trim();

      if (!filePath) {
        return NextResponse.json({
          reply:
            "Please tell me which Python file to run.",
        });
      }

      setPendingAction({
        action:
          "runPythonFile",

        description:
          `Run Python file "${filePath}"`,

        data: {
          filePath,
        },
      });

      saveMessage(
        "user",
        cleanMessage
      );

      const reply =
        `I can run "${filePath}". Shall I proceed? YES / NO`;

      saveMessage(
        "assistant",
        reply
      );

      return NextResponse.json({
        reply,
        approvalRequired: true,
      });
    }

    // ==========================================
    // TEST AND FIX PYTHON FILE
    // ==========================================

    if (
      /^test and fix (the )?python file /i.test(
        cleanMessage
      )
    ) {
      const filePath =
        cleanMessage
          .replace(
            /^test and fix (the )?python file /i,
            ""
          )
          .trim();

      if (!filePath) {
        return NextResponse.json({
          reply:
            "Please tell me which Python file to test.",
        });
      }

      setPendingAction({
        action:
          "testAndFixPythonFile",

        description:
          `Test and automatically fix Python file "${filePath}"`,

        data: {
          filePath,
        },
      });

      saveMessage(
        "user",
        cleanMessage
      );

      const reply =
        `I can test "${filePath}" and automatically try to fix Python errors. Shall I proceed? YES / NO`;

      saveMessage(
        "assistant",
        reply
      );

      return NextResponse.json({
        reply,
        approvalRequired: true,
      });
    }

    // ==========================================
    // CREATE PROJECT PLAN
    // ==========================================

    if (
      /^plan (a |an )?/i.test(
        cleanMessage
      )
    ) {
      const projectRequest =
        cleanMessage
          .replace(
            /^plan (a |an )?/i,
            ""
          )
          .trim();

      if (!projectRequest) {
        return NextResponse.json({
          reply:
            "Tell me what you want me to plan.",
        });
      }

      try {
        const plan =
          await createPlan(
            projectRequest
          );

        const planText =
          plan
            .map(
              (step) =>
                `${step.id}. ${step.task}`
            )
            .join("\n");

        const reply =
          `Here is the plan:\n\n${planText}`;

        saveMessage(
          "user",
          cleanMessage
        );

        saveMessage(
          "assistant",
          reply
        );

        return NextResponse.json({
          reply,
          plan,
        });
      } catch (error) {
        console.error(
          "PLANNER ERROR:",
          error
        );

        return NextResponse.json({
          reply:
            "I couldn't create a project plan.",
        });
      }
    }

    // ==========================================
    // BUILD PROJECT
    // ==========================================

    if (
      /^build project /i.test(
        cleanMessage
      )
    ) {
      const projectName =
        cleanMessage
          .replace(
            /^build project /i,
            ""
          )
          .trim();

      if (!projectName) {
        return NextResponse.json({
          reply:
            "Please tell me the project name.",
        });
      }

      try {
        const plan =
          await createPlan(
            projectName
          );

        setPendingAction({
          action:
            "executeProjectPlan",

          description:
            `Build project "${projectName}"`,

          data: {
            projectName,
            plan,
          },
        });

        const planText =
          plan
            .map(
              (step) =>
                `${step.id}. ${step.task}`
            )
            .join("\n");

        saveMessage(
          "user",
          cleanMessage
        );

        const reply =
          `I created this plan:\n\n${planText}\n\nShall I execute this plan? YES / NO`;

        saveMessage(
          "assistant",
          reply
        );

        return NextResponse.json({
          reply,
          approvalRequired:
            true,
          plan,
        });
      } catch (error) {
        console.error(
          "PROJECT PLAN ERROR:",
          error
        );

        return NextResponse.json({
          reply:
            "I couldn't create the project plan.",
        });
      }
    }

    // ==========================================
// PUSH TO GITHUB
// ==========================================

if (
  /^push to github$/i.test(
    cleanMessage
  )
) {
  try {
    const result =
      await commitAndPush(
        "Update JARVIS project"
      );

    saveMessage(
      "user",
      cleanMessage
    );

    const reply =
      result.output;

    saveMessage(
      "assistant",
      reply
    );

    return NextResponse.json({
      reply,
      tool: "commitAndPush",
      success:
        result.success,
    });
  } catch (error) {
    console.error(
      "GITHUB PUSH ERROR:",
      error
    );

    return NextResponse.json({
      reply:
        "I couldn't push the changes to GitHub.",
      success: false,
    });
  }
}

    // ==========================================
    // NORMAL CHAT
    // ==========================================

    saveMessage(
      "user",
      cleanMessage
    );

    const history =
      getRecentMessages(20);

    const memories =
      getMemories(50);

    const normalMemoryContext =
      memories.length > 0
        ? memories
            .map(
              (memory) =>
                `- ${memory.category}: ${memory.key} = ${memory.value}`
            )
            .join("\n")
        : "No long-term memories yet.";

    // ==========================================
    // VECTOR MEMORY SEARCH
    // ==========================================

    let vectorMemories: any[] =
      [];

    try {
      vectorMemories =
        await searchVectorMemory(
          cleanMessage,
          5
        );
    } catch (error) {
      console.log(
        "Vector memory search skipped:",
        error
      );
    }

    const vectorMemoryContext =
      vectorMemories.length > 0
        ? vectorMemories
            .map((memory) => {
              const payload =
                memory.payload as {
                  text?: string;
                  category?: string;
                };

              return `- ${
                payload?.category ||
                "general"
              }: ${
                payload?.text || ""
              }`;
            })
            .join("\n")
        : "No relevant semantic memories found.";

    // ==========================================
    // SEND TO OLLAMA
    // ==========================================

    const response =
      await fetch(
        "http://127.0.0.1:11434/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            model:
              "llama3.2:3b",

            messages: [
              {
                role:
                  "system",

                content: `
You are JARVIS, the user's personal AI assistant.

Use the conversation history and memories to answer the user.

NORMAL LONG-TERM MEMORY:
${normalMemoryContext}

RELEVANT SEMANTIC MEMORIES:
${vectorMemoryContext}

Be concise, helpful and practical.

Do not mention databases, Qdrant, embeddings,
or internal memory systems unless the user
specifically asks about them.
                `,
              },

              ...history,
            ],

            stream: false,
          }),
        }
      );

    if (!response.ok) {
      throw new Error(
        "Ollama request failed"
      );
    }

    const data =
      await response.json();

    const reply =
      data.message?.content;

    if (!reply) {
      throw new Error(
        "Ollama returned no response"
      );
    }

    // ==========================================
    // SAVE ASSISTANT MESSAGE
    // ==========================================

    saveMessage(
      "assistant",
      reply
    );

    // ==========================================
    // EXTRACT LONG-TERM MEMORY
    // ==========================================

    try {
      const extractedMemories =
        await extractMemories(
          cleanMessage
        );

      for (
        const memory of extractedMemories
      ) {
        if (
          !memory.category ||
          !memory.key ||
          !memory.value
        ) {
          continue;
        }

        saveMemory(
          memory.category,
          memory.key,
          memory.value
        );

        await saveVectorMemory(
          `${memory.category}: ${memory.key} = ${memory.value}`,
          memory.category
        );
      }
    } catch (error) {
      console.log(
        "Memory extraction skipped:",
        error
      );
    }

    // ==========================================
    // RETURN RESPONSE
    // ==========================================

    return NextResponse.json({
      reply,
    });
  } catch (error) {
    console.error(
      "JARVIS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "JARVIS could not connect to the AI. Make sure Ollama is running.",
      },
      {
        status: 500,
      }
    );
  }
}