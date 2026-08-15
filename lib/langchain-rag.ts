import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai"
import { createClient } from "@supabase/supabase-js"
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase"
import { Document } from "@langchain/core/documents"

// Supabase Setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

// LLM & Embeddings Setup
export const getEmbeddings = () => {
  return new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
  })
}

export const getLLM = () => {
  return new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0.2,
  })
}

/**
 * Adds processed document chunks to Supabase pgvector
 */
export async function addDocumentsToSupabaseVectorStore(documents: Document[]) {
  const store = new SupabaseVectorStore(getEmbeddings(), {
    client: supabaseAdmin,
    tableName: "documents",
    queryName: "match_documents",
  })

  await store.addDocuments(documents)
}

const SIMILARITY_THRESHOLD = 0.38;

async function searchWithThreshold(
  store: SupabaseVectorStore, 
  query: string, 
  topK: number, 
  filter?: any,
  skipThreshold = false
): Promise<Document[]> {
  try {
    if (skipThreshold) {
      return await store.similaritySearch(query, topK, filter);
    }
    const resultsWithScore = await store.similaritySearchWithScore(query, topK, filter);
    // Filter out irrelevant vector matches below similarity threshold
    const filtered = resultsWithScore
      .filter(([_, score]) => score >= SIMILARITY_THRESHOLD)
      .map(([doc]) => doc);
    return filtered;
  } catch (e) {
    const rawDocs = await store.similaritySearch(query, topK, filter);
    return rawDocs;
  }
}

/**
 * Cross-Encoder Re-ranking Engine
 * Supports Hugging Face Inference API (BAAI/bge-reranker-v2-m3) and Cohere Rerank API
 */
export async function rerankDocuments(
  query: string,
  docs: Document[],
  topN: number = 3
): Promise<Document[]> {
  if (!docs || docs.length <= 1) return docs;

  const hfKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
  const cohereKey = process.env.COHERE_API_KEY;

  // 1. Cohere Rerank API (if COHERE_API_KEY is configured)
  if (cohereKey) {
    try {
      const res = await fetch("https://api.cohere.com/v1/rerank", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cohereKey}`,
        },
        body: JSON.stringify({
          model: "rerank-v3.5",
          query,
          documents: docs.map((d) => d.pageContent),
          top_n: topN,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.results && Array.isArray(json.results)) {
          return json.results.map((r: any) => docs[r.index]).filter(Boolean);
        }
      }
    } catch (e) {
      // Fallback to raw candidate order on error
    }
  }

  // 2. Hugging Face Cross-Encoder API (if HUGGINGFACE_API_KEY or HF_TOKEN is configured)
  if (hfKey) {
    try {
      const res = await fetch(
        "https://api-inference.huggingface.co/models/BAAI/bge-reranker-v2-m3",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${hfKey}`,
          },
          body: JSON.stringify({
            inputs: {
              source_sentence: query,
              sentences: docs.map((d) => d.pageContent),
            },
          }),
        }
      );

      if (res.ok) {
        const scores = await res.json();
        if (Array.isArray(scores)) {
          const scoredDocs = docs.map((doc, idx) => {
            const rawScore = typeof scores[idx] === "number" ? scores[idx] : scores[idx]?.score ?? 0;
            return { doc, score: rawScore };
          });
          scoredDocs.sort((a, b) => b.score - a.score);
          return scoredDocs.slice(0, topN).map((item) => item.doc);
        }
      }
    } catch (e) {
      // Fallback to raw candidate order on error
    }
  }

  // 3. Fallback: Return top vector results
  return docs.slice(0, topN);
}

/**
 * 2-Stage Retrieval Pipeline:
 * Stage 1: Fast Vector Search (pgvector)
 * Stage 2: Cross-Encoder Re-Ranking (Hugging Face BAE/bge-reranker-v2-m3 or Cohere)
 */
export async function retrieveRelevantContext(query: string, pdfIds?: string | string[]) {
  const store = new SupabaseVectorStore(getEmbeddings(), {
    client: supabaseAdmin,
    tableName: "documents",
    queryName: "match_documents",
  })

  const globalKeywords = [
    'summary', 'summarize', 'overview', 'main points', 'synopsis',
    'executive summary', 'full summary', 'overview of document',
    'summarize entire', 'table of contents', 'list all chapters',
    'entire pdf', 'entire document', 'tell me summary'
  ];
  
  const queryLower = query.toLowerCase();
  const isGlobalQuery = globalKeywords.some(kw => queryLower.includes(kw));
  const searchTopK = isGlobalQuery ? 15 : 8;

  let candidateDocs: Document[] = [];

  if (Array.isArray(pdfIds) && pdfIds.length > 0) {
    if (pdfIds.length === 1) {
      candidateDocs = await searchWithThreshold(store, query, searchTopK, { pdfId: pdfIds[0] }, isGlobalQuery);
    } else {
      const perPdfTopK = Math.max(3, Math.ceil(searchTopK / pdfIds.length));
      const searchPromises = pdfIds.map(id => searchWithThreshold(store, query, perPdfTopK, { pdfId: id }, isGlobalQuery));
      const nestedResults = await Promise.all(searchPromises);
      candidateDocs = nestedResults.flat();
    }
  } else if (typeof pdfIds === 'string' && pdfIds.trim().length > 0) {
    candidateDocs = await searchWithThreshold(store, query, searchTopK, { pdfId: pdfIds }, isGlobalQuery);
  } else {
    candidateDocs = await searchWithThreshold(store, query, searchTopK, undefined, isGlobalQuery);
  }

  // Stage 2: Re-rank candidate documents using Cross-Encoder model
  return await rerankDocuments(query, candidateDocs, isGlobalQuery ? 12 : 6);
}
