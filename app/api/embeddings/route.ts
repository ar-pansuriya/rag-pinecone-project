import { type NextRequest, NextResponse } from "next/server"
import { generateGeminiEmbedding } from "@/lib/gemini-client"

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    const embedding = await generateGeminiEmbedding(text)

    return NextResponse.json({ embedding })
  } catch (error) {
    console.error("Error generating embedding:", error)
    return NextResponse.json({ error: "Failed to generate embedding" }, { status: 500 })
  }
}
