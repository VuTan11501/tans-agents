"use client";

import { useState, useEffect } from "react";
import { Trash2, Copy, Edit2, Plus, Download, Search, Filter } from "lucide-react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { toast } from "sonner";

interface Snippet {
  id: string;
  title: string;
  language: string;
  tags: string[];
  code: string;
  createdAt: number;
}

const LANGUAGES = ["JavaScript", "Python", "SQL", "HTML", "CSS", "TypeScript", "JSON", "Bash"];
const STORAGE_KEY = "tans-agents:snippets-v1";

export default function SnippetsPage() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLang, setFilterLang] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [mounted, setMounted] = useState(false);

  // Form state for new/edit snippet
  const [formTitle, setFormTitle] = useState("");
  const [formLanguage, setFormLanguage] = useState("JavaScript");
  const [formTags, setFormTags] = useState("");
  const [formCode, setFormCode] = useState("");

  // Load snippets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSnippets(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load snippets:", error);
    }
    setMounted(true);
  }, []);

  // Save snippets to localStorage whenever they change
  useEffect(() => {
    if (mounted) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
      } catch (error) {
        console.error("Failed to save snippets:", error);
      }
    }
  }, [snippets, mounted]);

  const handleSaveSnippet = () => {
    if (!formTitle.trim() || !formCode.trim()) {
      toast.error("Title and code are required");
      return;
    }

    const tags = formTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);

    if (editingId) {
      // Update existing
      setSnippets(
        snippets.map((s) =>
          s.id === editingId
            ? {
                ...s,
                title: formTitle,
                language: formLanguage,
                tags,
                code: formCode,
              }
            : s,
        ),
      );
      toast.success("Snippet updated");
    } else {
      // Create new
      const newSnippet: Snippet = {
        id: Date.now().toString(),
        title: formTitle,
        language: formLanguage,
        tags,
        code: formCode,
        createdAt: Date.now(),
      };
      setSnippets([newSnippet, ...snippets]);
      toast.success("Snippet created");
    }

    resetForm();
  };

  const resetForm = () => {
    setFormTitle("");
    setFormLanguage("JavaScript");
    setFormTags("");
    setFormCode("");
    setEditingId(null);
  };

  const handleEdit = (snippet: Snippet) => {
    setFormTitle(snippet.title);
    setFormLanguage(snippet.language);
    setFormTags(snippet.tags.join(", "));
    setFormCode(snippet.code);
    setEditingId(snippet.id);
    setExpandedId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this snippet?")) {
      setSnippets(snippets.filter((s) => s.id !== id));
      toast.success("Snippet deleted");
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard");
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(snippets, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `snippets-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Exported as JSON");
  };

  const handleExportCSV = () => {
    const headers = ["Title", "Language", "Tags", "Code", "Created"];
    const rows = snippets.map((s) => [
      `"${s.title.replace(/"/g, '""')}"`,
      s.language,
      `"${s.tags.join(",").replace(/"/g, '""')}"`,
      `"${s.code.replace(/\n/g, " ").replace(/"/g, '""')}"`,
      new Date(s.createdAt).toISOString(),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `snippets-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Exported as CSV");
  };

  // Get all unique tags
  const allTags = Array.from(
    new Set(snippets.flatMap((s) => s.tags)),
  ) as string[];

  // Filter snippets
  const filtered = snippets.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLang = filterLang === "all" || s.language === filterLang;
    const matchesTag = filterTag === "all" || s.tags.includes(filterTag);
    return matchesSearch && matchesLang && matchesTag;
  });

  if (!mounted) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card p-4">
        <h1 className="text-2xl font-bold">Code Snippet Manager</h1>
        <p className="text-sm text-muted-foreground">Create, organize, and manage your code snippets</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="space-y-4 p-4">
            {/* New/Edit Form */}
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <h2 className="font-semibold">{editingId ? "Edit Snippet" : "New Snippet"}</h2>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Snippet title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="rounded border border-border bg-background px-3 py-2 text-sm"
                />
                <select
                  value={formLanguage}
                  onChange={(e) => setFormLanguage(e.target.value)}
                  className="rounded border border-border bg-background px-3 py-2 text-sm"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                placeholder="Tags (comma-separated)"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />

              <textarea
                placeholder="Paste your code here..."
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                rows={6}
                className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm"
              />

              <div className="flex gap-2">
                <button
                  onClick={handleSaveSnippet}
                  className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Plus size={16} />
                  {editingId ? "Update" : "Save"} Snippet
                </button>
                {editingId && (
                  <button
                    onClick={resetForm}
                    className="rounded bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Filters & Export */}
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search snippets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Filter size={16} />
                  <select
                    value={filterLang}
                    onChange={(e) => setFilterLang(e.target.value)}
                    className="rounded border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Languages</option>
                    {LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                  className="rounded border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="all">All Tags</option>
                  {allTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>

                <div className="ml-auto flex gap-2">
                  <button
                    onClick={handleExportJSON}
                    className="flex items-center gap-2 rounded bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <Download size={16} />
                    JSON
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 rounded bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <Download size={16} />
                    CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Snippets List */}
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
                  {snippets.length === 0 ? "No snippets yet. Create one!" : "No snippets match your filters."}
                </div>
              ) : (
                filtered.map((snippet) => (
                  <div key={snippet.id} className="rounded-lg border border-border bg-card">
                    {/* Summary */}
                    <div
                      className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/50"
                      onClick={() =>
                        setExpandedId(expandedId === snippet.id ? null : snippet.id)
                      }
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold">{snippet.title}</h3>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span className="inline-block rounded-full bg-blue-600/20 px-2 py-1 text-xs text-blue-600">
                            {snippet.language}
                          </span>
                          {snippet.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-block rounded-full bg-gray-600/20 px-2 py-1 text-xs text-gray-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {snippet.code.length} chars • {new Date(snippet.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-muted-foreground">
                        {expandedId === snippet.id ? "▼" : "▶"}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedId === snippet.id && (
                      <div className="border-t border-border bg-muted/30 p-4">
                        <div className="mb-3 max-h-96 overflow-auto rounded bg-background">
                          <SyntaxHighlighter
                            language={snippet.language.toLowerCase()}
                            style={atomOneDark}
                            customStyle={{
                              margin: 0,
                              padding: "1rem",
                              fontSize: "0.875rem",
                            }}
                            wrapLines
                          >
                            {snippet.code}
                          </SyntaxHighlighter>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopy(snippet.code)}
                            className="flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            <Copy size={16} />
                            Copy
                          </button>
                          <button
                            onClick={() => handleEdit(snippet)}
                            className="flex items-center gap-2 rounded bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700"
                          >
                            <Edit2 size={16} />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(snippet.id)}
                            className="flex items-center gap-2 rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
