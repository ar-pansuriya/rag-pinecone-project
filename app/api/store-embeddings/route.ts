import { type NextRequest, NextResponse } from "next/server"
import { storeChunksInPinecone } from "@/lib/pinecone"

export async function POST(request: NextRequest) {
  try {
    const { chunks, pdfName, uploadDate } = await request.json()

    if (!chunks || !Array.isArray(chunks)) {
      return NextResponse.json({ error: "Chunks array is required" }, { status: 400 })
    }

    // Store chunks in Pinecone
    await storeChunksInPinecone(
      chunks.map((chunk: any) => ({
        ...chunk,
        pdfName,
      })),
      new Date(uploadDate),
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error storing embeddings:", error)
    return NextResponse.json({ error: "Failed to store embeddings" }, { status: 500 })
  }
}
