'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatInterface } from '@/components/chat-interface';
import { PdfPanel } from '@/components/pdf-panel';
import { ChatHistoryPanel } from '@/components/chat-history-panel';
import { logout } from '@/app/login/actions';

export default function Home() {
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      content: string;
      role: 'user' | 'assistant';
      timestamp: Date;
      contextUsed?: boolean;
      sources?: Array<{
        pdfName: string;
        chunkIndex: number;
        score: number;
      }>;
    }>
  >([]);

  const [uploadedPdfs, setUploadedPdfs] = useState<
    Array<{
      id: string;
      name: string;
      uploadDate: Date;
      status: 'uploading' | 'processing' | 'ready' | 'error';
      chunksCount?: number;
      chunksProcessed?: number;
    }>
  >([]);
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [selectedPdfIds, setSelectedPdfIds] = useState<string[]>([]);

  const handlePdfSelectToggle = (id: string) => {
    setSelectedPdfIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((pdfId) => pdfId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAllPdfs = () => {
    const readyIds = uploadedPdfs.filter((p) => p.status === 'ready').map((p) => p.id);
    if (readyIds.length > 0 && readyIds.every(id => selectedPdfIds.includes(id))) {
      setSelectedPdfIds([]);
    } else {
      setSelectedPdfIds(readyIds);
    }
  };
  const [isResetting, setIsResetting] = useState(false);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoadingChats, setIsLoadingChats] = useState(true);

  const fetchChats = async () => {
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        const data = await res.json();
        setChatSessions(data.map((d: any) => ({ ...d, date: new Date(d.created_at) })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingChats(false);
    }
  };

  const [isLoadingPdfs, setIsLoadingPdfs] = useState(true);

  const fetchPdfs = async () => {
    setIsLoadingPdfs(true);
    try {
      const res = await fetch('/api/user-pdfs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setUploadedPdfs(data.map((p: any) => ({
            ...p,
            uploadDate: new Date(p.uploadDate)
          })));
          // Default to NO PDFs selected on load as requested
          setSelectedPdfIds([]);
        }
      }
    } catch (e) {
      console.error('Error fetching user PDFs:', e);
    } finally {
      setIsLoadingPdfs(false);
    }
  };

  useEffect(() => {
    fetchChats();
    fetchPdfs();
  }, []);

  const isStreamingRef = useRef(false);

  useEffect(() => {
    if (activeChatId && !isStreamingRef.current) {
      fetch(`/api/chats/${activeChatId}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setMessages(data.map((m: any) => ({
              id: m.id,
              content: m.content,
              role: m.role,
              timestamp: new Date(m.created_at),
              sources: m.citations
            })));
          }
        });
    } else if (!activeChatId) {
      setMessages([]);
    }
  }, [activeChatId]);

  const handleDeleteSession = async (id: string) => {
    try {
      const res = await fetch(`/api/chats/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setChatSessions(prev => prev.filter(c => c.id !== id));
        if (activeChatId === id) {
          setActiveChatId(null);
          setMessages([]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [currentStage, setCurrentStage] = useState<string | null>(null);

  const handleSendMessage = async (content: string) => {
    isStreamingRef.current = true;
    const userMessage = {
      id: Date.now().toString(),
      content,
      role: 'user' as const,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentStage(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          pdfId: selectedPdfId,
          pdfIds: selectedPdfIds,
          chatId: activeChatId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No readable stream');
      const decoder = new TextDecoder();

      let aiMessageId = (Date.now() + 1).toString();
      let aiContent = "";
      let aiMessageCreated = false;

      let loopActiveChatId = activeChatId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkStrings = decoder.decode(value, { stream: true }).split('\n').filter(Boolean);
        for (const chunkStr of chunkStrings) {
          try {
            const data = JSON.parse(chunkStr);
            if (data.type === 'chat_created') {
              if (!loopActiveChatId) {
                loopActiveChatId = data.chatId;
                setActiveChatId(data.chatId);
                fetchChats();
              }
            } else if (data.type === 'stage') {
              setCurrentStage(data.content);
            } else if (data.type === 'chunk') {
              setCurrentStage(null);
              aiContent += data.content;
              if (!aiMessageCreated) {
                aiMessageCreated = true;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: aiMessageId,
                    content: aiContent,
                    role: 'assistant' as const,
                    timestamp: new Date(),
                  }
                ]);
              } else {
                setMessages((prev) => prev.map(msg => 
                  msg.id === aiMessageId ? { ...msg, content: aiContent } : msg
                ));
              }
            } else if (data.type === 'done') {
              setCurrentStage(null);
              setMessages((prev) => prev.map(msg => 
                msg.id === aiMessageId ? { ...msg, sources: data.sources } : msg
              ));
              if (!loopActiveChatId && data.chatId) {
                loopActiveChatId = data.chatId;
                setActiveChatId(data.chatId);
                fetchChats();
              }
            } else if (data.type === 'error') {
              throw new Error(data.content);
            }
          } catch (e) {
            console.error("Error parsing stream chunk:", e);
          }
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      setCurrentStage(null);

      const errorMessage = {
        id: (Date.now() + 2).toString(),
        content: error.message || 'Sorry, I encountered an error while processing your message. Please try again.',
        role: 'assistant' as const,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      isStreamingRef.current = false;
    }
  };

  const handleResetChat = () => {
    setMessages([]);
  };

  const handleResetPdfs = async () => {
    try {
      setIsResetting(true); // show loader
      await deleteUserPdfs(); // perform deletion
      setUploadedPdfs([]); // clear uploaded PDFs
    } catch (error) {
      console.error('Error deleting embeddings:', error);
    } finally {
      setIsResetting(false); // hide loader
    }
  };

  const handlePdfProcessed = (pdfId: string, chunksCount: number) => {
    setUploadedPdfs((prev) =>
      prev.map((pdf) =>
        pdf.id === pdfId
          ? { ...pdf, status: 'ready' as const, chunksCount }
          : pdf,
      ),
    );
  };

  const deleteUserPdfs = async () => {
    try {
      await Promise.all(
        uploadedPdfs.map((pdf) =>
          fetch('/api/delete-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfId: pdf.id }),
          })
        )
      );

      setUploadedPdfs([]);
      setSelectedPdfId(null);
    } catch (error) {
      console.error('Failed to delete user PDFs:', error);
    }
  };

  useEffect(() => {
    if (uploadedPdfs.length === 0) return;
    // Don't auto delete user PDFs on mount for this demo anymore, 
    // since we want persistence or manual reset
    // deleteUserPdfs() 
  }, []);

  // Listen to Supabase Realtime for background job progress
  useEffect(() => {
    let channel: any;
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      
      const channelName = `pdf_jobs_progress_${Date.now()}_${Math.random()}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pdf_jobs',
          },
          (payload) => {
            const job = payload.new as any;
            if (!job || !job.id) return;
            
            setUploadedPdfs((prev) => {
              const exists = prev.find(p => p.id === job.id);
              if (exists) {
                return prev.map(p => p.id === job.id ? { 
                  ...p, 
                  status: job.status, 
                  chunksCount: job.total_chunks,
                  chunksProcessed: job.chunks_processed 
                } : p);
              } else {
                return [{
                  id: job.id,
                  name: job.filename,
                  uploadDate: new Date(job.created_at || Date.now()),
                  status: job.status,
                  chunksCount: job.total_chunks,
                  chunksProcessed: job.chunks_processed
                }, ...prev];
              }
            });
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, []);

  // Fallback Polling for PDF processing status (guarantees UI updates even if Realtime drops)
  useEffect(() => {
    const pendingPdfs = uploadedPdfs.filter(
      (p) => p.status === 'processing' || p.status === 'uploading'
    );

    if (pendingPdfs.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const ids = pendingPdfs.map((p) => p.id);
        const res = await fetch('/api/pdf-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });

        if (res.ok) {
          const jobs: any[] = await res.json();
          if (jobs && jobs.length > 0) {
            setUploadedPdfs((prev) =>
              prev.map((pdf) => {
                const job = jobs.find((j) => j.id === pdf.id);
                if (job) {
                  return {
                    ...pdf,
                    status: job.status,
                    chunksCount: job.total_chunks,
                    chunksProcessed: job.chunks_processed,
                  };
                }
                return pdf;
              })
            );
          }
        }
      } catch (e) {
        console.error('Polling error for PDF jobs:', e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [uploadedPdfs]);

  const handleDeletePdf = async (pdfId: string) => {
    try {
      await fetch('/api/delete-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfId }),
      });
      setUploadedPdfs((prev) => prev.filter((p) => p.id !== pdfId));
      if (selectedPdfId === pdfId) {
        setSelectedPdfId(null);
      }
    } catch (e) {
      console.error('Error deleting PDF:', e);
    }
  };

  return (
    <>
      {isResetting && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex gap-2">
            <span className="w-4 h-4 bg-primary rounded-full animate-bounce-delay"></span>
            <span className="w-4 h-4 bg-primary rounded-full animate-bounce-delay animation-delay-150"></span>
            <span className="w-4 h-4 bg-primary rounded-full animate-bounce-delay animation-delay-300"></span>
          </div>
        </div>
      )}

      {/* Main Layout Wrapper */}
      <div className="flex flex-col h-screen bg-background mobile-safe-area">
        {/* Unified Full-Width Navbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobilePanelOpen(!isMobilePanelOpen)}
              className="md:hidden p-1 text-muted-foreground hover:text-foreground"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </button>
            <h1 className="text-lg font-medium text-foreground">
              PDF Q&A Assistant
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
              className="xl:hidden p-1 text-muted-foreground hover:text-foreground"
              title="Chat History"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </button>

            <form action={logout}>
              <button
                type="submit"
                className="bg-transparent text-destructive border border-destructive text-xs px-3 py-1.5 rounded hover:bg-destructive/10 transition-colors shadow-sm font-semibold"
              >
                Sign Out
              </button>
            </form>
          </div>
        </header>

        {/* 3-Pane Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Mobile Overlay - Left Panel */}
          {isMobilePanelOpen && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity"
              onClick={() => setIsMobilePanelOpen(false)}
            />
          )}

          {/* Mobile Overlay - Right Panel */}
          {isRightPanelOpen && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 xl:hidden transition-opacity"
              onClick={() => setIsRightPanelOpen(false)}
            />
          )}

          {/* PDF Panel - Mobile drawer on small screens, sidebar on larger */}
          <div
            className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:z-auto
        ${isMobilePanelOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
          >
            <PdfPanel
              pdfs={uploadedPdfs}
              selectedPdfId={selectedPdfId ?? undefined}
              selectedPdfIds={selectedPdfIds}
              isLoading={isLoadingPdfs}
              onPdfSelect={(id: string | null) => setSelectedPdfId(id)}
              onPdfSelectToggle={handlePdfSelectToggle}
              onSelectAllPdfs={handleSelectAllPdfs}
              onResetChat={handleResetChat}
              onResetPdfs={handleResetPdfs}
              onPdfUpload={(pdf) => setUploadedPdfs((prev) => {
                const exists = prev.find(p => p.id === pdf.id);
                if (exists) {
                  return prev.map(p => p.id === pdf.id ? pdf : p);
                }
                return [pdf, ...prev];
              })}
              onPdfProcessed={handlePdfProcessed}
              onDeletePdf={handleDeletePdf}
              onCloseMobile={() => setIsMobilePanelOpen(false)}
            />
          </div>

          {/* Main Chat Interface */}
          <div className="flex-1 flex flex-col min-w-0 bg-background">
              <ChatInterface
                messages={messages}
                currentStage={currentStage}
                onSendMessage={handleSendMessage}
                onToggleMobilePanel={() => setIsMobilePanelOpen(true)}
                onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
              />
          </div>

          {/* Right Sidebar - Chat History */}
          <div
            className={`
        fixed inset-y-0 right-0 z-50 transform transition-transform duration-300 ease-in-out
        xl:relative xl:translate-x-0 xl:z-auto
        ${isRightPanelOpen ? 'translate-x-0' : 'translate-x-full'}
      `}
          >
            <ChatHistoryPanel
              sessions={chatSessions}
              activeSessionId={activeChatId ?? undefined}
              onSessionSelect={(id) => setActiveChatId(id)}
              onDeleteSession={handleDeleteSession}
              onNewChat={() => {
                setActiveChatId(null);
                setMessages([]);
              }}
              onCloseMobile={() => setIsRightPanelOpen(false)}
              isLoading={isLoadingChats}
            />
          </div>

          {/* End 3-Pane Content Area */}
        </div>
      </div>
    </>
  );
}
