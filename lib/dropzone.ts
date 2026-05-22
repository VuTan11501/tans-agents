export const ACCEPTED_FILE_TYPES = "image/*,application/pdf,.txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"

const ACCEPTED_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json"])

export function isAcceptedFile(file: File) {
  const name = file.name.toLowerCase()
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : ""

  return (
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    file.type === "text/plain" ||
    file.type === "text/markdown" ||
    file.type === "text/csv" ||
    file.type === "application/json" ||
    ACCEPTED_EXTENSIONS.has(extension)
  )
}

export function filterAcceptedFiles(files: File[]) {
  return files.filter(isAcceptedFile)
}
