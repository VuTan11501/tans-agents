"use client";

import { useMemo, useState } from "react";

const sampleSql = `select u.id, u.name, count(o.id) as total_orders from users u left join orders o on o.user_id = u.id where u.status = 'active' and o.created_at >= '2026-01-01' group by u.id, u.name order by total_orders desc limit 20;`;

const keywordPatterns = [
  "UNION ALL",
  "GROUP BY",
  "ORDER BY",
  "LEFT JOIN",
  "RIGHT JOIN",
  "INNER JOIN",
  "OUTER JOIN",
  "FULL JOIN",
  "CROSS JOIN",
  "DELETE FROM",
  "INSERT INTO",
  "SELECT",
  "FROM",
  "WHERE",
  "JOIN",
  "AND",
  "OR",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "INSERT",
  "UPDATE",
  "DELETE",
  "INTO",
  "VALUES",
  "SET",
  "ON",
  "AS",
  "LEFT",
  "RIGHT",
  "INNER",
  "OUTER",
  "FULL",
  "CROSS",
  "UNION",
  "DISTINCT",
  "RETURNING",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "ORDER",
  "GROUP",
  "BY",
];

const majorClauses = [
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "INSERT INTO",
  "UPDATE",
  "DELETE FROM",
  "VALUES",
  "SET",
  "UNION",
  "UNION ALL",
  "RETURNING",
];

const joinClauses = ["LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "OUTER JOIN", "FULL JOIN", "CROSS JOIN", "JOIN"];

type Segment = { text: string; quoted: boolean };

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitSqlSegments(sql: string): Segment[] {
  const segments: Segment[] = [];
  let current = "";
  let quote: "'" | '"' | "`" | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (quote) {
      current += char;
      if (char === quote) {
        if ((quote === "'" || quote === '"') && next === quote) {
          current += next;
          index += 1;
        } else {
          segments.push({ text: current, quoted: true });
          current = "";
          quote = null;
        }
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      if (current) segments.push({ text: current, quoted: false });
      current = char;
      quote = char;
      continue;
    }

    current += char;
  }

  if (current) segments.push({ text: current, quoted: Boolean(quote) });
  return segments;
}

function applyKeywordCase(sql: string, mode: "upper" | "lower") {
  const matcher = new RegExp(`\\b(${keywordPatterns.map((keyword) => keyword.split(" ").map(escapeRegExp).join("\\\\s+")).join("|")})\\b`, "gi");
  return splitSqlSegments(sql)
    .map((segment) => {
      if (segment.quoted) return segment.text;
      return segment.text.replace(matcher, (match) => {
        const normalized = match.replace(/\s+/g, " ");
        return mode === "upper" ? normalized.toUpperCase() : normalized.toLowerCase();
      });
    })
    .join("");
}

function minifySql(sql: string) {
  return splitSqlSegments(sql)
    .map((segment) => (segment.quoted ? segment.text : segment.text.replace(/\s+/g, " ")))
    .join("")
    .replace(/\s*([(),;])\s*/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatSql(sql: string) {
  let formatted = applyKeywordCase(minifySql(sql), "upper");

  [...majorClauses, ...joinClauses].forEach((clause) => {
    const pattern = new RegExp(`\\s*\\b${clause.split(" ").map(escapeRegExp).join("\\\\s+")}\\b`, "g");
    formatted = formatted.replace(pattern, `\n${clause}`);
  });

  formatted = formatted
    .replace(/\s+\b(AND|OR)\b\s+/g, "\n  $1 ")
    .replace(/,\s*/g, ",\n  ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\n{2,}/g, "\n")
    .trim();

  return formatted.endsWith(";") ? formatted : `${formatted};`;
}

function OutputWithLineNumbers({ value }: { value: string }) {
  const lines = (value || "Kết quả sẽ hiển thị ở đây.").split("\n");

  return (
    <div className="min-h-[520px] overflow-auto rounded-lg border bg-background font-mono text-sm">
      <div className="flex">
        <div className="select-none border-r bg-muted/40 px-3 py-3 text-right text-muted-foreground">
          {lines.map((_, index) => (
            <div key={`line-${index + 1}`} className="leading-6">
              {index + 1}
            </div>
          ))}
        </div>
        <pre className="flex-1 whitespace-pre-wrap px-3 py-3 leading-6 text-foreground">{lines.join("\n")}</pre>
      </div>
    </div>
  );
}

export default function SqlToolPage() {
  const [input, setInput] = useState(sampleSql);
  const [output, setOutput] = useState(formatSql(sampleSql));
  const [copied, setCopied] = useState(false);

  const outputStats = useMemo(() => {
    const text = output.trim();
    return text ? `${text.split("\n").length} dòng · ${text.length} ký tự` : "Chưa có output";
  }, [output]);

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
              <h1 className="text-2xl font-semibold tracking-tight">Công cụ SQL</h1>
              <p className="text-sm text-muted-foreground">Format, minify và đổi kiểu keyword SQL trực tiếp trên trình duyệt.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted" onClick={() => setInput(sampleSql)} type="button">
                SQL mẫu
              </button>
              <button className="rounded-lg border bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90" onClick={copyOutput} type="button">
                {copied ? "Đã copy" : "Copy output"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted" onClick={() => setOutput(formatSql(input))} type="button">
              Format đẹp
            </button>
            <button className="rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted" onClick={() => setOutput(minifySql(input))} type="button">
              Minify
            </button>
            <button className="rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted" onClick={() => setOutput(applyKeywordCase(input, "upper"))} type="button">
              UPPERCASE keywords
            </button>
            <button className="rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted" onClick={() => setOutput(applyKeywordCase(input, "lower"))} type="button">
              lowercase keywords
            </button>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <label className="mb-2 block text-sm font-medium" htmlFor="sql-input">
              Nhập SQL
            </label>
            <textarea
              className="min-h-[520px] w-full resize-y rounded-lg border bg-background p-3 font-mono text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              id="sql-input"
              onChange={(event) => setInput(event.target.value)}
              spellCheck={false}
              value={input}
            />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="block text-sm font-medium">Output đã xử lý</label>
              <span className="text-xs text-muted-foreground">{outputStats}</span>
            </div>
            <OutputWithLineNumbers value={output} />
          </div>
        </section>
      </div>
    </main>
  );
}
