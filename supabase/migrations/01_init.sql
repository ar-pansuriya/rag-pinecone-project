-- 1. Enable the pgvector extension for storing and searching embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the documents table for PDF chunks
DROP TABLE IF EXISTS documents CASCADE;
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  metadata jsonb,
  embedding vector(1536) -- OpenAI uses 1536 dimensions for text-embedding-3-small
);

-- 3. Create a function to similarity search documents
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count int DEFAULT null,
  filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE metadata @> filter
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. Create chat history tables
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;

CREATE TABLE chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  citations jsonb,
  created_at timestamptz DEFAULT now()
);

-- 5. Create pdf_jobs table for realtime UI progress tracking
DROP TABLE IF EXISTS pdf_jobs CASCADE;
CREATE TABLE pdf_jobs (
  id text PRIMARY KEY, -- We will use the UUID generated in the client
  filename text NOT NULL,
  status text NOT NULL DEFAULT 'uploading', -- 'uploading', 'processing', 'ready', 'error'
  chunks_processed int DEFAULT 0,
  total_chunks int DEFAULT 0,
  error text,
  created_at timestamptz DEFAULT now()
);

-- Enable Realtime for pdf_jobs table so the UI can listen to progress
alter publication supabase_realtime add table pdf_jobs;

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_jobs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write their own chats
CREATE POLICY "Users can manage their own chats" 
ON chats FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own messages" 
ON messages FOR ALL 
USING (EXISTS (
  SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
));

-- Allow read access to documents & jobs for all authenticated users (assuming PDFs are global in this demo)
CREATE POLICY "Authenticated users can read documents" ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read jobs" ON pdf_jobs FOR SELECT TO authenticated USING (true);

-- Allow inserting into pdf_jobs from the client
CREATE POLICY "Authenticated users can insert jobs" ON pdf_jobs FOR INSERT TO authenticated WITH CHECK (true);
