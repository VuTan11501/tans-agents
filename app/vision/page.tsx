"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Copy, Trash2, History, Loader, Eye, FileText, Tag, Smile } from "lucide-react";
import { toast } from "sonner";

interface AnalysisResult {
  id: string;
  timestamp: number;
  imageBase64: string;
  originalFilename: string;
  describe?: string;
  ocr?: string;
  tags?: string[];
  emotion?: string;
}

type ActionType = "describe" | "ocr" | "tags" | "emotion";

interface StreamingState {
  action: ActionType | null;
  content: string;
  isLoading: boolean;
}

const STORAGE_KEY = "tans-agents:vision-history-v1";

export default function VisionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [activeTab, setActiveTab] = useState<"analyze" | "history">("analyze");
  const [streaming, setStreaming] = useState<StreamingState>({
    action: null,
    content: "",
    isLoading: false,
  });
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        console.error("Failed to load history");
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) {
      toast.error("Please select an image file (JPG, PNG)");
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
      setCurrentAnalysis(null);
    };
    reader.readAsDataURL(selectedFile);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleAnalyze = async (action: ActionType) => {
    if (!file || !imagePreview) {
      toast.error("Please select an image first");
      return;
    }

    setStreaming({ action, content: "", isLoading: true });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("action", action);

      if (action === "describe" || action === "tags" || action === "emotion") {
        // SSE streaming for AI analysis
        const response = await fetch("/api/vision", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("API request failed");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (!reader) throw new Error("No response body");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");

          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  setStreaming((prev) => ({
                    ...prev,
                    content: prev.content + data.content,
                  }));
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
          buffer = lines[lines.length - 1];
        }
      } else if (action === "ocr") {
        // Regular POST for OCR
        const response = await fetch("/api/vision", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("API request failed");
        }

        const data = await response.json();
        setStreaming((prev) => ({ ...prev, content: data.text || "" }));
      }

      // Save to analysis
      setCurrentAnalysis((prev) => {
        const analysis = prev || {
          id: Date.now().toString(),
          timestamp: Date.now(),
          imageBase64: imagePreview,
          originalFilename: file.name,
        };
        const updatedAnalysis = { ...analysis };
        if (action === "tags") {
          updatedAnalysis.tags = streaming.content.split("\n").filter(Boolean);
        } else if (action === "describe") {
          updatedAnalysis.describe = streaming.content;
        } else if (action === "ocr") {
          updatedAnalysis.ocr = streaming.content;
        } else if (action === "emotion") {
          updatedAnalysis.emotion = streaming.content;
        }
        return updatedAnalysis;
      });
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze image");
    } finally {
      setStreaming((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleSaveAnalysis = () => {
    if (!currentAnalysis) {
      toast.error("No analysis to save");
      return;
    }

    const existing = history.findIndex((h) => h.id === currentAnalysis.id);
    if (existing >= 0) {
      const updated = [...history];
      updated[existing] = currentAnalysis;
      setHistory(updated);
      toast.success("Analysis updated");
    } else {
      setHistory((prev) => [currentAnalysis, ...prev]);
      toast.success("Analysis saved");
    }

    setFile(null);
    setImagePreview(null);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleDownload = (result: AnalysisResult) => {
    const content = [
      `Image: ${result.originalFilename}`,
      `Date: ${new Date(result.timestamp).toLocaleString()}`,
      "",
      result.describe ? `Description:\n${result.describe}\n` : "",
      result.tags ? `Objects: ${result.tags.join(", ")}\n` : "",
      result.ocr ? `Text (OCR):\n${result.ocr}\n` : "",
      result.emotion ? `Emotion/Mood:\n${result.emotion}\n` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis-${result.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteHistory = (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
    toast.success("Analysis deleted");
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">🖼️ Image Analysis & Vision</h1>
        <p className="text-gray-600">Analyze images with AI: describe, extract text, detect objects, and analyze mood</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("analyze")}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === "analyze"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Analyze
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 font-semibold transition flex items-center gap-2 ${
            activeTab === "history"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <History size={16} /> History ({history.length})
        </button>
      </div>

      {/* Analyze Tab */}
      {activeTab === "analyze" && (
        <div className="space-y-4">
          {/* File Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
              hidden
            />
            <div className="text-gray-500">
              <p className="text-lg font-semibold mb-1">Drag & drop image here</p>
              <p className="text-sm">or click to select (JPG, PNG, WebP)</p>
            </div>
          </div>

          {/* Image Preview */}
          {imagePreview && (
            <div className="space-y-4">
              <div className="bg-gray-100 rounded-lg p-4 flex justify-center">
                <img src={imagePreview} alt="Preview" className="max-h-96 max-w-full rounded" />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => handleAnalyze("describe")}
                  disabled={streaming.isLoading}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition"
                >
                  {streaming.action === "describe" && streaming.isLoading ? (
                    <Loader size={16} className="animate-spin" />
                  ) : (
                    <Eye size={16} />
                  )}
                  🔍 Describe
                </button>
                <button
                  onClick={() => handleAnalyze("ocr")}
                  disabled={streaming.isLoading}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition"
                >
                  {streaming.action === "ocr" && streaming.isLoading ? (
                    <Loader size={16} className="animate-spin" />
                  ) : (
                    <FileText size={16} />
                  )}
                  📝 OCR
                </button>
                <button
                  onClick={() => handleAnalyze("tags")}
                  disabled={streaming.isLoading}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 transition"
                >
                  {streaming.action === "tags" && streaming.isLoading ? (
                    <Loader size={16} className="animate-spin" />
                  ) : (
                    <Tag size={16} />
                  )}
                  🏷️ Tag Objects
                </button>
                <button
                  onClick={() => handleAnalyze("emotion")}
                  disabled={streaming.isLoading}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50 transition"
                >
                  {streaming.action === "emotion" && streaming.isLoading ? (
                    <Loader size={16} className="animate-spin" />
                  ) : (
                    <Smile size={16} />
                  )}
                  😊 Emotion
                </button>
              </div>

              {/* Results Display */}
              {streaming.content && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">
                      {streaming.action === "describe" && "📋 Description"}
                      {streaming.action === "ocr" && "📝 Extracted Text"}
                      {streaming.action === "tags" && "🏷️ Objects Detected"}
                      {streaming.action === "emotion" && "😊 Mood Analysis"}
                    </h3>
                    <button
                      onClick={() => handleCopy(streaming.content)}
                      className="text-gray-500 hover:text-gray-900 transition"
                      title="Copy"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                  <div className="text-gray-700 whitespace-pre-wrap text-sm">
                    {streaming.content}
                  </div>
                </div>
              )}

              {/* Save Analysis Button */}
              {currentAnalysis && streaming.content && (
                <button
                  onClick={handleSaveAnalysis}
                  className="w-full px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition"
                >
                  Save Analysis
                </button>
              )}

              {/* Clear Button */}
              <button
                onClick={() => {
                  setFile(null);
                  setImagePreview(null);
                  setCurrentAnalysis(null);
                  setStreaming({ action: null, content: "", isLoading: false });
                }}
                className="w-full px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {history.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No analyses saved yet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.map((result) => (
                <div key={result.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  {/* Thumbnail */}
                  <img src={result.imageBase64} alt={result.originalFilename} className="w-full h-40 object-cover rounded" />

                  {/* Info */}
                  <div>
                    <p className="font-semibold truncate">{result.originalFilename}</p>
                    <p className="text-xs text-gray-500">{new Date(result.timestamp).toLocaleString()}</p>
                  </div>

                  {/* Analysis Results */}
                  {(result.describe || result.ocr || result.tags || result.emotion) && (
                    <div className="space-y-2 text-sm">
                      {result.describe && (
                        <div>
                          <p className="font-semibold text-gray-700">📋 Description:</p>
                          <p className="text-gray-600 line-clamp-2">{result.describe}</p>
                        </div>
                      )}
                      {result.tags && (
                        <div>
                          <p className="font-semibold text-gray-700">🏷️ Objects:</p>
                          <p className="text-gray-600">{result.tags.slice(0, 3).join(", ")}</p>
                        </div>
                      )}
                      {result.emotion && (
                        <div>
                          <p className="font-semibold text-gray-700">😊 Mood:</p>
                          <p className="text-gray-600 line-clamp-1">{result.emotion}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleDownload(result)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition"
                      title="Download"
                    >
                      <Download size={14} /> Download
                    </button>
                    <button
                      onClick={() => handleDeleteHistory(result.id)}
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
