"use client"

export interface ExperimentalAttachment {
  name: string
  contentType: string
  url: string
}

export function isImageFile(file: File) {
  return file.type.startsWith("image/")
}

export function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
}

export function isTextFile(file: File) {
  return file.type.startsWith("text/")
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error(`Không đọc được file ${file.name}`))
    reader.readAsDataURL(file)
  })
}

export async function fileToAttachment(file: File): Promise<ExperimentalAttachment> {
  return {
    name: file.name,
    contentType: file.type || "application/octet-stream",
    url: await fileToDataUrl(file),
  }
}

export async function extractFileText(file: File): Promise<string> {
  if (isTextFile(file)) {
    return file.text()
  }

  if (isPdfFile(file)) {
    const pdfjs = await import("pdfjs-dist")
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString()

    const data = new Uint8Array(await file.arrayBuffer())
    const documentTask = pdfjs.getDocument({ data })
    const pdf = await documentTask.promise
    const pages: string[] = []

    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
        if (pageText) pages.push(pageText)
      }
    } finally {
      await pdf.destroy()
    }

    return pages.join("\n\n")
  }

  return ""
}
