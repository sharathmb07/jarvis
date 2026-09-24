import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

export type MemoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LongTermMemory = {
  id: number;
  category: string;
  key: string;
  value: string;
  created_at: string;
};

// Create data folder
const dataDirectory = path.join(process.cwd(), "data");

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

// SQLite database
const databasePath = path.join(dataDirectory, "jarvis.db");

const db = new Database(databasePath);

// Conversation table
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Long-term memory table
db.exec(`
  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    memory_key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Save conversation message
export function saveMessage(
  role: "user" | "assistant",
  content: string
) {
  const statement = db.prepare(`
    INSERT INTO messages (role, content)
    VALUES (?, ?)
  `);

  statement.run(role, content);
}

// Get recent conversation
export function getRecentMessages(
  limit: number = 20
): MemoryMessage[] {
  const statement = db.prepare(`
    SELECT role, content
    FROM messages
    ORDER BY id DESC
    LIMIT ?
  `);

  const rows = statement.all(limit) as MemoryMessage[];

  return rows.reverse();
}

// Save long-term memory
export function saveMemory(
  category: string,
  key: string,
  value: string
) {
  const statement = db.prepare(`
    INSERT INTO memories (category, memory_key, value)
    VALUES (?, ?, ?)
  `);

  statement.run(category, key, value);
}

// Get long-term memories
export function getMemories(
  limit: number = 50
): LongTermMemory[] {
  const statement = db.prepare(`
    SELECT
      id,
      category,
      memory_key,
      value,
      created_at
    FROM memories
    ORDER BY id DESC
    LIMIT ?
  `);

  return statement.all(limit) as LongTermMemory[];
}