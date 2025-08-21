import pdfParse from "pdf-parse";


// export interface ProcessedPdf {
//   id: string
//   name: string
//   chunks: TextChunk[]
//   uploadDate: Date
// }

export interface TextChunk {
  index: any
  id: string
  content: string
  pdfId: string
  chunkIndex: number
  embedding?: number[]
}

export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const buffer = Buffer.from(uint8Array)

    // Import pdf-parse dynamically to avoid SSR issues
    const pdfParse = (await import("pdf-parse")).default
    const data = await pdfParse(buffer)

    // Clean text (remove extra spaces, newlines)
    const text = data.text.replace(/\s+/g, " ").trim();

    return text
  } catch (error) {
    console.error("Error extracting text from PDF:", error)
    throw new Error("Failed to extract text from PDF")
  }
}

export function chunkText(text: string, maxTokens = 100): string[] {
  // Simple chunking by sentences and approximate token count
  // Rough estimate: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const chunks: string[] = []
  let currentChunk = ""

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (!trimmedSentence) continue

    const potentialChunk = currentChunk + (currentChunk ? ". " : "") + trimmedSentence

    if (potentialChunk.length > maxChars && currentChunk) {
      // Current chunk is full, start a new one
      chunks.push(currentChunk + ".")
      currentChunk = trimmedSentence
    } else {
      currentChunk = potentialChunk
    }
  }

  // Add the last chunk if it exists
  if (currentChunk) {
    chunks.push(currentChunk + ".")
  }

  return chunks.filter((chunk) => chunk.trim().length > 10) // Filter out very short chunks
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch("/api/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      throw new Error("Failed to generate embedding")
    }

    const data = await response.json()
    return data.embedding
  } catch (error) {
    console.error("Error generating embedding:", error)
    throw new Error("Failed to generate embedding")
  }
}

export async function processPdf(file: File, pdfId: string) {
  // const pdfId = Date.now().toString() + Math.random().toString(36).substr(2, 9)

  // Extract text from PDF
  const text = await extractTextFromPdf(file)

  // Chunk the text
  const textChunks = chunkText(text)

  // Create text chunks with metadata
  const chunks: TextChunk[] = textChunks.map((content, index) => ({
    index,
    id: `${pdfId}_chunk_${index}`,
    content,
    pdfId,
    chunkIndex: index,
  }))

  return textChunks

  // return {
  //   id: pdfId,
  //   name: file.name,
  //   chunks,
  //   uploadDate: new Date(),
  // }
}
