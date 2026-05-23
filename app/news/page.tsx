"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MarkdownPreview } from "@/components/markdown-preview"
import { SparklesIcon, ExternalLinkIcon, StarIcon, XIcon, LoaderIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface NewsArticle {
  id: string
  headline: string
  source: string
  date: string
  snippet: string
  content: string
  url: string
  image?: string
  category: string
}

type Category = "Technology" | "Business" | "Health" | "Sports" | "Science"

const CATEGORIES: Category[] = ["Technology", "Business", "Health", "Sports", "Science"]

// Mock news data with real-ish content
const MOCK_NEWS: NewsArticle[] = [
  {
    id: "1",
    headline: "AI Models Get Smarter: New Reasoning Breakthroughs",
    source: "TechNews Daily",
    date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    snippet: "Recent advances in AI reasoning capabilities are reshaping the landscape of machine learning...",
    content:
      "# AI Models Get Smarter: New Reasoning Breakthroughs\n\nRecent advances in AI reasoning capabilities are reshaping the landscape of machine learning. Researchers at leading institutions have demonstrated that modern AI systems can now solve complex logical problems that previously required human expertise.\n\n## Key Developments\n\n- **Enhanced Problem Solving**: New architectures can break down complex problems step-by-step\n- **Improved Accuracy**: 40% reduction in errors on benchmark tests\n- **Faster Training**: New optimization techniques reduce training time by 60%\n\n## Industry Impact\n\nThese breakthroughs are expected to accelerate development in:\n- Autonomous systems\n- Scientific research automation\n- Complex decision-making applications\n\nExperts predict significant commercial applications within 12-18 months.",
    url: "https://example.com/ai-reasoning",
    category: "Technology",
    image: "🤖",
  },
  {
    id: "2",
    headline: "Tech Giant Reports Record Earnings Despite Market Slowdown",
    source: "Business Weekly",
    date: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    snippet: "Major technology company announces Q4 financial results, beating analyst expectations by 23%...",
    content:
      "# Tech Giant Reports Record Earnings\n\n## Financial Highlights\n\nA major technology company announced record-breaking financial results for Q4, defying market predictions.\n\n### Key Metrics\n- **Revenue**: $150B (↑23% YoY)\n- **Profit Margin**: 28% (↑5pp)\n- **Stock Performance**: +18% this quarter\n\n### Strategic Initiatives\n1. Cloud infrastructure expansion\n2. AI product suite launches\n3. Enterprise partnerships\n\nCEO stated: \"Our diversified approach and focus on AI innovation continue to drive growth.\" The company plans $50B in new investments over the next year.",
    url: "https://example.com/earnings",
    category: "Business",
    image: "📈",
  },
  {
    id: "3",
    headline: "New Study: Mediterranean Diet Reduces Health Risks",
    source: "Health Today",
    date: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    snippet: "Large-scale research shows following Mediterranean diet can reduce cardiovascular disease by 30%...",
    content:
      "# Mediterranean Diet Shows Significant Health Benefits\n\n## Study Results\n\nA comprehensive study spanning 10 years and 50,000 participants demonstrates the health benefits of Mediterranean diet.\n\n### Key Findings\n- **30% reduction** in cardiovascular disease\n- **25% lower** risk of cognitive decline\n- **15% improvement** in overall life expectancy\n\n### Recommended Foods\n- Olive oil\n- Fresh vegetables\n- Whole grains\n- Fish and legumes\n- Moderate red wine consumption\n\nNutritionists recommend gradually adopting Mediterranean dietary patterns for optimal results.",
    url: "https://example.com/mediterranean-diet",
    category: "Health",
    image: "🥗",
  },
  {
    id: "4",
    headline: "Championship Team Wins Historic Victory",
    source: "Sports Daily",
    date: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    snippet: "In a thrilling match, the underdog team defeats defending champions in overtime...",
    content:
      "# Historic Championship Victory\n\n## Match Summary\n\nIn an unprecedented upset, the underdog team clinched victory against three-time defending champions.\n\n### Game Highlights\n- **Final Score**: 3-2 (OT)\n- **MVP**: Team Captain with 2 goals\n- **Attendance**: 80,000 spectators\n- **Duration**: 120 minutes of intense play\n\n### Key Moments\n1. First goal at 15 minutes\n2. Equalizer in the 89th minute\n3. Winning goal in overtime\n\nThe team's coach praised the team's resilience: \"Never giving up is what champions do.\"",
    url: "https://example.com/championship",
    category: "Sports",
    image: "⚽",
  },
  {
    id: "5",
    headline: "Scientists Discover New Exoplanet Potentially Habitable",
    source: "Science Today",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    snippet: "Astronomers detect Earth-sized planet in habitable zone of nearby star system...",
    content:
      "# New Exoplanet Discovery Could Harbor Life\n\n## Discovery Details\n\nAstronomers using advanced telescopes have detected a potentially habitable exoplanet just 40 light-years away.\n\n### Planet Characteristics\n- **Type**: Rocky, Earth-sized\n- **Orbital Period**: 35 Earth days\n- **Distance from Star**: Habitable zone\n- **Temperature Range**: -50°C to 50°C (estimated)\n\n### Scientific Significance\n1. First Earth-analog in this star system\n2. Could have liquid water\n3. Potential for atmosphere\n\n### Next Steps\n- Spectroscopic analysis for atmospheric composition\n- Search for biosignatures\n- Planning future missions\n\nThis discovery marks a milestone in the search for extraterrestrial life.",
    url: "https://example.com/exoplanet",
    category: "Science",
    image: "🔭",
  },
]

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null)
  const [activeCategory, setActiveCategory] = useState<Category>("Technology")
  const [savedArticles, setSavedArticles] = useState<string[]>([])
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [summary, setSummary] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)

  const STORAGE_KEY = "tans-agents:saved-articles-v1"

  useEffect(() => {
    // Load articles (use mock data)
    setArticles(MOCK_NEWS)
    setIsLoading(false)

    // Load saved articles
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setSavedArticles(JSON.parse(saved))
    }
  }, [])

  const filtered = articles.filter((a) => a.category === activeCategory)

  const toggleSaveArticle = (id: string) => {
    setSavedArticles((prev) => {
      const updated = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  const handleAISummary = async () => {
    if (!selectedArticle) return

    setIsLoadingSummary(true)
    setSummary("")

    try {
      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Please provide a concise 3-4 sentence summary of this article:\n\nHeadline: ${selectedArticle.headline}\nContent: ${selectedArticle.content.substring(0, 500)}`,
            },
          ],
        }),
      })

      if (!response.ok) throw new Error("API error")

      let fullText = ""
      const reader = response.body?.getReader()
      if (!reader) throw new Error("No reader")

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = new TextDecoder().decode(value)
        fullText += chunk

        // Extract text from SSE format and update summary live
        const lines = chunk.split("\n").filter((l) => l.startsWith("0:"))
        lines.forEach((line) => {
          const text = line.substring(2)
          setSummary((prev) => prev + text)
        })
      }

      toast.success("Summary generated")
    } catch (err) {
      console.error(err)
      toast.error("Failed to generate summary")
      setSummary("")
    } finally {
      setIsLoadingSummary(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <LoaderIcon className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading news...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar with Categories */}
      <div className="w-56 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">✨ News Feed</h1>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2 border-b">
            <p className="text-xs font-semibold text-muted-foreground">CATEGORIES</p>
            <div className="space-y-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded transition text-sm",
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Saved Articles */}
          {savedArticles.length > 0 && (
            <div className="p-4 space-y-2 border-b">
              <p className="text-xs font-semibold text-muted-foreground">SAVED ({savedArticles.length})</p>
              <div className="space-y-1">
                {savedArticles
                  .map((id) => articles.find((a) => a.id === id))
                  .filter(Boolean)
                  .map((article) => (
                    <button
                      key={article!.id}
                      onClick={() => setSelectedArticle(article!)}
                      className="w-full text-left p-2 rounded hover:bg-muted text-sm truncate border border-amber-500/30 bg-amber-500/5"
                      title={article!.headline}
                    >
                      <div className="flex items-center gap-1">
                        <StarIcon className="h-3 w-3 fill-current text-amber-500" />
                        <span className="truncate">{article!.headline}</span>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Articles List */}
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              {activeCategory.toUpperCase()} ({filtered.length})
            </p>
            <div className="space-y-2">
              {filtered.map((article) => (
                <button
                  key={article.id}
                  onClick={() => setSelectedArticle(article)}
                  className={cn(
                    "w-full text-left p-2 rounded transition text-sm",
                    selectedArticle?.id === article.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted border border-transparent hover:border-muted-foreground/20"
                  )}
                  title={article.headline}
                >
                  <div className="font-medium text-xs line-clamp-2">{article.headline}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(article.date).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedArticle ? (
          <>
            {/* Article Header */}
            <div className="border-b bg-muted/50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{selectedArticle.category}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(selectedArticle.date).toLocaleString()}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold">{selectedArticle.headline}</h2>
                  <p className="text-sm text-muted-foreground mt-2">Source: {selectedArticle.source}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    onClick={() => toggleSaveArticle(selectedArticle.id)}
                    size="sm"
                    variant={savedArticles.includes(selectedArticle.id) ? "default" : "outline"}
                  >
                    <StarIcon
                      className={cn(
                        "h-4 w-4 mr-2",
                        savedArticles.includes(selectedArticle.id) ? "fill-current" : ""
                      )}
                    />
                    Save
                  </Button>
                  <Button
                    onClick={() => window.open(selectedArticle.url, "_blank")}
                    size="sm"
                    variant="outline"
                  >
                    <ExternalLinkIcon className="h-4 w-4 mr-2" />
                    Link
                  </Button>
                </div>
              </div>
            </div>

            {/* Content & Summary */}
            <div className="flex-1 flex overflow-hidden">
              {/* Article Content */}
              <div className="flex-1 p-4 overflow-y-auto">
                <MarkdownPreview value={selectedArticle.content} className="mb-4" />
              </div>

              {/* AI Summary Panel */}
              <div className="w-80 border-l bg-muted/30 flex flex-col p-4 space-y-3">
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <SparklesIcon className="h-4 w-4" />
                    AI Summary
                  </h3>
                  <Button
                    onClick={handleAISummary}
                    disabled={isLoadingSummary}
                    size="sm"
                    className="w-full"
                  >
                    {isLoadingSummary ? (
                      <>
                        <LoaderIcon className="h-3 w-3 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="h-3 w-3 mr-2" />
                        Generate Summary
                      </>
                    )}
                  </Button>
                </div>

                {summary && (
                  <div className="flex-1 border rounded-lg p-3 bg-background/50 overflow-y-auto text-sm leading-relaxed">
                    <p>{summary}</p>
                  </div>
                )}

                {!summary && !isLoadingSummary && (
                  <div className="flex-1 border rounded-lg p-3 bg-background/50 flex items-center justify-center text-xs text-muted-foreground text-center">
                    Click "Generate Summary" to get an AI-powered summary
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          // Empty State
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <ExternalLinkIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold">No article selected</p>
              <p className="text-sm text-muted-foreground mt-1">
                Select an article from the categories to read more
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
