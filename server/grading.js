import { completeJson } from './llm.js'
import { buildDiagnosisMessages, buildGradeMessages } from './prompts.js'

/**
 * 分层批改器：
 *  - 客观题（单选/多选/填空）用确定性代码判分 —— 零成本、零误差。
 *  - 主观题（简答）才调用 LLM，且要求它输出结构化评分依据。
 * 这同样是「验证比生成便宜」原则：能算清楚的地方绝不让模型猜。
 */

export function normalizeAnswerText(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[，。；、]/g, (matched) => ({ '，': ',', '。': '.', '；': ';', '、': ',' }[matched]))
}

function normalizeFillCandidates(reference) {
  return String(reference ?? '')
    .split('|')
    .map((item) => normalizeAnswerText(item))
    .filter(Boolean)
}

function gradeObjective(paper, answerMap) {
  const results = []

  for (const question of paper.questions) {
    if (question.type === 'short') continue
    const studentAnswer = answerMap.get(question.id) ?? ''
    const maxScore = question.points
    let score = 0
    let verdict = '错误'
    let feedback = ''

    if (question.type === 'single') {
      const picked = String(studentAnswer).trim().toUpperCase()
      score = picked && picked === String(question.answer).toUpperCase() ? maxScore : 0
      if (score > 0) verdict = '正确'
      else {
        feedback = `你选了 ${picked || '（未作答）'}，正确答案是 ${question.answer}。`
      }
    } else if (question.type === 'multiple') {
      const picked = new Set(
        (Array.isArray(studentAnswer) ? studentAnswer : String(studentAnswer).split(/[,，\s]+/))
          .map((item) => String(item).trim().toUpperCase())
          .filter(Boolean),
      )
      const correct = new Set((question.answer ?? []).map((item) => String(item).toUpperCase()))
      const allRight = [...correct].every((key) => picked.has(key))
      const noWrong = [...picked].every((key) => correct.has(key))
      if (allRight && noWrong) {
        score = maxScore
        verdict = '正确'
      } else if (picked.size > 0 && [...picked].every((key) => correct.has(key))) {
        score = Math.round(maxScore * 0.5 * 2) / 2
        verdict = '部分正确'
        feedback = `漏选了正确选项，正确答案是 ${[...correct].join('')}。`
      } else {
        feedback = `正确答案是 ${[...correct].join('')}，你选了 ${[...picked].join('') || '（未作答）'}。`
      }
    } else if (question.type === 'fill') {
      const candidates = normalizeFillCandidates(question.answer)
      const submitted = normalizeAnswerText(studentAnswer)
      if (submitted && candidates.includes(submitted)) {
        score = maxScore
        verdict = '正确'
      } else {
        feedback = `参考答案：${question.answer}`
      }
    }

    results.push({
      questionId: question.id,
      score,
      maxScore,
      verdict,
      feedback: feedback || question.explanation || '',
      autoGraded: true,
    })
  }

  return results
}

async function gradeSubjective(paper, answerMap, { signal } = {}) {
  const subjective = paper.questions.filter((question) => question.type === 'short')
  if (subjective.length === 0) return []

  const payload = subjective.map((question) => ({
    questionId: question.id,
    answer: answerMap.get(question.id) ?? '',
  }))

  try {
    const { data } = await completeJson({
      messages: buildGradeMessages(paper, payload),
      temperature: 0.1,
      maxTokens: 2500,
      signal,
      label: 'grade',
    })
    const results = Array.isArray(data?.results) ? data.results : []
    return subjective.map((question) => {
      const hit = results.find((item) => item.questionId === question.id)
      const rawScore = Number(hit?.score ?? 0)
      const score = Number.isFinite(rawScore)
        ? Math.max(0, Math.min(question.points, Math.round(rawScore * 2) / 2))
        : 0
      return {
        questionId: question.id,
        score,
        maxScore: question.points,
        verdict: String(hit?.verdict ?? (score === question.points ? '正确' : score > 0 ? '部分正确' : '错误')),
        feedback: String(hit?.feedback ?? question.explanation ?? ''),
        autoGraded: true,
      }
    })
  } catch (error) {
    // 批改失败时降级：给出 0 分并把原因告知用户，而不是让整个请求崩掉
    return subjective.map((question) => ({
      questionId: question.id,
      score: 0,
      maxScore: question.points,
      verdict: '待复核',
      feedback: `自动批改暂时不可用（${error.message}），本题请人工复核。`,
      autoGraded: false,
    }))
  }
}

function buildKnowledgeStats(paper, results) {
  const map = new Map()
  for (const question of paper.questions) {
    const result = results.find((item) => item.questionId === question.id)
    const key = question.knowledgePoint || '未分类'
    const current = map.get(key) ?? { got: 0, total: 0 }
    current.got += result?.score ?? 0
    current.total += question.points
    map.set(key, current)
  }
  return [...map.entries()].map(([knowledgePoint, value]) => ({
    knowledgePoint,
    got: Math.round(value.got * 2) / 2,
    total: value.total,
    accuracy: value.total ? Number(((value.got / value.total) * 100).toFixed(1)) : 0,
  }))
}

async function buildDiagnosis(paper, results, knowledgeStats, { signal } = {}) {
  const brief = paper.questions.map((question) => {
    const result = results.find((item) => item.questionId === question.id)
    return {
      questionId: question.id,
      knowledgePoint: question.knowledgePoint,
      type: question.type,
      score: result?.score ?? 0,
      maxScore: question.points,
      verdict: result?.verdict ?? '',
    }
  })

  try {
    const { data } = await completeJson({
      messages: buildDiagnosisMessages({ brief, knowledgeStats }),
      temperature: 0.4,
      maxTokens: 600,
      signal,
      label: 'diagnosis',
    })
    return String(data?.diagnosis ?? '').trim()
  } catch {
    const weakest = [...knowledgeStats].sort((a, b) => a.accuracy - b.accuracy)[0]
    return weakest
      ? `本次最薄弱的知识点是「${weakest.knowledgePoint}」（正确率 ${weakest.accuracy}%），建议先回看该知识点的定义与典型例题，再做 3 道同类题巩固。`
      : '暂无足够数据生成诊断。'
  }
}

/**
 * @returns {Promise<object>} 完整作答记录
 */
export async function gradePaper(paper, answers, { signal, durationSec = 0 } = {}) {
  const answerMap = new Map(
    (answers ?? []).map((item) => [String(item.questionId), item.answer ?? '']),
  )

  const objectiveResults = gradeObjective(paper, answerMap)
  const subjectiveResults = await gradeSubjective(paper, answerMap, { signal })
  const results = [...objectiveResults, ...subjectiveResults].sort((a, b) => {
    const indexA = paper.questions.findIndex((question) => question.id === a.questionId)
    const indexB = paper.questions.findIndex((question) => question.id === b.questionId)
    return indexA - indexB
  })

  const score = Number(results.reduce((sum, item) => sum + item.score, 0).toFixed(1))
  const totalPoints = paper.questions.reduce((sum, question) => sum + question.points, 0)
  const knowledgeStats = buildKnowledgeStats(paper, results)
  const diagnosis = await buildDiagnosis(paper, results, knowledgeStats, { signal })

  return {
    score,
    totalPoints,
    accuracy: totalPoints ? Number(((score / totalPoints) * 100).toFixed(1)) : 0,
    results,
    knowledgeStats,
    diagnosis,
    durationSec,
  }
}
