export type PromptTemplateCategory = 'writing' | 'coding' | 'learning' | 'business' | 'other'

export interface PromptTemplate {
  id: string
  title: string
  category: PromptTemplateCategory
  body: string
  variables: string[]
  icon?: string
  isBuiltin?: boolean
  createdAt?: number
}

export const PROMPT_TEMPLATE_STORAGE_KEY = 'tans-agents:prompt-templates-v1'

export const PROMPT_TEMPLATE_CATEGORIES: Array<{ value: PromptTemplateCategory | 'all'; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'writing', label: 'Viết lách' },
  { value: 'coding', label: 'Lập trình' },
  { value: 'learning', label: 'Học tập' },
  { value: 'business', label: 'Kinh doanh' },
  { value: 'other', label: 'Khác' },
]

export const PROMPT_TEMPLATE_CATEGORY_LABELS: Record<PromptTemplateCategory, string> = {
  writing: 'Viết lách',
  coding: 'Lập trình',
  learning: 'Học tập',
  business: 'Kinh doanh',
  other: 'Khác',
}

export function extractTemplateVariables(body: string): string[] {
  const seen = new Set<string>()
  const matches = body.matchAll(/\{\{(\w+)\}\}/g)
  for (const match of matches) seen.add(match[1])
  return Array.from(seen)
}

function withVariables(template: Omit<PromptTemplate, 'variables'>): PromptTemplate {
  return { ...template, variables: extractTemplateVariables(template.body) }
}

export const BUILTIN_PROMPT_TEMPLATES: PromptTemplate[] = [
  withVariables({
    id: 'builtin-summary',
    title: 'Tóm tắt văn bản',
    category: 'writing',
    icon: '📝',
    isBuiltin: true,
    body: 'Tóm tắt văn bản sau thành 5 ý chính:\n\n{{text}}',
  }),
  withVariables({
    id: 'builtin-translate',
    title: 'Dịch thuật',
    category: 'writing',
    icon: '🌐',
    isBuiltin: true,
    body: 'Dịch sang {{lang}}:\n\n{{text}}',
  }),
  withVariables({
    id: 'builtin-code-review',
    title: 'Code review',
    category: 'coding',
    icon: '💻',
    isBuiltin: true,
    body: 'Review đoạn code {{language}} sau, tìm bug + đề xuất cải thiện:\n\n```{{language}}\n{{code}}\n```',
  }),
  withVariables({
    id: 'builtin-email',
    title: 'Viết email chuyên nghiệp',
    category: 'business',
    icon: '✉️',
    isBuiltin: true,
    body: 'Viết email tiếng {{lang}} gửi {{recipient}} về chủ đề: {{topic}}. Phong cách: {{tone}}.',
  }),
  withVariables({
    id: 'builtin-brainstorm',
    title: 'Brainstorm ý tưởng',
    category: 'business',
    icon: '💡',
    isBuiltin: true,
    body: 'Brainstorm 10 ý tưởng cho: {{topic}}. Mỗi ý 1-2 câu mô tả.',
  }),
  withVariables({
    id: 'builtin-simple-explain',
    title: 'Giải thích đơn giản',
    category: 'learning',
    icon: '🎒',
    isBuiltin: true,
    body: "Giải thích khái niệm '{{concept}}' như đang nói với học sinh lớp 5.",
  }),
  withVariables({
    id: 'builtin-project-plan',
    title: 'Plan dự án',
    category: 'business',
    icon: '📋',
    isBuiltin: true,
    body: 'Lên kế hoạch chi tiết cho dự án: {{project}}. Bao gồm mục tiêu, milestones, rủi ro.',
  }),
  withVariables({
    id: 'builtin-sql',
    title: 'SQL query',
    category: 'coding',
    icon: '🗄️',
    isBuiltin: true,
    body: 'Viết SQL query (dialect {{dialect}}): {{requirement}}',
  }),
  withVariables({
    id: 'builtin-regex',
    title: 'Regex',
    category: 'coding',
    icon: '🔎',
    isBuiltin: true,
    body: 'Viết regex để: {{requirement}}. Giải thích từng phần.',
  }),
  withVariables({
    id: 'builtin-cover-letter',
    title: 'Cover letter',
    category: 'writing',
    icon: '💼',
    isBuiltin: true,
    body: 'Viết cover letter cho vị trí {{position}} tại {{company}}. Kinh nghiệm: {{exp}}',
  }),
  withVariables({
    id: 'builtin-vocab',
    title: 'Học từ vựng',
    category: 'learning',
    icon: '📚',
    isBuiltin: true,
    body: 'Tạo 10 thẻ học từ vựng tiếng {{lang}} chủ đề {{topic}} (gồm từ, phiên âm, nghĩa, ví dụ).',
  }),
  withVariables({
    id: 'builtin-swot',
    title: 'Phân tích SWOT',
    category: 'business',
    icon: '📊',
    isBuiltin: true,
    body: 'Phân tích SWOT cho: {{subject}}. Mỗi nhóm 3-5 điểm.',
  }),
]

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function normalizeTemplate(template: PromptTemplate): PromptTemplate {
  return {
    ...template,
    isBuiltin: false,
    variables: extractTemplateVariables(template.body),
  }
}

export function getCustomPromptTemplates(): PromptTemplate[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(PROMPT_TEMPLATE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is PromptTemplate => Boolean(item?.id && item?.title && item?.body && item?.category))
      .map(normalizeTemplate)
  } catch {
    return []
  }
}

export function saveCustomPromptTemplates(templates: PromptTemplate[]): boolean {
  if (!canUseStorage()) return false
  try {
    const customTemplates = templates.filter((template) => !template.isBuiltin).map(normalizeTemplate)
    window.localStorage.setItem(PROMPT_TEMPLATE_STORAGE_KEY, JSON.stringify(customTemplates))
    return true
  } catch {
    return false
  }
}

export function createCustomPromptTemplate(input: {
  title: string
  category: PromptTemplateCategory
  body: string
  icon?: string
}): PromptTemplate {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `custom-${Date.now()}`
  return withVariables({
    id,
    title: input.title.trim(),
    category: input.category,
    body: input.body,
    icon: input.icon?.trim() || '✨',
    isBuiltin: false,
    createdAt: Date.now(),
  })
}

export function deleteCustomPromptTemplate(id: string): PromptTemplate[] {
  const next = getCustomPromptTemplates().filter((template) => template.id !== id)
  saveCustomPromptTemplates(next)
  return next
}

export function fillPromptTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (placeholder, variable: string) => {
    const value = values[variable]?.trim()
    return value ? value : placeholder
  })
}
