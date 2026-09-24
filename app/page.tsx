"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello. I am JARVIS, your personal AI assistant.",
    },
  ]);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!message.trim() || loading) {
      return;
    }

    const userMessage = message.trim();

    // Show user's message on the screen
    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: userMessage,
      },
    ]);

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        // IMPORTANT:
        // The API now expects "message"
        body: JSON.stringify({
          message: userMessage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Something went wrong"
        );
      }

      // Show JARVIS response
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: data.reply,
        },
      ]);
    } catch (error) {
      console.error("JARVIS ERROR:", error);

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't connect to my AI brain. Please make sure Ollama is running.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#05070a",
        color: "white",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* HEADER */}
      <header
        style={{
          padding: "20px 30px",
          borderBottom: "1px solid #1f2937",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              letterSpacing: "6px",
              fontSize: "28px",
            }}
          >
            J A R V I S
          </h1>

          <p
            style={{
              color: "#6b7280",
              marginTop: "5px",
            }}
          >
            Personal AI Assistant
          </p>
        </div>

        <div
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: "#22c55e",
            boxShadow: "0 0 15px #22c55e",
          }}
        />
      </header>

      {/* CHAT */}
      <section
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "900px",
          margin: "0 auto",
          padding: "30px 25px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            background: "#0b0f14",
            border: "1px solid #1f2937",
            borderRadius: "20px",
            padding: "25px",
            minHeight: "500px",
          }}
        >
          <p
            style={{
              color: "#6b7280",
              fontSize: "13px",
            }}
          >
            SYSTEM ONLINE
          </p>

          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                background:
                  msg.role === "user"
                    ? "#172033"
                    : "#111827",
                borderRadius: "15px",
                padding: "15px 20px",
                marginBottom: "15px",
                marginLeft:
                  msg.role === "user" ? "80px" : "0",
                marginRight:
                  msg.role === "assistant" ? "80px" : "0",
              }}
            >
              <strong
                style={{
                  fontSize: "13px",
                  letterSpacing: "1px",
                }}
              >
                {msg.role === "user"
                  ? "YOU"
                  : "JARVIS"}
              </strong>

              <p
                style={{
                  color: "#d1d5db",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                  marginBottom: 0,
                }}
              >
                {msg.content}
              </p>
            </div>
          ))}

          {loading && (
            <div
              style={{
                color: "#9ca3af",
                padding: "10px",
              }}
            >
              JARVIS is thinking...
            </div>
          )}
        </div>
      </section>

      {/* INPUT */}
      <footer
        style={{
          padding: "20px 25px 30px",
          borderTop: "1px solid #1f2937",
        }}
      >
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            display: "flex",
            gap: "10px",
          }}
        >
          <input
            value={message}
            onChange={(e) =>
              setMessage(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
            placeholder="Talk to JARVIS..."
            disabled={loading}
            style={{
              flex: 1,
              padding: "17px 20px",
              borderRadius: "12px",
              border: "1px solid #374151",
              background: "#111827",
              color: "white",
              fontSize: "16px",
              outline: "none",
            }}
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            style={{
              padding: "0 25px",
              borderRadius: "12px",
              border: "none",
              background: loading
                ? "#6b7280"
                : "white",
              color: "black",
              fontWeight: "bold",
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </footer>
    </main>
  );
}