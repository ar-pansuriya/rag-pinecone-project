import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/langchain-rag"

export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json()
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json([])
    }

    const { data, error } = await supabaseAdmin
      .from("pdf_jobs")
      .select("*")
      .in("id", ids)

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Error fetching pdf jobs:", error)
    return NextResponse.json({ error: "Failed to fetch pdf jobs" }, { status: 500 })
  }
}
