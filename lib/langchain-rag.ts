import type { Document } from "@langchain/core/documents";
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// Initialize Pinecone client
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

// Create or get Pinecone index
export async function createPineconeIndex(dimension: number) {
  // Optionally create index if needed, for now just get the index
  return pinecone.Index(process.env.PINECONE_INDEX_NAME!);
}

// Initialize embeddings
export const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY!,
  modelName: "embedding-001",
});

// Initialize LLM
export const llm = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY!,
  model: "gemini-2.0-flash",
});

// Create vector store from existing index
export async function createVectorStore(namespace?: string): Promise<PineconeStore> {
  const index = await createPineconeIndex(768);
  return await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    namespace,
    textKey: "pageContent",
  });
}

// Add documents to Pinecone (LangChain generates embeddings internally)
export async function addDocumentsToVectorStore(
  documents: Document[],
  namespace?: string
): Promise<PineconeStore> {
  const index = await createPineconeIndex(768);
  const vectorStore = await PineconeStore.fromDocuments(documents, embeddings, {
    pineconeIndex: index,
    namespace,
    textKey: "pageContent",
  });
  return vectorStore;
}

// Perform RAG query
export async function performRAGQuery(
  query: string,
  namespace?: string,
  topK = 5
): Promise<{ answer: string; sourceDocuments: Document[]; source: "RAG" | "Gemini" }> {
  try {
    const vectorStore = await createVectorStore(namespace);
    const retriever = vectorStore.asRetriever({ k: topK });

const promptTemplate = ChatPromptTemplate.fromTemplate(`
You answer questions using the context below when it helps. If the context is missing something, fill the gaps with your own knowledge so the reply feels complete.

Context:
{context}

Question: {input}

Guidelines:
- Use the context if it adds value, but don’t sound restricted by it.
- If the context is empty or irrelevant, just answer normally.
- Blend sources so the response reads like natural human reasoning, not like separate parts.
- Keep the answer clear, concise, and conversational.

Answer:
`);

    const combineDocsChain = await createStuffDocumentsChain({
      llm,
      prompt: promptTemplate,
    });

    const retrievalChain = await createRetrievalChain({
      combineDocsChain,
      retriever,
    });

    const result = await retrievalChain.invoke({ input: query });
    let answer = typeof result.answer === "string" ? result.answer.trim() : "";

    if (!answer || answer.toLowerCase() === "i don't have enough information in the provided documents to answer this question") {
      // fallback to Gemini
      const geminiResponse = await llm.invoke([query]);
      answer = typeof geminiResponse.content === "string" ? geminiResponse.content : String(geminiResponse);
      return {
        answer,
        sourceDocuments: [],
        source: "Gemini",
      };
    }

    return {
      answer,
      sourceDocuments: Array.isArray(result.sourceDocuments) ? result.sourceDocuments : [],
      source: "RAG",
    };
  } catch (error) {
    console.error("Error in RAG query:", error);
    throw new Error("Failed to perform RAG query");
  }
}
