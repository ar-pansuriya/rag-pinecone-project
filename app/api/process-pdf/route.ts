import { type NextRequest, NextResponse } from "next/server"
import { processPdf } from "@/lib/pdf-processor"
import { addDocumentsToSupabaseVectorStore, supabaseAdmin } from "@/lib/langchain-rag"
import { Document } from "@langchain/core/documents"

// Helper to update Supabase Job Status
async function updateJobStatus(jobId: string, updates: any) {
  const { error } = await supabaseAdmin
    .from("pdf_jobs")
    .update(updates)
    .eq("id", jobId);
  if (error) {
    console.error(`[DB Error] Failed to update pdf_jobs status for ${jobId}:`, error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const pdfId = formData.get("pdfId") as string
    
    if (!file || !pdfId) {
      return NextResponse.json({ error: "Missing file or pdfId" }, { status: 400 })
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 })
    }

    // 1. Upsert job record in Supabase
    await supabaseAdmin.from("pdf_jobs").upsert({
      id: pdfId,
      filename: file.name,
      status: 'processing',
      chunks_processed: 0,
      total_chunks: 0
    })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const mockFile = new File([buffer], file.name, { type: 'application/pdf' })
    
    // 2. Parse PDF and extract page-level chunks
    console.log(`[PDF Processing] Uploading & parsing "${file.name}" (ID: ${pdfId})...`);
    const pageChunks = await processPdf(mockFile, pdfId);

    // 3. RAPTOR Index: Generate a fast Executive Summary & Entity Index chunk if text exists
    let summaryDoc: Document | null = null;
    if (pageChunks.length > 0) {
      try {
        const sampleText = pageChunks.slice(0, 4).map(c => c.content).join("\n") + "\n" + 
                           pageChunks.slice(Math.floor(pageChunks.length / 2), Math.floor(pageChunks.length / 2) + 2).map(c => c.content).join("\n") + "\n" +
                           pageChunks.slice(-3).map(c => c.content).join("\n");

        if (sampleText.trim().length > 20) {
          const summaryRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              max_tokens: 300,
              temperature: 0.2,
              messages: [
                {
                  role: 'user',
                  content: `Create a high-level Document Executive Summary & Key Entity Index for "${file.name}". 
Include: 1. Main Synopsis, 2. List of all key characters / people / entities mentioned, 3. Main topics.
Text sample: "${sampleText.slice(0, 5000)}"`
                }
              ],
            }),
          });
          
          const summaryJson = await summaryRes.json();
          const summaryText = summaryJson.choices?.[0]?.message?.content;

          if (summaryText) {
            summaryDoc = new Document({
              pageContent: `[DOCUMENT EXECUTIVE SUMMARY & ENTITY INDEX for "${file.name}"]\n${summaryText}`,
              metadata: { pdfId, isSummary: true, chunkIndex: -1, sourceFile: file.name }
            });
          }
        }
      } catch (e) {
        console.error(`[Job ${pdfId}] Summary generation warning:`, e);
      }
    }

    const documents = pageChunks.map((item, idx) => {
       return new Document({
         pageContent: item.content,
         metadata: { 
           pdfId, 
           chunkIndex: idx, 
           sourceFile: file.name,
           page: item.pageNum 
         },
       })
    });

    if (summaryDoc) {
      documents.unshift(summaryDoc);
    }

    if (documents.length > 0) {
      console.log(`[Vector Indexing] Storing ${documents.length} chunk(s) in Supabase vector store for "${file.name}"...`);
      await addDocumentsToSupabaseVectorStore(documents);
    }

    // 4. Mark Job as READY in Supabase DB immediately!
    const reportedChunks = pageChunks.length > 0 ? pageChunks.length : documents.length;
    const totalPages = pageChunks.length > 0 ? (pageChunks[pageChunks.length - 1].pageNum || 1) : 1;
    await updateJobStatus(pdfId, { 
      status: 'ready', 
      total_chunks: reportedChunks, 
      chunks_processed: reportedChunks
    })
    console.log(`[PDF Ready] "${file.name}" completed successfully (${reportedChunks} chunks across ${totalPages} pages).`);

    // 5. Return ready status & chunk count directly to client
    return NextResponse.json({
      status: "ready",
      pdfId,
      totalChunks: reportedChunks
    })

  } catch (error: any) {
    console.error("Error in process-pdf:", error)
    return NextResponse.json({ error: error.message || "Failed to process PDF" }, { status: 500 })
  }
}
