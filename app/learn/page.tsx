"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const LANGUAGES = [
  { value: "vietnamese", label: "🇻🇳 Vietnamese" },
  { value: "english", label: "🇬🇧 English" },
  { value: "spanish", label: "🇪🇸 Spanish" },
  { value: "french", label: "🇫🇷 French" },
  { value: "japanese", label: "🇯🇵 Japanese" },
] as const

const GRAMMAR_TOPICS = [
  { value: "present-simple", label: "Present Simple Tense" },
  { value: "past-simple", label: "Past Simple Tense" },
  { value: "future-simple", label: "Future Simple Tense" },
  { value: "present-continuous", label: "Present Continuous" },
  { value: "comparatives", label: "Comparatives & Superlatives" },
  { value: "conditionals", label: "If Clauses & Conditionals" },
  { value: "passive-voice", label: "Passive Voice" },
  { value: "reported-speech", label: "Reported Speech" },
] as const

type QuizScore = {
  date: string
  language: string
  score: number
  total: number
}

type VocabularyItem = {
  word: string
  translation: string
  language: string
  example?: string
}

const MOCK_VOCABULARY: VocabularyItem[] = [
  { word: "serendipity", translation: "sự trùng hợp tuyệt vời", language: "english", example: "It was pure serendipity that we met." },
  { word: "eloquent", translation: "lưu loát, hùng hồn", language: "english", example: "He gave an eloquent speech." },
  { word: "ephemeral", translation: "thoáng qua, bốn bề", language: "english", example: "Beauty is ephemeral." },
  { word: "ubiquitous", translation: "có mặt ở khắp nơi", language: "english", example: "Smartphones are ubiquitous nowadays." },
  { word: "pragmatic", translation: "thực dụng", language: "english", example: "A pragmatic approach works best." },
  { word: "perspicacious", translation: "sáng suốt, bắt được chủ ý", language: "english", example: "A perspicacious observer noticed the details." },
  { word: "obfuscate", translation: "làm mờ, che phủ", language: "english", example: "Don't obfuscate the truth." },
  { word: "mercurial", translation: "nhanh chóng thay đổi, thất thường", language: "english", example: "Her mood is mercurial." },
  { word: "mellifluous", translation: "hay hay, âm thanh ngọt ngào", language: "english", example: "His mellifluous voice charmed everyone." },
  { word: "propitious", translation: "may mắn, thuận lợi", language: "english", example: "This is a propitious moment." },
]

