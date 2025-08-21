// app/api/delete-user-pdfs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const namespaces: string[] = body.namespaces;

    if (!Array.isArray(namespaces) || namespaces.length === 0) {
      return NextResponse.json({ error: "No namespaces provided" }, { status: 400 });
    }

    const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);

    for (const ns of namespaces) {
      try {
        await index.deleteNamespace(ns);
        console.log(`Deleted all vectors in namespace: ${ns}`);
      } catch (e) {
        console.error(`Failed to delete namespace ${ns}:`, e);
      }
    }

    return NextResponse.json({ success: true, deletedNamespaces: namespaces });
  } catch (error) {
    console.error("Error deleting namespaces:", error);
    return NextResponse.json({ error: "Failed to delete namespaces" }, { status: 500 });
  }
}
