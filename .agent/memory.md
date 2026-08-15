# Project Context & Goals

**Goal**: Build a Production-Ready Advanced RAG Demo Application to showcase to potential clients on Upwork.

**Key Requirements**:
- **Scale**: Capable of handling large, 100+ page PDFs.
- **LLM**: OpenAI GPT API using cost-effective models (e.g., `gpt-4o-mini`).
- **Embeddings**: OpenAI embeddings (`text-embedding-3-small`).
- **Database Architecture**: 
  - Pinecone for Vector storage.
  - Neo4j for Graph database capabilities (GraphRAG approach) to map relationships within the documents.
- **Advanced RAG Features**:
  - **Reranking**: Implement a reranker (like Cohere) to improve retrieval precision and minimize latency.
  - **Citations**: UI must display accurate citations, indicating exactly which chunk/page the answer was derived from.
- **Performance**: Optimized for fast retrieval and low latency, simulating a true production build.
