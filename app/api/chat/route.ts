import { type NextRequest, NextResponse } from "next/server"
import { retrieveRelevantContext, supabaseAdmin } from "@/lib/langchain-rag"
import { createClient } from "@/lib/supabase/server"
import { ChatOpenAI } from "@langchain/openai"
import { PromptTemplate } from "@langchain/core/prompts"
import { StringOutputParser } from "@langchain/core/output_parsers"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { message, pdfId, pdfIds, chatId } = await request.json()

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    // Setup ReadableStream for real-time stages and text streaming
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendStage = (stage: string) => {
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'stage', content: stage }) + '\n'));
        };

        try {
          let activeChatId = chatId;
          
          if (!activeChatId) {
            sendStage('Creating chat...');

            // Generate title inline (fast 10-token call)
            let generatedTitle = 'New Chat';
            try {
              const titleRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                  model: 'gpt-4o-mini',
                  max_tokens: 10,
                  temperature: 0.3,
                  messages: [
                    { role: 'user', content: `3-4 word title for: "${message.slice(0, 80)}". Title only.` }
                  ],
                }),
              });
              const titleJson = await titleRes.json();
              generatedTitle = (titleJson.choices?.[0]?.message?.content || 'New Chat').replace(/["']/g, '').trim();
            } catch (e) {
              console.error("Title generation failed, using fallback:", e);
            }

            const { data: chatData, error: chatError } = await supabaseAdmin.from("chats").insert({
              user_id: user.id,
              title: generatedTitle
            }).select().single();

            if (chatError) throw chatError;
            activeChatId = chatData.id;
            
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'chat_created', chatId: activeChatId }) + '\n'));
          }

          let vectorContext = "";
          let candidateSources: any[] = [];
          
          sendStage('Retrieving PDF context...');
          try {
            const activePdfFilter = (Array.isArray(pdfIds) && pdfIds.length > 0) ? pdfIds : (pdfId || undefined);
            const docs = await retrieveRelevantContext(message, activePdfFilter);
            if (docs && docs.length > 0) {
              candidateSources = docs.map((d, index) => {
                let page = d.metadata?.page || d.metadata?.pageNum;
                if (!page && d.pageContent) {
                  const match = d.pageContent.match(/\[Page\s*(\d+)\]/i);
                  if (match) page = parseInt(match[1], 10);
                }
                if (!page && typeof d.metadata?.chunkIndex === 'number') {
                  page = d.metadata.isSummary ? "Summary" : d.metadata.chunkIndex + 1;
                }
                return { 
                  id: index + 1, 
                  content: d.pageContent, 
                  pdfId: d.metadata?.pdfId,
                  sourceFile: d.metadata?.sourceFile || "Document",
                  chunkIndex: d.metadata?.chunkIndex,
                  page: page || null
                };
              });

              vectorContext = candidateSources
                .map(s => `[Source ${s.id}] (File: "${s.sourceFile}", Page ${s.page || 'N/A'}):\n${s.content}`)
                .join("\n\n");
            }
          } catch (e) {
            console.error("Vector retrieval warning:", e);
          }

          sendStage('Generating Response...');
          
          const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.3, streaming: true });
          const prompt = PromptTemplate.fromTemplate(`
You are an intelligent, friendly, and highly accurate AI Assistant & PDF Analyzer.
You converse naturally, handle casual greetings warmly, answer general knowledge questions, and analyze uploaded PDF documents with precision.

Guidelines:
1. Conversational & Warm: If the user sends emojis, greetings (hi, hello), or casual remarks, respond enthusiastically and helpfully.
2. PDF Citation Rule: If you use information from the Document Context below to answer the user's question, you MUST append source references like [Source 1], [Source 2] at the end of the sentence or statement.
3. General Knowledge: If the user's question is general knowledge or cannot be answered using the provided Document Context, answer using your general intelligence. DO NOT output any source markers [Source X] for general knowledge answers.

Document Context: 
{vectorContext}

User Message: {question}
`);
          const chain = prompt.pipe(llm).pipe(new StringOutputParser());
          const llmStream = await chain.stream({ vectorContext: vectorContext || "No document context available.", question: message });
          
          let fullAnswer = "";
          for await (const chunk of llmStream) {
            fullAnswer += chunk;
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'chunk', content: chunk }) + '\n'));
          }

          // Parse actual cited source IDs from the generated fullAnswer (e.g., [Source 1], [Source 3])
          const citedSourceMatches = Array.from(fullAnswer.matchAll(/\[Source\s*(\d+)\]/gi));
          const citedIds = new Set(citedSourceMatches.map(m => parseInt(m[1], 10)));

          let activeSources: any[] = [];
          if (citedIds.size > 0) {
            activeSources = candidateSources.filter(s => citedIds.has(s.id));
          } else if (candidateSources.length > 0) {
            // Check if the answer explicitly matches PDF text content
            const answerLower = fullAnswer.toLowerCase();
            const relevant = candidateSources.filter(s => {
              const snippet = s.content.slice(0, 80).toLowerCase();
              return answerLower.includes(snippet.slice(0, 30));
            });
            if (relevant.length > 0) {
              activeSources = relevant;
            }
          }

          const finalCitations = activeSources.length > 0 ? activeSources : null;

          // Save Messages (User and Assistant)
          await supabaseAdmin.from("messages").insert([
            { chat_id: activeChatId, role: "user", content: message },
            { chat_id: activeChatId, role: "assistant", content: fullAnswer, citations: finalCitations }
          ]);

          controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', chatId: activeChatId, sources: finalCitations || [] }) + '\n'));
        } catch (error: any) {
          console.error("Streaming error:", error);
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', content: error.message || "Failed to process message" }) + '\n'));
        } finally {
          controller.close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error("Error in chat API:", error)
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 })
  }
}
