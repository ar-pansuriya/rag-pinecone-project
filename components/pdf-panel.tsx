"use client"

import type React from "react"
import { v4 as uuidv4 } from "uuid";
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Upload, FileText, Trash2, Loader2, CheckSquare, Square } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export interface Pdf {
  id: string
  name: string
  uploadDate: Date
  status: "uploading" | "processing" | "ready" | "error"
  chunksCount?: number
  chunksProcessed?: number
  totalPages?: number | null
}

interface PdfPanelProps {
  pdfs: Pdf[]
  selectedPdfId?: string
  selectedPdfIds?: string[]
  onPdfSelect?: (pdfId: string) => void
  onPdfSelectToggle?: (pdfId: string) => void
  onSelectAllPdfs?: () => void
  onResetChat: () => void
  onResetPdfs: () => void
  onPdfUpload: (pdf: Pdf) => void
  onPdfProcessed: (pdfId: string, chunksCount: number) => void
  onDeletePdf?: (pdfId: string) => void
  onCloseMobile?: () => void
  isLoading?: boolean
}

export function PdfPanel({
  pdfs,
  selectedPdfId,
  selectedPdfIds = [],
  onPdfSelect,
  onPdfSelectToggle,
  onSelectAllPdfs,
  onResetChat,
  onResetPdfs,
  onPdfUpload,
  onPdfProcessed,
  onDeletePdf,
  onCloseMobile,
  isLoading,
}: PdfPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [deletingPdfIds, setDeletingPdfIds] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  const handleDelete = async (pdfId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (deletingPdfIds.has(pdfId)) return

    setDeletingPdfIds((prev) => new Set(prev).add(pdfId))
    try {
      if (onDeletePdf) {
        await onDeletePdf(pdfId)
      }
    } finally {
      setDeletingPdfIds((prev) => {
        const next = new Set(prev)
        next.delete(pdfId)
        return next
      })
    }
  }

  const readyPdfs = pdfs.filter((pdf) => pdf.status === "ready")
  const allSelected = readyPdfs.length > 0 && readyPdfs.every(p => selectedPdfIds.includes(p.id))

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return

    const validFiles = Array.from(files).filter(file => file.type === "application/pdf")
    
    if (validFiles.length < Array.from(files).length) {
      toast({
        title: "Invalid file type",
        description: "Some files were skipped. Please upload PDF files only.",
        variant: "destructive",
      })
    }

    if (validFiles.length === 0) return;

    // 1. Immediately create and dispatch all PDF objects to UI
    const pdfsToUpload = validFiles.map(file => ({
      file,
      pdfInfo: {
        id: uuidv4(),
        name: file.name,
        uploadDate: new Date(),
        status: "uploading" as const,
      }
    }));

    pdfsToUpload.forEach(({ pdfInfo }) => {
      onPdfUpload(pdfInfo);
      if (onPdfSelectToggle) {
        onPdfSelectToggle(pdfInfo.id);
      } else if (!selectedPdfId && onPdfSelect) {
        onPdfSelect(pdfInfo.id);
      }
    });

    // 2. Fire off all uploads concurrently
    pdfsToUpload.forEach(async ({ file, pdfInfo }) => {
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("pdfId", pdfInfo.id)

        const response = await fetch("/api/process-pdf", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) throw new Error("Failed to start processing PDF")

        const data = await response.json()
        const readyStatus = data.status === "ready" ? "ready" : "processing"

        onPdfUpload({
          ...pdfInfo,
          status: readyStatus,
          chunksCount: data.totalChunks || 0,
          chunksProcessed: data.totalChunks || 0,
        })

        if (data.status === "ready" && onPdfProcessed) {
          onPdfProcessed(pdfInfo.id, data.totalChunks || 0)
        }

        toast({
          title: "Upload complete",
          description: `${file.name} is ready!`,
        })
      } catch (error) {
        console.error("Error processing PDF:", error)
        onPdfUpload({ ...pdfInfo, status: "error" })

        toast({
          title: "Error processing PDF",
          description: `Failed to process ${file.name}. Please try again.`,
          variant: "destructive",
        })
      }
    });
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
      case "processing": 
        if (pdf.chunksCount && pdf.chunksCount > 0) {
          const percent = Math.round(((pdf.chunksProcessed || 0) / pdf.chunksCount) * 100);
          return `Processing... ${percent}%`;
        }
        return "Processing..."
      case "ready": {
        const pagesText = pdf.totalPages ? `${pdf.totalPages} page${pdf.totalPages > 1 ? 's' : ''}` : '';
        const chunksText = `${pdf.chunksCount || 0} chunk${(pdf.chunksCount || 0) === 1 ? '' : 's'} ready`;
        return pagesText ? `${pagesText} • ${chunksText}` : chunksText;
      }
      case "error": return "Processing failed"
      default: return pdf.uploadDate.toISOString().split('T')[0]
    }
  }

  const handlePdfClick = (pdfId: string) => {
    if (onPdfSelectToggle) {
      onPdfSelectToggle(pdfId)
    } else if (onPdfSelect) {
      onPdfSelect(pdfId)
    }
  }

  return (
    <div className="w-80 sm:w-72 md:w-80 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      {/* Upload Area - Fixed */}
      <div className="p-3 sm:p-4 shrink-0">
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

      {/* Select All Bar */}
      {isLoading ? (
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-y border-sidebar-border bg-muted/30">
          <div className="h-3 w-28 bg-muted rounded animate-pulse"></div>
          <div className="h-3 w-14 bg-muted rounded animate-pulse"></div>
        </div>
      ) : readyPdfs.length > 0 ? (
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-y border-sidebar-border text-xs bg-muted/30">
          <span className="text-muted-foreground font-medium">
            {selectedPdfIds.length === readyPdfs.length
              ? `All PDFs Selected (${readyPdfs.length})`
              : `${selectedPdfIds.length} of ${readyPdfs.length} Selected`}
          </span>
          {onSelectAllPdfs && (
            <button
              onClick={onSelectAllPdfs}
              className="text-primary hover:underline font-semibold text-[11px] cursor-pointer flex items-center gap-1"
            >
              {allSelected ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>
      ) : null}

      {/* PDF List - Scrollable */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 scroll-smooth my-class min-h-0">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="px-3 py-3 rounded-lg border-2 border-border/40 space-y-2 bg-card/40"
              >
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-muted animate-pulse shrink-0"></div>
                  <div className="h-4 w-[75%] rounded bg-muted animate-pulse"></div>
                </div>
                <div className="h-2.5 w-[45%] rounded bg-muted animate-pulse ml-6"></div>
              </div>
            ))}
          </div>
        ) : pdfs.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-8">
            <img src="/not.png" alt="No PDFs" className="w-14 h-14 mb-4 opacity-80" />
            <p className="text-xs sm:text-sm text-muted-foreground text-center">No PDFs uploaded yet</p>
          </div>
        ) : (
          [...pdfs]
            .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
            .map((pdf) => {
            const isDeleting = deletingPdfIds.has(pdf.id);
            const isSelected = selectedPdfIds.includes(pdf.id);

            return (
              <div
                key={pdf.id}
                onClick={() => !isDeleting && handlePdfClick(pdf.id)}
                className={`group flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                  isDeleting ? 'opacity-50 pointer-events-none cursor-wait' : 'cursor-pointer'
                } ${
                  (pdf.status === 'processing' || pdf.status === 'uploading')
                    ? 'border-2 border-primary/40'
                    : isSelected
                      ? 'bg-primary/10 border-2 border-primary'
                      : 'border-2 border-border/60 hover:border-border hover:bg-muted/50'
                }`}
              >
                {pdf.status === 'processing' || pdf.status === 'uploading' ? (
                  <div className="flex items-start gap-2 w-full py-0.5">
                    <div className="h-4 w-4 rounded-full animate-[brand_shimmer_2s_infinite] shrink-0"></div>
                    <div className="flex-1 min-w-0 flex flex-col gap-2 mt-0.5">
                      <div className="h-2.5 w-[85%] rounded-full animate-[brand_shimmer_2s_infinite]"></div>
                      <div className="h-2.5 w-[50%] rounded-full animate-[brand_shimmer_2s_infinite]"></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-0.5 shrink-0">
                      {getStatusIcon(pdf.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-primary font-semibold' : 'text-foreground'}`}>
                        {pdf.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {getStatusText(pdf)}
                      </p>
                    </div>
                    {onDeletePdf && (
                      <button
                        disabled={isDeleting}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-destructive/10 disabled:opacity-50"
                        onClick={(e) => handleDelete(pdf.id, e)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-destructive transition-colors" />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  )
}
