export interface GenerateSpec {
  subject: string
  topic: string
  count: number
  totalPoints: number
  difficulty: 'easy' | 'medium' | 'hard'
  types: string[]
  extra?: string
}

export interface Option {
  key: string
  text: string
}

export interface Question {
  id: string
  type: 'single' | 'multiple' | 'fill' | 'short'
  knowledgePoint: string
  difficulty: string
  stem: string
  options: Option[]
  answer: string | string[]
  explanation: string
  points: number
}

export interface TraceEvent {
  id: string
  at: number
  stage: string
  status: 'running' | 'passed' | 'warn' | 'failed'
  title: string
  detail?: string
  round?: number
  durationMs?: number
  issues?: Array<Record<string, unknown>>
  tokens?: { totalTokens?: number }
}

export interface Review {
  passed: boolean
  issues: Array<Record<string, unknown>>
  summary: string
  rounds: number
}

export interface Paper {
  id: string
  title: string
  subject: string
  knowledgePoints: string[]
  difficulty: string
  durationMin: number
  questions: Question[]
  totalPoints: number
  createdAt: string
  spec: GenerateSpec
  review: Review
  pipelineTrace: TraceEvent[]
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  rounds: number
  elapsedMs: number
}

export interface PaperSummary {
  id: string
  title: string
  subject: string
  knowledgePoints: string[]
  difficulty: string
  createdAt: string
  questionCount: number
  totalPoints: number
  reviewPassed: boolean
  rounds: number
}

export interface GradeResult {
  questionId: string
  score: number
  maxScore: number
  verdict: string
  feedback: string
  autoGraded: boolean
}

export interface KnowledgeStat {
  knowledgePoint: string
  got: number
  total: number
  accuracy: number
}

export interface Attempt {
  id: string
  paperId: string
  paperTitle: string
  subject: string
  createdAt: string
  score: number
  totalPoints: number
  accuracy: number
  results: GradeResult[]
  knowledgeStats: KnowledgeStat[]
  diagnosis: string
  answers: Array<{ questionId: string; answer: unknown }>
  durationSec: number
}

export interface Overview {
  paperCount: number
  attemptCount: number
  averageAccuracy: number
  knowledge: KnowledgeStat[]
}

export interface Health {
  ok: boolean
  hasApiKey: boolean
  model: string
  baseUrl: string
  types: Record<string, string>
  difficulties: Record<string, string>
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const text = await response.text()
  let payload: any = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }
  if (!response.ok) {
    throw new Error(payload?.error ?? `请求失败（${response.status}）`)
  }
  return payload as T
}

export const getHealth = () => request<Health>('/api/health')

export const listPapers = () => request<{ papers: PaperSummary[] }>('/api/papers')

export const getPaper = (id: string) => request<{ paper: Paper }>(`/api/papers/${id}`)

export const deletePaper = (id: string) =>
  request<{ removed: boolean }>(`/api/papers/${id}`, { method: 'DELETE' })

export const getOverview = () => request<Overview>('/api/overview')

export const getAttempt = (id: string) => request<{ attempt: Attempt }>(`/api/attempts/${id}`)

export interface AttemptSummary {
  id: string
  paperId: string
  paperTitle: string
  subject: string
  score: number
  totalPoints: number
  accuracy: number
  createdAt: string
  durationSec: number
}

export const listAttempts = () => request<{ attempts: AttemptSummary[] }>('/api/attempts')

export const submitAttempt = (payload: {
  paperId: string
  answers: Array<{ questionId: string; answer: unknown }>
  durationSec: number
}) =>
  request<{ attempt: Attempt }>('/api/attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

/**
 * 以流式方式调用生成接口，实时把流水线每一步推给 UI。
 * 使用 fetch + ReadableStream 手工解析 SSE（EventSource 不支持 POST）。
 */
export async function streamGenerate(
  spec: GenerateSpec,
  handlers: {
    onTrace?: (event: TraceEvent) => void
    onSpec?: (spec: GenerateSpec) => void
    onPaper?: (paper: Paper) => void
  },
): Promise<Paper> {
  const response = await fetch('/api/papers/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(spec),
  })

  if (!response.ok) {
    const text = await response.text()
    let message = `生成失败（${response.status}）`
    try {
      message = JSON.parse(text)?.error ?? message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  if (!response.body) throw new Error('当前浏览器不支持流式响应')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let paper: Paper | null = null

  const dispatch = (chunk: string) => {
    let event = 'message'
    let data = ''
    for (const line of chunk.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (!data) return
    let parsed: any
    try {
      parsed = JSON.parse(data)
    } catch {
      return
    }
    if (event === 'trace') handlers.onTrace?.(parsed as TraceEvent)
    else if (event === 'spec') handlers.onSpec?.(parsed as GenerateSpec)
    else if (event === 'paper') {
      paper = parsed as Paper
      handlers.onPaper?.(paper)
    } else if (event === 'error') {
      throw new Error(parsed?.message ?? '服务端返回错误')
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let index = buffer.indexOf('\n\n')
    while (index >= 0) {
      const chunk = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)
      dispatch(chunk)
      index = buffer.indexOf('\n\n')
    }
  }

  if (!paper) throw new Error('生成流程结束但没有拿到试卷，请重试')
  return paper
}
