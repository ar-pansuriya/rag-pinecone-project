'use client';

import type React from 'react';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, FileText, Menu, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
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
}

interface ChatInterfaceProps {
  messages: Message[];
  currentStage: string | null;
  onSendMessage: (content: string) => void;
  onToggleMobilePanel?: () => void;
  onToggleRightPanel?: () => void;
}

export function ChatInterface({
  messages,
  currentStage,
  onSendMessage,
  onToggleMobilePanel,
  onToggleRightPanel,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !currentStage) {
      const msg = input.trim();
      setInput('');
      await onSendMessage(msg);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col bg-accent-foreground h-full">
      {/* Header - Removed for unified navbar layout */}

      {/* Messages */}
      <div className="h-full overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 scroll-smooth my-class">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            {/* Image */}
            <img src="/icon-1.png" alt="Welcome" className="w-20 h-20 mb-4" />

            {/* Welcome Text */}
            <h2 className="text-base sm:text-lg font-medium text-foreground mb-2">
              Welcome to PDF Q&A
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Upload a PDF and start asking questions, or ask me anything!
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-2 sm:py-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-2 sm:ml-4'
                    : 'bg-card text-card-foreground mr-2 sm:mr-4'
                }`}
              >
                <div className="text-sm sm:text-base leading-relaxed break-words prose prose-sm max-w-none">
                  <ReactMarkdown>
                    {message.role === 'assistant' 
                      ? message.content.replace(/\[Source\s*\d+\]/gi, '').replace(/\s{2,}/g, ' ') 
                      : message.content}
                  </ReactMarkdown>
                </div>

                {message.role === 'assistant' &&
                  message.sources && message.sources.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-border/30">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5 font-medium">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Based on PDF content</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(() => {
                          const fileMap: { [key: string]: Set<string> } = {};
                          message.sources.forEach((s: any, idx: number) => {
                            const fileName = s.sourceFile || s.metadata?.sourceFile || s.pdfName || 'Document';
                            if (!fileMap[fileName]) fileMap[fileName] = new Set();
                            
                            let page = s.page ?? s.pageNum ?? s.metadata?.page ?? s.metadata?.pageNum;
                            if (page === undefined || page === null || page === '') {
                              const chunkIdx = s.chunkIndex ?? s.metadata?.chunkIndex;
                              if (typeof chunkIdx === 'number') {
                                page = (s.isSummary || s.metadata?.isSummary) ? 'Summary' : chunkIdx + 1;
                              } else {
                                page = idx + 1;
                              }
                            }

                            if (page !== undefined && page !== null && page !== '') {
                              const cleanPage = String(page).replace(/^page\s*/i, '').trim();
                              if (cleanPage) fileMap[fileName].add(cleanPage);
                            }
                          });

                          return Object.entries(fileMap).map(([fileName, pagesSet]) => {
                            const pages = Array.from(pagesSet).sort((a, b) => Number(a) - Number(b));
                            const isMulti = pages.length > 1;
                            const pageLabel = pages.length > 0 
                              ? `Page${isMulti ? 's' : ''} ${pages.join(', ')}`
                              : 'Page 1';

                            return (
                              <div key={fileName} className="text-xs text-muted-foreground flex items-center gap-1 max-w-full">
                                <span className="truncate max-w-[240px] sm:max-w-[360px]" title={fileName}>
                                  {fileName}
                                </span>
                                <span className="text-foreground/90 font-semibold shrink-0">
                                  ({pageLabel})
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                <p
                  className={`text-xs mt-1 ${
                    message.role === 'user'
                      ? 'text-primary-foreground/70'
                      : 'text-muted-foreground'
                  }`}
                >
                  {new Date(message.timestamp).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </p>
              </div>
            </div>
          ))
        )}

        {currentStage && (
          <div className="flex justify-start ml-2 sm:ml-4 my-2">
            <div className="flex flex-col gap-1.5 w-[55%] sm:w-[40%]">
              <div className="gemini-shimmer-original h-2 rounded-full"></div>
              <div className="gemini-shimmer-original h-2 rounded-full w-[75%]"></div>
              <div className="gemini-shimmer-original h-2 rounded-full w-[50%]"></div>
              <p className="text-[11px] text-muted-foreground mt-1 animate-pulse">{currentStage}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 sm:p-4">
        <form
          onSubmit={handleSubmit}
          className="flex items-center justify-center w-full gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your PDFs or anything else..."
            className="flex- rounded text-sm sm:text-base border border-gray-300"
            disabled={!!currentStage}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || !!currentStage}
            className="h-9 w-9 sm:h-10 sm:w-10"
          >
            <Send className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
