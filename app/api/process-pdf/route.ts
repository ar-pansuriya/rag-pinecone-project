import { type NextRequest, NextResponse } from "next/server"
import { processPdf } from "@/lib/pdf-processor"
import { generateGeminiEmbedding } from "@/lib/gemini-client"
import { addDocumentsToVectorStore } from "@/lib/langchain-rag"
import { Document } from "langchain/document"


export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const pdfId = formData.get("pdfId") as string
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 })
    }
    // Process the PDF
    const chunks = await processPdf(file, pdfId);

    try {

      // const embeddings = await generateGeminiEmbedding(chunks);

      const documents = chunks.map((text, i) => new Document({
        pageContent: text,
        metadata: { page: i + 1, pdfId },
      }));
      await addDocumentsToVectorStore(
        documents,
        `${pdfId}`,
      )
    } catch (error) {
      console.log("Error storing embeddings111111:", error)
      // Continue without failing the entire process
    }

    const result = {
      chunks: chunks,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error processing PDF:", error)
    return NextResponse.json({ error: "Failed to process PDF" }, { status: 500 })
  }
}
