"use client";

import { useState } from "react";

type CsvCell = string;

const sampleJson = JSON.stringify(
  {
    ten: "TanVC",
    vai_tro: "AI developer",
    cong_cu: ["JSON formatter", "CSV converter"],
    cau_hinh: { ngon_ngu: "vi", pwa: true },
  },
  null,
  2,
);

function parseCsv(text: string): CsvCell[][] {
  const rows: CsvCell[][] = [];
  let row: CsvCell[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function csvToJson(text: string): string {
  const rows = parseCsv(text.trim());
  if (rows.length < 2) throw new Error("CSV cần ít nhất 1 dòng header và 1 dòng dữ liệu.");

  const headers = rows[0].map((header) => header.trim());
  if (headers.some((header) => !header)) throw new Error("Header CSV không được để trống.");

  const data = rows.slice(1).map((row) =>
    headers.reduce<Record<string, string>>((item, header, index) => {
      item[header] = row[index] ?? "";
      return item;
    }, {}),
  );

  return JSON.stringify(data, null, 2);
}

function csvEscape(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function jsonToCsv(text: string): string {
  const parsed = JSON.parse(text) as unknown;
  const rows = Array.isArray(parsed) ? parsed : [parsed];

  if (!rows.length || rows.some((row) => row === null || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("JSON → CSV cần object hoặc mảng object.");
  }

  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row as Record<string, unknown>))));
  if (!headers.length) throw new Error("Không tìm thấy field để xuất CSV.");

  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => {
      const record = row as Record<string, unknown>;
      return headers.map((header) => csvEscape(record[header])).join(",");
    }),
  ].join("\n");
}

export default function JsonToolPage() {
  const [input, setInput] = useState(sampleJson);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function run(action: () => string) {
    setCopied(false);
    try {
      const nextOutput = action();
      setOutput(nextOutput);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi không xác định.");
    }
  }

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Công cụ JSON</h1>
              <p className="text-sm text-muted-foreground">Format, minify, escape và chuyển đổi CSV hoàn toàn trên trình duyệt.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted" onClick={() => setInput(sampleJson)} type="button">
                Dữ liệu mẫu
              </button>
              <button className="rounded-lg border bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90" onClick={copyOutput} type="button">
                {copied ? "Đã copy" : "Copy output"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted" onClick={() => run(() => JSON.stringify(JSON.parse(input), null, 2))} type="button">
              Format đẹp
            </button>
            <button className="rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted" onClick={() => run(() => JSON.stringify(JSON.parse(input)))} type="button">
              Minify
            </button>
            <button className="rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted" onClick={() => run(() => JSON.stringify(input))} type="button">
              Escape (cho JSON-in-JSON)
            </button>
            <button className="rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted" onClick={() => run(() => JSON.parse(input) as string)} type="button">
              Unescape
            </button>
            <button className="rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted" onClick={() => run(() => csvToJson(input))} type="button">
              CSV → JSON
            </button>
            <button className="rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted" onClick={() => run(() => jsonToCsv(input))} type="button">
              JSON → CSV
            </button>
          </div>
          {error ? <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</p> : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <label className="mb-2 block text-sm font-medium" htmlFor="json-input">Input</label>
            <textarea
              className="min-h-[520px] w-full resize-y rounded-lg border bg-background p-3 font-mono text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              id="json-input"
              onChange={(event) => setInput(event.target.value)}
              spellCheck={false}
              value={input}
            />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <label className="mb-2 block text-sm font-medium" htmlFor="json-output">Output đã xử lý</label>
            <textarea
              className="min-h-[520px] w-full resize-y rounded-lg border bg-background p-3 font-mono text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              id="json-output"
              readOnly
              spellCheck={false}
              value={output}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
