"use client"

import type React from "react"
import { v4 as uuidv4 } from "uuid";
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, FileText, RotateCcw, Trash2, Loader2, AlertTriangle, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Pdf {
  id: string
  name: string
  uploadDate: Date
  status: "uploading" | "processing" | "ready" | "error"
  chunksCount?: number
}

interface PdfPanelProps {
  pdfs: Pdf[]
  selectedPdfId?: string
  onPdfSelect?: (pdfId: string) => void
  onResetChat: () => void
  onResetPdfs: () => void
  onPdfUpload: (pdf: Pdf) => void
  onPdfProcessed: (pdfId: string, chunksCount: number) => void
  onCloseMobile?: () => void
}

export function PdfPanel({
  pdfs,
  selectedPdfId,
  onPdfSelect,
  onResetChat,
  onResetPdfs,
  onPdfUpload,
  onPdfProcessed,
  onCloseMobile,
}: PdfPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isResettingPdfs, setIsResettingPdfs] = useState(false)
  const { toast } = useToast()

  const totalChunks = pdfs.reduce((sum, pdf) => sum + (pdf.chunksCount || 0), 0)
  const readyPdfs = pdfs.filter((pdf) => pdf.status === "ready")

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return

    for (const file of Array.from(files)) {
      if (file.type === "application/pdf") {
        const newPdf: Pdf = {
          id: uuidv4(),
          name: file.name,
          uploadDate: new Date(),
          status: "uploading",
        }

        onPdfUpload(newPdf);
        if (!selectedPdfId && onPdfSelect) {
          onPdfSelect(newPdf.id)
        }

        try {
          const formData = new FormData()
          formData.append("file", file)
          formData.append("pdfId", newPdf.id)

          const response = await fetch("/api/process-pdf", {
            method: "POST",
            body: formData,
          })

          if (!response.ok) throw new Error("Failed to process PDF")

          const processedPdf = await response.json()
          onPdfProcessed(newPdf.id, processedPdf.chunks.length)

          toast({
            title: "PDF processed successfully",
            description: `${file.name} has been processed and is ready for questions.`,
          })
        } catch (error) {
          console.error("Error processing PDF:", error)
          onPdfUpload({ ...newPdf, status: "error" })

          toast({
            title: "Error processing PDF",
            description: `Failed to process ${file.name}. Please try again.`,
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload PDF files only.",
          variant: "destructive",
        })
      }
    }
  }

  const handleResetPdfs = async () => {
    setIsResettingPdfs(true)

    try {
      onResetPdfs()
    } catch (error) {
      console.error("Error resetting PDFs:", error)
      toast({
        title: "Error resetting PDFs",
        description: "Failed to clear PDF data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsResettingPdfs(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false) }
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); handleFileUpload(e.dataTransfer.files) }

  const getStatusIcon = (status: Pdf["status"]) => {
    switch (status) {
      case "uploading":
      case "processing":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />
      case "ready":
        return <FileText className="h-4 w-4 text-primary" />
      case "error":
        return <FileText className="h-4 w-4 text-destructive" />
      default:
        return <FileText className="h-4 w-4 text-primary" />
    }
  }

  const getStatusText = (pdf: Pdf) => {
    switch (pdf.status) {
      case "uploading": return "Uploading..."
      case "processing": return "Processing..."
      case "ready": return `${pdf.chunksCount || 0} chunks ready`
      case "error": return "Processing failed"
      default: return pdf.uploadDate.toLocaleDateString()
    }
  }

  const handlePdfClick = (pdfId: string) => {
    if (onPdfSelect) onPdfSelect(pdfId)
  }

  return (
    <div className="w-80 sm:w-72 md:w-80 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">PDF Documents</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Upload and manage your PDFs</p>
          </div>
          {onCloseMobile && (
            <Button variant="ghost" size="sm" onClick={onCloseMobile} className="md:hidden p-1 h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {totalChunks > 0 && (
          <div className="mt-2 p-2 bg-muted rounded-md">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Memory Usage</span>
              <span className="font-medium">{totalChunks} chunks</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-muted-foreground">Ready PDFs</span>
              <span className="font-medium">{readyPdfs.length}</span>
            </div>
            {totalChunks > 1000 && (
              <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                <span>High usage - consider resetting</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Area */}
      <div className="p-3 sm:p-4">
        <div
          className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors ${isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-xs sm:text-sm text-muted-foreground mb-2">Drag & drop PDFs here</p>
          <Button
            variant="outline"
            size="sm"
            className="text-xs sm:text-sm bg-transparent"
            onClick={() => {
              const input = document.createElement("input")
              input.type = "file"
              input.accept = ".pdf"
              input.multiple = true
              input.onchange = (e) => handleFileUpload((e.target as HTMLInputElement).files)
              input.click()
            }}
          >
            Browse Files
          </Button>
        </div>
      </div>

      {/* PDF List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 scroll-smooth">
        {pdfs.length === 0 ? (
          <div className="flex flex-col items-center justify-center">
            <img src="/not.png" alt="No PDFs" className="w-14 h-14 mb-4" />
            <p className="text-xs sm:text-sm text-muted-foreground text-center">No PDFs uploaded yet</p>
          </div>
        ) : (
          pdfs.map((pdf) => (
            <Card
              key={pdf.id}
              className={`p-2 sm:p-3 cursor-pointer ${selectedPdfId === pdf.id ? "border-primary border-2" : ""
                }`}
              onClick={() => handlePdfClick(pdf.id)}
            >
              <div className="flex items-start gap-2">
                {getStatusIcon(pdf.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-foreground truncate">{pdf.name}</p>
                  <p className="text-xs text-muted-foreground">{getStatusText(pdf)}</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Actions */}
      <div className="p-3 sm:p-4 border-t border-sidebar-border space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onResetChat}
          className="w-full justify-start bg-transparent text-xs sm:text-sm"
        >
          <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
          Reset Chat
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full hover:bg-red-700 justify-start bg-transparent text-xs sm:text-sm"
              disabled={pdfs.length === 0 || isResettingPdfs}
            >
              {isResettingPdfs ? (
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              )}
              Reset PDFs
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset All PDFs</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all uploaded PDFs and their embeddings from the vector database.
                You'll need to re-upload your documents to ask questions about them again.
                <br />
                <br />
                <strong>This will free up {totalChunks} chunks from memory.</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="hover:bg-gray-200 hover:text-black">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleResetPdfs}
                className="bg-red-700 text-destructive-foreground hover:bg-red-800"
              >
                Reset All PDFs
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
