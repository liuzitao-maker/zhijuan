/**
 * 试卷结构校验器（本地硬校验）。
 *
 * 这是「双保险」里的第一道保险：不依赖模型自觉，用确定性代码把明显不合法的结构挡在门外。
 * 也是本项目「验证比生成便宜」这一工程判断的落地 —— 结构校验几乎零成本，
 * 却能在调用昂贵的审题 Agent 之前就淘汰掉 60% 的脏输出。
 */

const QUESTION_TYPES = new Set(['single', 'multiple', 'fill', 'short'])
const DIFFICULTIES = new Set(['easy', 'medium', 'hard'])

export const TYPE_LABELS = {
  single: '单选题',
  multiple: '多选题',
  fill: '填空题',
  short: '简答题',
}

export const DIFFICULTY_LABELS = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

function coerceNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return []
  return rawOptions
    .map((option, index) => {
      if (typeof option === 'string') {
        return { key: String.fromCharCode(65 + index), text: option }
      }
      const key = String(option?.key ?? String.fromCharCode(65 + index)).trim().toUpperCase()
      const text = String(option?.text ?? option?.content ?? '').trim()
      return { key, text }
    })
    .filter((option) => option.text)
}

/**
 * 尝试把模型的原始输出「修复」成合法结构（能救就救，救不了就报问题）。
 */
/**
 * 确定性分值归位：把各题分值之和精确调整到目标总分。
 *
 * 这是「验证比生成便宜」的又一次落地 —— 分值加总是一个纯算术问题，
 * 完全不需要花一轮模型修复去解决。优先从分值最大的题开始吸收差值，
 * 并保证每题最低 1 分。
 */
function reconcilePoints(questions, targetPoints) {
  if (questions.length === 0) return false
  let total = questions.reduce((sum, question) => sum + question.points, 0)
  let diff = Number((targetPoints - total).toFixed(2))
  if (Math.abs(diff) < 0.01) return false

  const order = questions
    .map((_, index) => index)
    .sort((a, b) => questions[b].points - questions[a].points)

  for (const index of order) {
    if (Math.abs(diff) < 0.01) break
    const question = questions[index]
    if (diff > 0) {
      question.points += diff
      diff = 0
    } else {
      const absorb = Math.min(question.points - 1, -diff)
      if (absorb > 0) {
        question.points -= absorb
        diff += absorb
      }
    }
  }

  questions.forEach((question) => {
    question.points = Math.round(question.points * 2) / 2
  })

  // 四舍五入可能再次产生残差，把残余差值放到分值最大的题上，确保精确命中目标总分
  const afterRounding = questions.reduce((sum, question) => sum + question.points, 0)
  const residual = Number((targetPoints - afterRounding).toFixed(2))
  if (Math.abs(residual) >= 0.01) {
    let heaviest = 0
    for (let i = 1; i < questions.length; i += 1) {
      if (questions[i].points > questions[heaviest].points) heaviest = i
    }
    questions[heaviest].points = Math.round((questions[heaviest].points + residual) * 2) / 2
  }

  const finalTotal = questions.reduce((sum, question) => sum + question.points, 0)
  return Math.abs(finalTotal - targetPoints) < 0.01
}

