import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/langchain-rag";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Auto-heal stale jobs (> 60 seconds old) stuck in processing state
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    await supabaseAdmin
      .from("pdf_jobs")
      .update({ status: 'ready' })
      .in("status", ["processing", "uploading"])
      .lt("created_at", oneMinuteAgo);

    const { data, error } = await supabaseAdmin
      .from("pdf_jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const pdfs = (data || []).map((job: any) => {
      let status = job.status || "ready";
      // Fallback safeguard for any pending job older than 60s
      if (status === "processing" || status === "uploading") {
        const createdAtMs = new Date(job.created_at || Date.now()).getTime();
        if (Date.now() - createdAtMs > 60000) {
          status = "ready";
        }
      }

      return {
        id: job.id,
        name: job.filename,
        uploadDate: new Date(job.created_at || Date.now()),
        status,
        chunksCount: job.total_chunks || 0,
        chunksProcessed: job.chunks_processed || 0,
        totalPages: job.total_pages || null,
      };
    });

    return NextResponse.json(pdfs);
  } catch (error) {
    console.error("Error fetching user pdfs:", error);
    return NextResponse.json({ error: "Failed to fetch user pdfs" }, { status: 500 });
  }
}
