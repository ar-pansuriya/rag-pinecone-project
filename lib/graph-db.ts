// Graph DB module disabled. The app relies 100% on Supabase Vector Search.
export async function extractAndStoreGraphEntities(text: string, pdfId: string) {
  return;
}

export async function retrieveGraphContext(question: string): Promise<string> {
  return "";
}
