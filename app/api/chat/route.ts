import { type NextRequest, NextResponse } from "next/server"
import { performRAGQuery } from "@/lib/langchain-rag"
import { generateGeminiResponse } from "@/lib/gemini-client"

export async function POST(request: NextRequest) {
  try {
    const { message, pdfId } = await request.json()

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    let response: string
    let contextUsed = false
    let sourceDocuments: any[] = []

    if (pdfId && process.env.PINECONE_INDEX_NAME) {
      try {
        const ragResult = await performRAGQuery(
          message,
          pdfId
        )
        response = ragResult.answer
        contextUsed = ragResult ? true : false
        sourceDocuments = ragResult.sourceDocuments.map((doc, index) => ({
          content: doc.pageContent.substring(0, 200) + "...",
          metadata: doc.metadata,
          index,
        }))
      } catch (error) {
        console.error("Error in RAG query:", error)
        response = await generateGeminiResponse(
          `Answer this question: ${message}\n\nNote: I don't have access to your PDF documents right now, so I'll provide a general answer.`,
        )
        contextUsed = false
      }
    } else {
      response = await generateGeminiResponse(message)
      contextUsed = false
    }

    return NextResponse.json({
      response,
      contextUsed,
      chunksFound: sourceDocuments.length,
      sources: sourceDocuments.map((doc) => ({
        content: doc.content,
        metadata: doc.metadata,
      })),
    })
  } catch (error) {
    console.error("Error in chat API:", error)
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 })
  }
}