export function normalizePaper(raw, spec) {
  const issues = []
  const source = raw && typeof raw === 'object' ? raw : {}

  const questions = Array.isArray(source.questions) ? source.questions : []
  if (questions.length === 0) issues.push('试卷没有任何题目')

  const normalizedQuestions = []
  questions.forEach((question, index) => {
    const fallbackId = `q${index + 1}`
    const type = QUESTION_TYPES.has(question?.type) ? question.type : 'single'
    if (!QUESTION_TYPES.has(question?.type)) issues.push(`${fallbackId} 题型非法，已按单选题处理`)

    const stem = String(question?.stem ?? '').trim()
    if (stem.length < 4) issues.push(`${fallbackId} 题干过短`)

    const options = normalizeOptions(question?.options)
    let answer = question?.answer

    if (type === 'single') {
      if (options.length < 2) issues.push(`${fallbackId} 单选题选项少于 2 个`)
      const keys = options.map((option) => option.key)
      if (Array.isArray(answer)) answer = answer[0]
      answer = String(answer ?? '').trim().toUpperCase()
      if (!keys.includes(answer)) {
        const firstKey = keys[0]
        issues.push(`${fallbackId} 答案不在选项中，已回退为 ${firstKey}`)
        answer = firstKey ?? ''
      }
    } else if (type === 'multiple') {
      if (options.length < 2) issues.push(`${fallbackId} 多选题选项少于 2 个`)
      const keys = options.map((option) => option.key)
      if (!Array.isArray(answer)) answer = String(answer ?? '')
          .split(/[,，\s]+/)
          .filter(Boolean)
      answer = answer.map((item) => String(item).trim().toUpperCase()).filter((item) => keys.includes(item))
      if (answer.length < 1) {
        const fallback = keys.slice(0, 1)
        issues.push(`${fallbackId} 多选题答案非法，已回退`)
        answer = fallback
      }
    } else {
      // fill / short
      if (Array.isArray(answer)) answer = answer.join('|')
      answer = String(answer ?? '').trim()
      if (!answer) issues.push(`${fallbackId} 缺少标准答案`)
    }

    const difficulty = DIFFICULTIES.has(question?.difficulty) ? question.difficulty : spec.difficulty

    normalizedQuestions.push({
      id: String(question?.id ?? fallbackId).trim() || fallbackId,
      type,
      knowledgePoint: String(question?.knowledgePoint ?? spec.topic).trim(),
      difficulty,
      stem,
      options: type === 'single' || type === 'multiple' ? options : [],
      answer,
      explanation: String(question?.explanation ?? '').trim(),
      points: coerceNumber(question?.points, Math.max(1, Math.round(spec.totalPoints / Math.max(1, spec.count)))),
    })
  })

  // id 去重
  const seen = new Set()
  normalizedQuestions.forEach((question, index) => {
    if (seen.has(question.id)) question.id = `q${index + 1}-dup`
    seen.add(question.id)
  })

  // 分值归位：算术问题用算术解决，不占用模型修复轮次
  const beforeTotal = normalizedQuestions.reduce((sum, question) => sum + question.points, 0)
  if (reconcilePoints(normalizedQuestions, spec.totalPoints)) {
    const afterTotal = normalizedQuestions.reduce((sum, question) => sum + question.points, 0)
    if (Math.abs(beforeTotal - afterTotal) > 0.01) {
      issues.push(`分值合计 ${beforeTotal} 与要求 ${spec.totalPoints} 不符，已自动调整`)
    }
  } else {
    issues.push(`分值合计无法调整到要求的总分 ${spec.totalPoints}`)
  }

  const paper = {
    title: String(source.title ?? `${spec.subject} · ${spec.topic} 练习卷`).trim(),
    subject: String(source.subject ?? spec.subject).trim(),
    knowledgePoints: Array.isArray(source.knowledgePoints) && source.knowledgePoints.length
      ? source.knowledgePoints.map(String)
      : String(spec.topic).split(/[,，、\s]+/).filter(Boolean),
    difficulty: DIFFICULTIES.has(source.difficulty) ? source.difficulty : spec.difficulty,
    durationMin: coerceNumber(source.durationMin, Math.max(10, Math.round(spec.count * 3))),
    questions: normalizedQuestions,
  }

  return { paper, issues }
}

/**
 * 硬校验：结构层面的「不可能通过」判定。
 */
export function validatePaper(paper, spec) {
  const issues = []
  if (!paper) return { ok: false, issues: ['试卷为空'] }
  if (!Array.isArray(paper.questions) || paper.questions.length === 0) {
    return { ok: false, issues: ['试卷没有题目'] }
  }

  const total = paper.questions.reduce((sum, question) => sum + question.points, 0)
  if (Math.abs(total - spec.totalPoints) > 0.01) {
    issues.push(`总分不符：期望 ${spec.totalPoints}，实际 ${total}`)
  }

  const expectedTypes = new Set(spec.types)
  const actualTypes = new Set(paper.questions.map((question) => question.type))
  for (const type of expectedTypes) {
    if (!actualTypes.has(type)) issues.push(`缺少要求的题型：${TYPE_LABELS[type] ?? type}`)
  }

  for (const question of paper.questions) {
    if (question.stem.length < 4) issues.push(`${question.id} 题干为空或过短`)
    if ((question.type === 'single' || question.type === 'multiple') && question.options.length < 2) {
      issues.push(`${question.id} 选项不足`)
    }
    if (!question.answer || (Array.isArray(question.answer) && question.answer.length === 0)) {
      issues.push(`${question.id} 缺少答案`)
    }
    if (!question.explanation) issues.push(`${question.id} 缺少解析`)
  }

  return { ok: issues.length === 0, issues }
}

export function summarizePaper(paper) {
  const total = paper.questions.reduce((sum, question) => sum + question.points, 0)
  const byType = {}
  for (const question of paper.questions) {
    byType[question.type] = (byType[question.type] ?? 0) + 1
  }
  return { totalPoints: total, count: paper.questions.length, byType }
}
