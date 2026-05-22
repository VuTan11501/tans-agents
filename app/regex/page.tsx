"use client";

import { useMemo, useState } from "react";

type MatchItem = {
  index: number;
  text: string;
  groups: string[];
  namedGroups: Record<string, string>;
};

const sampleText = `Liên hệ Tan qua email tan@example.com hoặc website https://example.com.
Số điện thoại VN: 0912 345 678.
Ngày demo: 2026-05-23.`;

const cheatPatterns = [
  { name: "Email", pattern: String.raw`[\w.-]+@[\w.-]+\.\w+` },
  { name: "URL", pattern: String.raw`https?:\/\/[^\s]+` },
  { name: "SĐT Việt Nam", pattern: String.raw`(?:\+84|0)(?:\d[\s.-]?){9,10}` },
  { name: "Ngày YYYY-MM-DD", pattern: String.raw`\b\d{4}-\d{2}-\d{2}\b` },
];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function uniqueFlags(flags: string): string {
  return Array.from(new Set(flags.split(""))).join("");
}

function buildMatches(pattern: string, flags: string, text: string): { matches: MatchItem[]; error: string } {
  if (!pattern) return { matches: [], error: "" };

  try {
    const regexp = new RegExp(pattern, uniqueFlags(flags));
    const matches: MatchItem[] = [];

    if (flags.includes("g")) {
      let match: RegExpExecArray | null;
      while ((match = regexp.exec(text)) !== null) {
        matches.push({
          index: match.index,
          text: match[0],
          groups: match.slice(1),
          namedGroups: match.groups ?? {},
        });
        if (match[0] === "") regexp.lastIndex += 1;
      }
    } else {
      const match = regexp.exec(text);
      if (match) {
        matches.push({
          index: match.index,
          text: match[0],
          groups: match.slice(1),
          namedGroups: match.groups ?? {},
        });
      }
    }

    return { matches, error: "" };
  } catch (err) {
    return { matches: [], error: err instanceof Error ? err.message : "Regex không hợp lệ." };
  }
}

function buildHighlightedHtml(text: string, matches: MatchItem[]): string {
  if (!matches.length) return escapeHtml(text);

  let cursor = 0;
  let html = "";
  const sortedMatches = [...matches].sort((a, b) => a.index - b.index);

  for (const match of sortedMatches) {
    if (match.index < cursor) continue;
    html += escapeHtml(text.slice(cursor, match.index));
    if (match.text.length === 0) {
      html += '<mark class="rounded bg-yellow-300 px-1 text-yellow-950">∅</mark>';
      cursor = match.index;
    } else {
      html += `<mark class="rounded bg-yellow-300 px-1 text-yellow-950">${escapeHtml(match.text)}</mark>`;
      cursor = match.index + match.text.length;
    }
  }

  html += escapeHtml(text.slice(cursor));
  return html;
}

export default function RegexToolPage() {
  const [pattern, setPattern] = useState(String.raw`[\w.-]+@[\w.-]+\.\w+`);
  const [testText, setTestText] = useState(sampleText);
  const [flagState, setFlagState] = useState({ g: true, i: false, m: false, s: false, u: true });

  const flags = useMemo(() => Object.entries(flagState).filter(([, enabled]) => enabled).map(([flag]) => flag).join(""), [flagState]);
  const result = useMemo(() => buildMatches(pattern, flags, testText), [pattern, flags, testText]);
  const highlightedHtml = useMemo(() => buildHighlightedHtml(testText, result.matches), [testText, result.matches]);

  function toggleFlag(flag: keyof typeof flagState) {
    setFlagState((current) => ({ ...current, [flag]: !current[flag] }));
  }

  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Công cụ Regex</h1>
          <p className="text-sm text-muted-foreground">Test RegExp trực tiếp trên trình duyệt, có highlight và danh sách match.</p>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border bg-card p-4">
              <label className="mb-2 block text-sm font-medium" htmlFor="regex-pattern">Pattern</label>
              <input
                className="w-full rounded-lg border bg-background p-3 font-mono text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                id="regex-pattern"
                onChange={(event) => setPattern(event.target.value)}
                placeholder="Nhập regex, không cần dấu /.../"
                spellCheck={false}
                value={pattern}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Flags:</span>
                {(Object.keys(flagState) as Array<keyof typeof flagState>).map((flag) => (
                  <button
                    className={`rounded-lg border px-3 py-1.5 font-mono text-sm ${flagState[flag] ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                    key={flag}
                    onClick={() => toggleFlag(flag)}
                    type="button"
                  >
                    {flag}
                  </button>
                ))}
              </div>
              {result.error ? <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{result.error}</p> : null}
            </div>

            <div className="rounded-lg border bg-card p-4">
              <label className="mb-2 block text-sm font-medium" htmlFor="regex-text">Văn bản test</label>
              <textarea
                className="min-h-[260px] w-full resize-y rounded-lg border bg-background p-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                id="regex-text"
                onChange={(event) => setTestText(event.target.value)}
                value={testText}
              />
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="font-semibold">Highlight</h2>
                <span className="text-sm text-muted-foreground">{result.matches.length} kết quả</span>
              </div>
              <pre
                className="min-h-[180px] whitespace-pre-wrap rounded-lg border bg-background p-3 text-sm leading-6"
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-semibold">Kết quả live</h2>
              <p className="mt-1 text-sm text-muted-foreground">Regex hiện tại: <code className="font-mono">/{pattern}/{flags}</code></p>
              <div className="mt-4 space-y-3">
                {result.matches.length ? result.matches.map((match, index) => (
                  <div className="rounded-lg border bg-background p-3" key={`${match.index}-${index}-${match.text}`}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">Match #{index + 1}</span>
                      <span className="text-muted-foreground">index {match.index}</span>
                    </div>
                    <pre className="mt-2 overflow-auto rounded border bg-card p-2 font-mono text-xs">{match.text || "(empty match)"}</pre>
                    {match.groups.length ? <p className="mt-2 text-xs text-muted-foreground">Groups: {JSON.stringify(match.groups)}</p> : null}
                    {Object.keys(match.namedGroups).length ? <p className="mt-1 text-xs text-muted-foreground">Named: {JSON.stringify(match.namedGroups)}</p> : null}
                  </div>
                )) : <p className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">Chưa có match.</p>}
              </div>
            </div>

            <details className="rounded-lg border bg-card p-4">
              <summary className="cursor-pointer font-semibold">Cheat-sheet mẫu thường dùng</summary>
              <div className="mt-4 space-y-3">
                {cheatPatterns.map((item) => (
                  <button
                    className="w-full rounded-lg border bg-background p-3 text-left hover:bg-muted"
                    key={item.name}
                    onClick={() => setPattern(item.pattern)}
                    type="button"
                  >
                    <span className="block text-sm font-medium">{item.name}</span>
                    <code className="mt-1 block break-all font-mono text-xs text-muted-foreground">{item.pattern}</code>
                  </button>
                ))}
              </div>
            </details>
          </aside>
        </section>
      </div>
    </main>
  );
}
