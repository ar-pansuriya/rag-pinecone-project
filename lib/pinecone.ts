// Pinecone vector database integration

export interface VectorRecord {
  id: string
  values: number[]
  metadata: {
    content: string
    pdfId: string
    pdfName: string
    chunkIndex: number
    uploadDate: string
  }
}

export interface QueryResult {
  id: string
  score: number
  metadata: {
    content: string
    pdfId: string
    pdfName: string
    chunkIndex: number
    uploadDate: string
  }
}

class PineconeClient {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = process.env.PINECONE_ENVIRONMENT
      ? `https://${process.env.PINECONE_INDEX_NAME}-${process.env.PINECONE_PROJECT_ID}.svc.${process.env.PINECONE_ENVIRONMENT}.pinecone.io`
      : ""
    this.apiKey = process.env.PINECONE_API_KEY || ""
  }

  async upsert(vectors: VectorRecord[]): Promise<void> {
    if (!this.baseUrl || !this.apiKey) {
      console.warn("Pinecone not configured, skipping vector storage")
      return
    }

    try {
      const response = await fetch(`${this.baseUrl}/vectors/upsert`, {
        method: "POST",
        headers: {
          "Api-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vectors,
          namespace: "pdf-chunks",
        }),
      })

      if (!response.ok) {
        throw new Error(`Pinecone upsert failed: ${response.statusText}`)
      }
    } catch (error) {
      console.error("Error upserting vectors to Pinecone:", error)
      throw error
    }
  }

  async query(vector: number[], topK = 5, filter?: Record<string, any>): Promise<QueryResult[]> {
    if (!this.baseUrl || !this.apiKey) {
      console.warn("Pinecone not configured, returning empty results")
      return []
    }

    try {
      const response = await fetch(`${this.baseUrl}/query`, {
        method: "POST",
        headers: {
          "Api-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vector,
          topK,
          includeMetadata: true,
          namespace: "pdf-chunks",
          filter,
        }),
      })

      if (!response.ok) {
        throw new Error(`Pinecone query failed: ${response.statusText}`)
      }

      const data = await response.json()
      return data.matches || []
    } catch (error) {
      console.error("Error querying Pinecone:", error)
      throw error
    }
  }

  async deleteByFilter(filter: Record<string, any>): Promise<void> {
    if (!this.baseUrl || !this.apiKey) {
      console.warn("Pinecone not configured, skipping deletion")
      return
    }

    try {
      const response = await fetch(`${this.baseUrl}/vectors/delete`, {
        method: "POST",
        headers: {
          "Api-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter,
          namespace: "pdf-chunks",
        }),
      })

      if (!response.ok) {
        throw new Error(`Pinecone delete failed: ${response.statusText}`)
      }
    } catch (error) {
      console.error("Error deleting vectors from Pinecone:", error)
      throw error
    }
  }

  async deleteAll(): Promise<void> {
    if (!this.baseUrl || !this.apiKey) {
      console.warn("Pinecone not configured, skipping deletion")
      return
    }

    try {
      const response = await fetch(`${this.baseUrl}/vectors/delete`, {
        method: "POST",
        headers: {
          "Api-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deleteAll: true,
          namespace: "pdf-chunks",
        }),
      })

      if (!response.ok) {
        throw new Error(`Pinecone delete all failed: ${response.statusText}`)
      }
    } catch (error) {
      console.error("Error deleting all vectors from Pinecone:", error)
      throw error
    }
  }
}

export const pinecone = new PineconeClient()

export async function storeChunksInPinecone(
  chunks: Array<{
    id: string
    content: string
    pdfId: string
    pdfName: string
    chunkIndex: number
    embedding: number[]
  }>,
  uploadDate: Date,
): Promise<void> {
  const vectors: VectorRecord[] = chunks.map((chunk) => ({
    id: chunk.id,
    values: chunk.embedding,
    metadata: {
      content: chunk.content,
      pdfId: chunk.pdfId,
      pdfName: chunk.pdfName,
      chunkIndex: chunk.chunkIndex,
      uploadDate: uploadDate.toISOString(),
    },
  }))

  await pinecone.upsert(vectors)
}

export async function searchSimilarChunks(
  queryEmbedding: number[],
  topK = 5,
  pdfIds?: string[],
): Promise<QueryResult[]> {
  const filter = pdfIds && pdfIds.length > 0 ? { pdfId: { $in: pdfIds } } : undefined

  return await pinecone.query(queryEmbedding, topK, filter)
}

export async function deletePdfFromPinecone(pdfId: string): Promise<void> {
  await pinecone.deleteByFilter({ pdfId })
}

export async function deleteAllPdfsFromPinecone(): Promise<void> {
  await pinecone.deleteAll()
}
