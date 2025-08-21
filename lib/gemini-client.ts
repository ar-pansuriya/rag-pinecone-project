import { GoogleGenerativeAI } from "@google/generative-ai"

if (!process.env.GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY environment variable is required")
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)

export const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
export const geminiEmbeddingModel = genAI.getGenerativeModel({ model: "embedding-001" })

export async function generateGeminiEmbedding(chunks: string[]) {
  try {
    const rawEmbeddings = await Promise.all(chunks.map(chunk => geminiEmbeddingModel.embedContent(chunk)));
    return rawEmbeddings.map(e => e.embedding.values);
  } catch (error) {
    console.error("Error generating Gemini embedding:", error)
    throw new Error("Failed to generate embedding")
  }
}

export async function generateGeminiResponse(prompt: string): Promise<string> {
  try {
    const result = await geminiModel.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error) {
    console.error("Error generating Gemini response:", error)
    throw new Error("Failed to generate response")
  }
}
