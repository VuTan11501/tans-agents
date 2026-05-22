"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const ALGORITHMS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
type Algorithm = (typeof ALGORITHMS)[number];
type Hashes = Record<Algorithm, string>;

const EMPTY_HASHES = Object.fromEntries(ALGORITHMS.map((algo) => [algo, ""])) as Hashes;

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function computeHashes(data: ArrayBuffer): Promise<Hashes> {
  const entries = await Promise.all(
    ALGORITHMS.map(async (algorithm) => {
      const digest = await crypto.subtle.digest(algorithm, data.slice(0));
      return [algorithm, bufferToHex(digest)] as const;
    }),
  );

  return Object.fromEntries(entries) as Hashes;
}

export default function HashPage() {
  const [text, setText] = useState("");
  const [source, setSource] = useState<"text" | "file">("text");
  const [fileName, setFileName] = useState("");
  const [hashes, setHashes] = useState<Hashes>(EMPTY_HASHES);
  const [isComputing, setIsComputing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sourceLabel = useMemo(() => {
    if (source === "file" && fileName) return `Đang băm file: ${fileName}`;
    return "Đang băm nội dung văn bản";
  }, [fileName, source]);

  useEffect(() => {
    if (source !== "text") return;

    const timer = window.setTimeout(async () => {
      setIsComputing(true);
      setError("");
      try {
        const data = new TextEncoder().encode(text).buffer;
        setHashes(await computeHashes(data));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể tính hash.");
      } finally {
        setIsComputing(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [source, text]);

  async function handleFile(file: File) {
    setSource("file");
    setFileName(`${file.name} (${file.size.toLocaleString("vi-VN")} bytes)`);
    setIsComputing(true);
    setError("");

    try {
      setHashes(await computeHashes(await file.arrayBuffer()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đọc file.");
    } finally {
      setIsComputing(false);
    }
  }

  async function copyHash(label: string, value: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1200);
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Công cụ mã hóa</p>
            <h1 className="text-3xl font-bold tracking-tight">Tính SHA Hash</h1>
            <p className="text-sm text-muted-foreground">
              Nhập văn bản hoặc thả file để tính SHA-1, SHA-256, SHA-384 và SHA-512 trực tiếp trên trình duyệt.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label htmlFor="hash-input" className="text-sm font-semibold">
                Văn bản
              </label>
              <span className="text-xs text-muted-foreground">Tự tính sau 300ms</span>
            </div>
            <textarea
              id="hash-input"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setSource("text");
                setFileName("");
              }}
              placeholder="Nhập nội dung cần băm..."
              className="min-h-52 w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
            />

            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                const file = event.dataTransfer.files.item(0);
                if (file) void handleFile(file);
              }}
              className={`mt-4 rounded-xl border border-dashed p-6 text-center transition ${
                isDragging ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:bg-muted/60"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.item(0);
                  if (file) void handleFile(file);
                }}
              />
              <p className="font-medium">Kéo-thả file vào đây hoặc bấm để chọn file</p>
              <p className="mt-1 text-xs text-muted-foreground">Hash được tính từ byte gốc của file.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Kết quả</h2>
                <p className="text-xs text-muted-foreground">{sourceLabel}</p>
              </div>
              {isComputing ? (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Đang tính...</span>
              ) : null}
            </div>

            {error ? (
              <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="space-y-3">
              {ALGORITHMS.map((algorithm) => (
                <div key={algorithm} className="rounded-xl border border-border bg-background p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{algorithm}</span>
                    <button
                      type="button"
                      onClick={() => void copyHash(algorithm, hashes[algorithm])}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!hashes[algorithm]}
                    >
                      {copied === algorithm ? "Đã chép" : "Sao chép"}
                    </button>
                  </div>
                  <code className="block break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                    {hashes[algorithm] || "—"}
                  </code>
                </div>
              ))}
            </div>

            <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              MD5 không có sẵn trong Web Crypto. Dùng SHA-256 thay thế (an toàn hơn).
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
