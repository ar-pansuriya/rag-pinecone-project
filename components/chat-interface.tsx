"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, FileText, Menu } from "lucide-react"
import ReactMarkdown from "react-markdown";

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  contextUsed?: boolean
  sources?: Array<{
    pdfName: string
    chunkIndex: number
    score: number
  }>
}

interface ChatInterfaceProps {
  messages: Message[]
  onSendMessage: (content: string) => void
  onToggleMobilePanel?: () => void
}

export function ChatInterface({ messages, onSendMessage, onToggleMobilePanel }: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isLoading) {
      setIsLoading(true)
      await onSendMessage(input.trim())
      setInput("");
      inputRef.current?.focus();
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col bg-accent-foreground h-full">
      {/* Header */}
      <div className="border-b border-border p-3 sm:p-4">
        <div className="flex items-center gap-3">
          {onToggleMobilePanel && (
            <Button variant="ghost" size="sm" onClick={onToggleMobilePanel} className="md:hidden p-1 h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-semibold text-foreground">PDF Q&A Assistant</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Upload PDFs and ask questions about their content
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="h-full overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 scroll-smooth my-class">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            {/* Image */}
            <img
              src="/icon-1.png"
              alt="Welcome"
              className="w-20 h-20 mb-4"
            />

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
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-2 sm:py-3 ${message.role === "user"
                  ? "bg-primary text-primary-foreground ml-2 sm:ml-4"
                  : "bg-card text-card-foreground mr-2 sm:mr-4"
                  }`}
              >
                <div className="text-sm sm:text-base leading-relaxed break-words"><ReactMarkdown>{message.content}</ReactMarkdown></div>

                {message.role === "assistant" && message.contextUsed && message.sources && (
                  <div className="mt-2 pt-2 border-t border-border/20">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <FileText className="h-3 w-3" />
                      <span>Based on PDF content</span>
                    </div>
                    <div className="text-xs text-muted-foreground break-words">
                      Sources: {message.sources.map((source) => source.pdfName).join(", ")}
                    </div>
                  </div>
                )}

                <p
                  className={`text-xs mt-1 ${message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="relative bg-card rounded-xl px-4 py-3 mr-2 sm:mr-4 flex items-center gap-3 overflow-hidden">
              <div className="flex justify-center h-full flex-row items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce [animation-delay:-.3s]"></div>
                <div className="w-2 h-2 rounded-full bg-green-600 animate-bounce [animation-delay:-.5s]"></div>
              </div>
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-primary/20 via-transparent to-primary/20 animate-pulse-slow rounded-xl"></div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 sm:p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your PDFs or anything else..."
            className="flex- rounded text-sm sm:text-base border border-gray-300"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="h-9 w-9 sm:h-10 sm:w-10">
            <Send className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
