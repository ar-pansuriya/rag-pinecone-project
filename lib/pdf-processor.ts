import { getDocumentProxy } from "unpdf";
import { PDFDocument } from "pdf-lib";

if (typeof (Math as any).sumPrecise !== 'function') {
  (Math as any).sumPrecise = (numbers: Iterable<number>) => {
    let sum = 0;
    for (const n of numbers) sum += n;
    return sum;
  };
}

export interface TextChunk {
  index: any
  id: string
  content: string
  pdfId: string
  chunkIndex: number
  pageNum?: number
  embedding?: number[]
}

function getCleanUint8Array(input: ArrayBuffer | Buffer): Uint8Array {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const cleanArrayBuffer = new ArrayBuffer(buf.length);
  const cleanUint8Array = new Uint8Array(cleanArrayBuffer);
  cleanUint8Array.set(buf);
  return cleanUint8Array;
}

/**
 * Extract a single page from a PDF into a standalone 1-page PDF base64 string
 * using pdf-lib (pure JS, zero native binaries).
 */
async function extractSinglePagePdfBase64(pdfBytes: Uint8Array, pageIndex: number): Promise<string> {
  try {
    const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const newDoc = await PDFDocument.create();
    const [copiedPage] = await newDoc.copyPages(srcDoc, [pageIndex]);
    newDoc.addPage(copiedPage);
    const singlePageBytes = await newDoc.save();
    return Buffer.from(singlePageBytes).toString("base64");
  } catch (err) {
    console.error(`[Page ${pageIndex + 1}] pdf-lib single page slice error:`, err);
    return "";
  }
}

/**
 * Send a 1-page PDF base64 directly to OpenAI gpt-4o-mini for OCR transcription.
 */
async function ocrSinglePagePdf(pdfBase64: string, pageNum: number): Promise<string> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1000,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe all visible text from this document page cleanly and accurately. Reply ONLY with the extracted text."
              },
              {
                type: "file",
                file: {
                  filename: `page_${pageNum}.pdf`,
                  file_data: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ]
      })
    });

    const json = await res.json();
    
    if (json.error) {
      console.error(`[Page ${pageNum} OpenAI OCR Error]:`, json.error);
      return "";
    }

    let pageText = (json.choices?.[0]?.message?.content || "").trim();
    // Clean out boilerplate error messages if model generated any
    pageText = pageText.replace(/No text could be parsed from the document\.?/gi, "").trim();

    if (pageText.length > 0) {
      // Clean extracted page text
    }
    return pageText;
  } catch (err) {
    console.error(`[Page ${pageNum} OCR Exception]:`, err);
    return "";
  }
}

export interface PageResult {
  pageNum: number;
  text: string;
}

/**
 * Extract per-page text objects { pageNum, text } for structured page tracking
 */
export async function extractPageObjectsFromPdf(file: File): Promise<PageResult[]> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = getCleanUint8Array(arrayBuffer);

  try {
    const pdf = await getDocumentProxy(getCleanUint8Array(uint8Array));
    const numPages = pdf.numPages;
    console.log(`[PDF Extraction] Reading ${numPages} page(s) from "${file.name}"...`);

    const pagePromises = Array.from({ length: numPages }, async (_, index) => {
      const pageNum = index + 1;
      let pageText = "";

      // Step A: Check direct text layer for this page
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        pageText = (textContent.items || [])
          .map((item: any) => item.str || "")
          .filter(Boolean)
          .join(" ")
          .trim();
        pageText = pageText.replace(/No text could be parsed from the document\.?/gi, "").trim();
      } catch (e) {
        console.warn(`[Page ${pageNum}] Text layer read error:`, e);
      }

      // Step B: If page text is sufficient (>= 20 chars), return it directly
      if (pageText.length >= 20) {
        return { pageNum, text: pageText };
      }

      // Step C: If page has NO text (< 20 chars), extract ONLY this page into a 1-page PDF & send to OpenAI OCR
      try {
        const singlePageBase64 = await extractSinglePagePdfBase64(uint8Array, index);
        if (!singlePageBase64) {
          return { pageNum, text: pageText };
        }

        const ocrText = await ocrSinglePagePdf(singlePageBase64, pageNum);
        if (ocrText.length > 0) {
          return { pageNum, text: ocrText };
        }
      } catch (ocrErr) {
        console.error(`[Page ${pageNum}] Single-page OCR pipeline error:`, ocrErr);
      }

      return { pageNum, text: pageText };
    });

    const pageResults = await Promise.all(pagePromises);
    return pageResults.filter(p => p.text && p.text.trim().length > 0);
  } catch (pdfErr) {
    console.error("Hybrid PDF Processor error:", pdfErr);
    return [];
  }
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const pages = await extractPageObjectsFromPdf(file);
  const fullCombinedText = pages.map(p => `[Page ${p.pageNum}]\n${p.text}`).join("\n\n");
  return fullCombinedText;
}

export function chunkText(text: string, maxTokens = 250, overlapTokens = 35): string[] {
  if (!text || text.trim().length === 0) return [];

  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;

  const rawParagraphs = text.split(/\n\s*\n|\n/).map(p => p.trim()).filter(p => p.length > 0);

  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of rawParagraphs) {
    // Skip boilerplate garbage strings
    if (/No text could be parsed from the document/i.test(para)) continue;

    if (currentChunk.length + para.length + 1 <= maxChars) {
      currentChunk += (currentChunk ? " " : "") + para;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        const tailOverlap = currentChunk.length > overlapChars ? currentChunk.slice(-overlapChars) : currentChunk;
        currentChunk = tailOverlap + " " + para;
      } else {
        currentChunk = para;
      }
    }
  }

  if (currentChunk && currentChunk.trim().length > 5) {
    chunks.push(currentChunk.trim());
  }

  if (chunks.length === 0 && text.trim().length > 0) {
    const cleaned = text.replace(/No text could be parsed from the document\.?/gi, "").trim();
    if (cleaned.length > 5) chunks.push(cleaned);
  }

  return chunks.filter((chunk) => chunk.trim().length > 5);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch("/api/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      throw new Error("Failed to generate embedding")
    }

    const data = await response.json()
    return data.embedding
  } catch (error) {
    console.error("Error generating embedding:", error)
    throw new Error("Failed to generate embedding")
  }
}

export async function processPdf(file: File, pdfId: string) {
  const pages = await extractPageObjectsFromPdf(file);
  const resultChunks: Array<{ content: string; pageNum: number }> = [];

  for (const pageItem of pages) {
    const pageChunks = chunkText(pageItem.text);
    for (const chunk of pageChunks) {
      resultChunks.push({
        content: chunk,
        pageNum: pageItem.pageNum,
      });
    }
  }

  // Fallback if no pages were parsed
  if (resultChunks.length === 0) {
    const rawText = await extractTextFromPdf(file);
    const textChunks = chunkText(rawText);
    textChunks.forEach((c) => resultChunks.push({ content: c, pageNum: 1 }));
  }

  return resultChunks;
}
