import { QdrantClient } from "@qdrant/js-client-rest";

const qdrant = new QdrantClient({
  host: "localhost",
  port: 6333,
});

const COLLECTION_NAME = "jarvis_memories";
const EMBEDDING_MODEL = "nomic-embed-text";

// Create an embedding using Ollama
async function createEmbedding(text: string): Promise<number[]> {
  const response = await fetch("http://127.0.0.1:11434/api/embed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error("Could not create embedding with Ollama");
  }

  const data = await response.json();

  return data.embeddings[0];
}

// Make sure the Qdrant collection exists
async function ensureCollection(vectorSize: number) {
  const collections = await qdrant.getCollections();

  const exists = collections.collections.some(
    (collection) => collection.name === COLLECTION_NAME
  );

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    });
  }
}

// Save a memory into Qdrant
export async function saveVectorMemory(
  text: string,
  category: string = "general"
) {
  const vector = await createEmbedding(text);

  await ensureCollection(vector.length);

  const id = crypto.randomUUID();

  await qdrant.upsert(COLLECTION_NAME, {
    wait: true,
    points: [
      {
        id,
        vector,
        payload: {
          text,
          category,
          createdAt: new Date().toISOString(),
        },
      },
    ],
  });

  return id;
}

// Search memories by meaning
export async function searchVectorMemory(
  query: string,
  limit: number = 5
) {
  const vector = await createEmbedding(query);

  await ensureCollection(vector.length);

  const result = await qdrant.query(COLLECTION_NAME, {
    query: vector,
    limit,
    with_payload: true,
  });

  return result.points;
}