export default function LearnPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<(typeof LANGUAGES)[number]["value"]>("english")
  const [mode, setMode] = useState<"vocabulary" | "quiz" | "grammar">("vocabulary")
  const [quizActive, setQuizActive] = useState(false)
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0)
  const [quizScore, setQuizScore] = useState(0)
  const [userAnswers, setUserAnswers] = useState<string[]>([])
  const [hint, setHint] = useState("")
  const [hintLoading, setHintLoading] = useState(false)
  const [grammarTopic, setGrammarTopic] = useState<(typeof GRAMMAR_TOPICS)[number]["value"]>("present-simple")
  const [grammarContent, setGrammarContent] = useState("")
  const [grammarLoading, setGrammarLoading] = useState(false)
  const [wordOfDay, setWordOfDay] = useState<VocabularyItem | null>(null)
  const [scores, setScores] = useState<QuizScore[]>([])
  const [quizFinished, setQuizFinished] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem("tans-agents:quiz-scores-v1")
    if (stored) {
      try {
        setScores(JSON.parse(stored))
      } catch {
        // ignore
      }
    }

    const today = new Date().toDateString()
    const randomIndex = new Date().getDate() % MOCK_VOCABULARY.length
    setWordOfDay(MOCK_VOCABULARY[randomIndex])
  }, [])

  function generateQuiz() {
    setQuizActive(true)
    setQuizFinished(false)
    setCurrentQuizIndex(0)
    setQuizScore(0)
    setUserAnswers([])
    setHint("")
  }

  function selectAnswer(answer: string) {
    if (userAnswers.length < 5) {
      const newAnswers = [...userAnswers, answer]
      setUserAnswers(newAnswers)
      if (newAnswers.length === 5) {
        setQuizFinished(true)
      }
    }
  }

  function submitQuiz() {
    const score = userAnswers.length
    setQuizScore(score)
    const newScore: QuizScore = {
      date: new Date().toISOString(),
      language: selectedLanguage,
      score,
      total: 5,
    }
    const updatedScores = [newScore, ...scores]
    setScores(updatedScores)
    localStorage.setItem("tans-agents:quiz-scores-v1", JSON.stringify(updatedScores))
  }

  async function fetchHint() {
    setHintLoading(true)
    setHint("")
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: PROVIDER,
          model: MODEL,
          enabledTools: [],
          messages: [{ role: "user", content: `Give me a short context clue (1-2 sentences) about English vocabulary word "${MOCK_VOCABULARY[currentQuizIndex]?.word || "word"}" without revealing the answer. Make it suitable for ${selectedLanguage} learners.` }],
          personaSystemPrompt: `You are a helpful language tutor. Provide concise context clues for vocabulary learning.`,
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("No stream from server")

      await readSseStream(response.body, (chunk) => {
        setHint((current) => current + chunk)
      })
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setHint("Error loading hint")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setHintLoading(false)
    }
  }

  async function fetchGrammarLesson() {
    setGrammarLoading(true)
    setGrammarContent("")
    const controller = new AbortController()
    abortRef.current = controller

    const topicLabel = GRAMMAR_TOPICS.find((t) => t.value === grammarTopic)?.label || grammarTopic

    try {
      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: PROVIDER,
          model: MODEL,
          enabledTools: [],
          messages: [{ role: "user", content: `Explain "${topicLabel}" in English grammar. Include:\n1. Definition\n2. 2-3 examples\n3. Common mistakes\nKeep it concise and clear for intermediate learners.` }],
          personaSystemPrompt: `You are an expert English grammar teacher. Explain grammar topics clearly with examples.`,
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("No stream from server")

      await readSseStream(response.body, (chunk) => {
        setGrammarContent((current) => current + chunk)
      })
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setGrammarContent("Error loading lesson")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setGrammarLoading(false)
    }
  }

  const recentScores = useMemo(() => {
    return scores.slice(0, 5).map((s) => ({
      lang: s.language,
      score: s.score,
      date: new Date(s.date).toLocaleDateString(),
    }))
  }, [scores])

  const quizOptions = useMemo(() => {
    if (!quizActive || currentQuizIndex >= 5) return []
    const words = MOCK_VOCABULARY.slice(0, 5)
    const correctWord = words[currentQuizIndex]
    const options = [correctWord]
    const remaining = words.filter((_, i) => i !== currentQuizIndex)
    const shuffled = remaining.sort(() => Math.random() - 0.5).slice(0, 3)
    return [correctWord, ...shuffled].sort(() => Math.random() - 0.5)
  }, [quizActive, currentQuizIndex])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardDescription>Interactive Learning Platform</CardDescription>
                <CardTitle className="mt-1 text-3xl">🎓 Language Learning Hub</CardTitle>
              </div>
              <Select value={selectedLanguage} onValueChange={(value) => setSelectedLanguage(value as typeof selectedLanguage)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>

        {/* Mode Selector */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={mode === "vocabulary" ? "default" : "outline"}
            onClick={() => {
              setMode("vocabulary")
              setQuizActive(false)
            }}
          >
            📖 Vocabulary
          </Button>
          <Button
            variant={mode === "quiz" ? "default" : "outline"}
            onClick={() => setMode("quiz")}
          >
            ✏️ Quiz
          </Button>
          <Button
            variant={mode === "grammar" ? "default" : "outline"}
            onClick={() => setMode("grammar")}
          >
            📝 Grammar
          </Button>
        </div>

        {/* Word of the Day */}
        {wordOfDay && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">📌 Word of the Day</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold">{wordOfDay.word}</span>
                <Badge variant="secondary">{wordOfDay.translation}</Badge>
              </div>
              {wordOfDay.example && (
                <p className="text-sm italic text-muted-foreground">Example: "{wordOfDay.example}"</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Vocabulary Mode */}
        {mode === "vocabulary" && !quizActive && (
          <Card>
            <CardHeader>
              <CardTitle>📚 Vocabulary List</CardTitle>
              <CardDescription>Essential {selectedLanguage} words</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {MOCK_VOCABULARY.slice(0, 10).map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-3 border-b pb-3 last:border-b-0">
                    <div className="flex-1">
                      <p className="font-semibold">{item.word}</p>
                      <p className="text-sm text-muted-foreground">{item.translation}</p>
                      {item.example && <p className="mt-1 text-xs italic">"{item.example}"</p>}
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={generateQuiz} className="mt-6 w-full">
                Start Quiz 📝
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quiz Mode */}
        {mode === "quiz" && (
          <div className="space-y-4">
            {!quizActive && !quizFinished && (
              <Card>
                <CardHeader>
                  <CardTitle>✏️ Vocabulary Quiz</CardTitle>
                  <CardDescription>5 questions, 4 choices each</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentScores.length > 0 && (
                    <div className="space-y-2 rounded-lg bg-muted p-3">
                      <p className="text-sm font-semibold">Recent Scores</p>
                      {recentScores.map((s, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span>{s.date}</span>
                          <span className="font-semibold">{s.score}/5</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button onClick={generateQuiz} className="w-full" size="lg">
                    Start New Quiz
                  </Button>
                </CardContent>
              </Card>
            )}

            {quizActive && currentQuizIndex < 5 && !quizFinished && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardDescription>Question {currentQuizIndex + 1}/5</CardDescription>
                      <CardTitle className="mt-2">What does "{MOCK_VOCABULARY[currentQuizIndex]?.word}" mean?</CardTitle>
                    </div>
                    <Badge variant="outline">{quizScore} points</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {quizOptions.map((option, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        className="w-full justify-start text-left"
                        onClick={() => {
                          if (option.word === MOCK_VOCABULARY[currentQuizIndex]?.word) {
                            setQuizScore(quizScore + 1)
                          }
                          setCurrentQuizIndex(currentQuizIndex + 1)
                        }}
                      >
                        <span>{option.translation}</span>
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={fetchHint}
                    disabled={hintLoading}
                  >
                    {hintLoading ? "💡 Loading..." : "💡 Hint"}
                  </Button>
                  {hint && (
                    <div className="rounded-lg bg-yellow-50 p-3 text-sm text-muted-foreground dark:bg-yellow-950">
                      {hint}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {quizFinished && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-center text-2xl">Quiz Completed! 🎉</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                  <div className="text-5xl font-bold">{quizScore}/5</div>
                  <p className="text-muted-foreground">
                    {quizScore === 5 && "Perfect! Outstanding work! 🌟"}
                    {quizScore === 4 && "Great job! Almost perfect! 👏"}
                    {quizScore === 3 && "Good effort! Keep practicing! 💪"}
                    {quizScore <= 2 && "Keep learning! You'll improve! 📚"}
                  </p>
                  <Button onClick={generateQuiz} className="w-full">
                    Try Another Quiz
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Grammar Mode */}
        {mode === "grammar" && (
          <Card>
            <CardHeader>
              <CardTitle>📝 Grammar Lessons</CardTitle>
              <CardDescription>Learn English grammar topics</CardDescription>
              <div className="mt-4 space-y-2">
                <label htmlFor="topic" className="text-sm font-medium">
                  Select Topic
                </label>
                <Select value={grammarTopic} onValueChange={(value) => setGrammarTopic(value as typeof grammarTopic)}>
                  <SelectTrigger id="topic">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRAMMAR_TOPICS.map((topic) => (
                      <SelectItem key={topic.value} value={topic.value}>
                        {topic.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={fetchGrammarLesson}
                disabled={grammarLoading}
                className="w-full"
              >
                {grammarLoading ? "⏳ Loading..." : "📖 Load Lesson"}
              </Button>
              {grammarContent && (
                <div className="rounded-lg bg-muted p-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {grammarContent}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}

async function readSseStream(body: ReadableStream<Uint8Array>, onContent: (content: string) => void) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""

    for (const event of events) {
      parseSseEvent(event, onContent)
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) parseSseEvent(buffer, onContent)
}

function parseSseEvent(event: string, onContent: (content: string) => void) {
  const dataLines = event
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())

  for (const data of dataLines) {
    if (!data || data === "[DONE]") continue

    const payload = JSON.parse(data)
    if (payload?.error?.message) throw new Error(payload.error.message)

    const content = payload?.choices?.[0]?.delta?.content
    if (typeof content === "string") onContent(content)
  }
}
