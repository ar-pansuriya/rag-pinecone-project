import { type NextRequest, NextResponse } from "next/server"
import { deletePdfFromPinecone, deleteAllPdfsFromPinecone } from "@/lib/pinecone"

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pdfId = searchParams.get("pdfId")
    const deleteAll = searchParams.get("deleteAll") === "true"

    if (deleteAll) {
      await deleteAllPdfsFromPinecone()
      console.log("All PDF embeddings deleted from Pinecone")
    } else if (pdfId) {
      await deletePdfFromPinecone(pdfId)
      console.log(`PDF embeddings deleted for pdfId: ${pdfId}`)
    } else {
      return NextResponse.json({ error: "pdfId or deleteAll parameter is required" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting embeddings:", error)
    return NextResponse.json({ error: "Failed to delete embeddings" }, { status: 500 })
  }
}
