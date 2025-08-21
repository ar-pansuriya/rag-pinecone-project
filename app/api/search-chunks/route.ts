import { type NextRequest, NextResponse } from "next/server"
import { searchSimilarChunks } from "@/lib/pinecone"
import { generateEmbedding } from "@/lib/pdf-processor"

export async function POST(request: NextRequest) {
  try {
    const { query, topK = 5, pdfIds } = await request.json()

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query)

    // Search for similar chunks
    const results = await searchSimilarChunks(queryEmbedding, topK, pdfIds)

    return NextResponse.json({ results })
  } catch (error) {
    console.error("Error searching chunks:", error)
    return NextResponse.json({ error: "Failed to search chunks" }, { status: 500 })
  }
}
