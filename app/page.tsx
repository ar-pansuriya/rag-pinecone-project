"use client"

import { useEffect, useState } from "react"
import { ChatInterface } from "@/components/chat-interface"
import { PdfPanel } from "@/components/pdf-panel"

export default function Home() {
  const [messages, setMessages] = useState<
    Array<{
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
    }>
  >([])

  const [uploadedPdfs, setUploadedPdfs] = useState<
    Array<{
      id: string
      name: string
      uploadDate: Date
      status: "uploading" | "processing" | "ready" | "error"
      chunksCount?: number
    }>
  >([])
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false)

  const handleSendMessage = async (content: string) => {
    const userMessage = {
      id: Date.now().toString(),
      content,
      role: "user" as const,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])

    try {
      // Get ready PDFs for context

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          pdfId: selectedPdfId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      const data = await response.json();

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: "assistant" as const,
        timestamp: new Date(),
        contextUsed: data.contextUsed,
        sources: data.sources,
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error("Error sending message:", error)

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I encountered an error while processing your message. Please try again.",
        role: "assistant" as const,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, errorMessage])
    }
  }

  const handleResetChat = () => {
    setMessages([])
  }

  const handleResetPdfs = async () => {
    try {
      setIsResetting(true);           // show loader
      await deleteUserPdfs();         // perform deletion
      setUploadedPdfs([]);            // clear uploaded PDFs
    } catch (error) {
      console.error("Error deleting embeddings:", error);
    } finally {
      setIsResetting(false);          // hide loader
    }
  };

  const handlePdfProcessed = (pdfId: string, chunksCount: number) => {
    setUploadedPdfs((prev) =>
      prev.map((pdf) => (pdf.id === pdfId ? { ...pdf, status: "ready" as const, chunksCount } : pdf)),
    )
  }

  const deleteUserPdfs = async () => {
    try {
      const namespaces = uploadedPdfs.map((pdf) => pdf.id)

      await fetch("/api/delete-user-pdfs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namespaces }),
      })

      console.log("Deleted user PDF namespaces:", namespaces)

      setUploadedPdfs([])
      setSelectedPdfId(null)
    } catch (error) {
      console.error("Failed to delete user PDFs:", error)
    }
  }


  useEffect(() => {
    if (uploadedPdfs.length === 0) return
    deleteUserPdfs()
  }, [])




  return (
    <>

      {
        isResetting && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex gap-2">
              <span className="w-4 h-4 bg-primary rounded-full animate-bounce-delay"></span>
              <span className="w-4 h-4 bg-primary rounded-full animate-bounce-delay animation-delay-150"></span>
              <span className="w-4 h-4 bg-primary rounded-full animate-bounce-delay animation-delay-300"></span>
            </div>
          </div>
        )
      }

      <div className="flex h-screen bg-background mobile-safe-area">
        {/* Mobile Overlay */}
        {isMobilePanelOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobilePanelOpen(false)} />
        )}

        {/* PDF Panel - Mobile drawer on small screens, sidebar on larger */}
        <div
          className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:z-auto
        ${isMobilePanelOpen ? "translate-x-0" : "-translate-x-full"}
      `}
        >
          <PdfPanel
            pdfs={uploadedPdfs}
            selectedPdfId={selectedPdfId ?? undefined}
            onPdfSelect={(id: string | null) => setSelectedPdfId(id)}
            onResetChat={handleResetChat}
            onResetPdfs={handleResetPdfs}
            onPdfUpload={(pdf) => setUploadedPdfs((prev) => [...prev, pdf])}
            onPdfProcessed={handlePdfProcessed}
            onCloseMobile={() => setIsMobilePanelOpen(false)}
          />
        </div>

        {/* Main Chat Interface */}
        <div className="flex-1 flex flex-col min-w-0">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            onToggleMobilePanel={() => setIsMobilePanelOpen(!isMobilePanelOpen)}
          />
        </div>
      </div>
    </>
  )
}
