import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/langchain-rag";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { pdfId } = await request.json();
    if (!pdfId) return NextResponse.json({ error: "Missing pdfId" }, { status: 400 });

    // 1. Delete vector embeddings from Supabase 'documents' table matching metadata->>'pdfId'
    const { error: docError } = await supabaseAdmin
      .from("documents")
      .delete()
      .filter("metadata->>pdfId", "eq", pdfId);

    if (docError) console.error("Error deleting document vectors:", docError);

    // 2. Delete job entry from 'pdf_jobs' table
    const { error: jobError } = await supabaseAdmin
      .from("pdf_jobs")
      .delete()
      .eq("id", pdfId);

    if (jobError) console.error("Error deleting pdf job record:", jobError);

    return NextResponse.json({ success: true, pdfId });
  } catch (error) {
    console.error("Error in delete-pdf API:", error);
    return NextResponse.json({ error: "Failed to delete PDF" }, { status: 500 });
  }
}
