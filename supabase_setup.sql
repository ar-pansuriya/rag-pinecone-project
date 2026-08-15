-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Drop existing match_documents function if it exists to recreate it with 1536 dimensions
DROP FUNCTION IF EXISTS match_documents(vector, int, jsonb);

-- 3. Create or replace documents table for 1536 dimensions (OpenAI text-embedding-3-small)
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  metadata jsonb,
  embedding vector(1536)
);

-- Note: if you already created the documents table with vector(768), you must drop it first!
-- DROP TABLE documents; 
-- Then run the CREATE TABLE statement above.

-- 4. Create match_documents function for 1536 dimensions
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

-- 5. Create pdf_jobs table for background processing
CREATE TABLE IF NOT EXISTS pdf_jobs (
  id uuid PRIMARY KEY,
  filename text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  chunks_processed integer DEFAULT 0,
  total_chunks integer DEFAULT 0,
  error text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable realtime for pdf_jobs if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'pdf_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pdf_jobs;
  END IF;
END $$;

-- 6. Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 7. Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  citations jsonb,
  created_at timestamp with time zone DEFAULT now()
);
