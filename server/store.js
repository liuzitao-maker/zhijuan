import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from './env.js'

/**
 * 轻量 JSON 持久化。
 * 刻意不引入数据库：为了让「10 分钟极速复现」成立 —— 克隆 + 填 Key + 一条命令即可跑。
 */

const FILES = {
  papers: 'papers.json',
  attempts: 'attempts.json',
}

let ready = false

async function ensureReady() {
  // 目录可能在使用过程中被清理（例如演示前重置数据），因此每次写入前都确保存在。
  if (!ready) {
    await fs.mkdir(config.dataDir, { recursive: true })
    ready = true
  }
}

async function ensureDataDir() {
  await fs.mkdir(config.dataDir, { recursive: true })
  ready = true
}

async function readCollection(name) {
  await ensureReady()
  const file = path.join(config.dataDir, FILES[name])
  try {
    const raw = await fs.readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeCollection(name, value) {
  await ensureDataDir()
  const file = path.join(config.dataDir, FILES[name])
  const temp = `${file}.tmp`
  await fs.writeFile(temp, JSON.stringify(value, null, 2), 'utf8')
  await fs.rename(temp, file)
}

function newId(prefix) {
  const stamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${stamp}${random}`
}

export const store = {
  newId,

  async listPapers() {
    const papers = await readCollection('papers')
    return papers
      .map((paper) => ({
        id: paper.id,
        title: paper.title,
        subject: paper.subject,
        knowledgePoints: paper.knowledgePoints,
        difficulty: paper.difficulty,
        createdAt: paper.createdAt,
        questionCount: paper.questions?.length ?? 0,
        totalPoints: paper.totalPoints ?? 0,
        reviewPassed: paper.review?.passed ?? false,
        rounds: paper.review?.rounds ?? 1,
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  },

  async getPaper(id) {
    const papers = await readCollection('papers')
    return papers.find((paper) => paper.id === id) ?? null
  },

  async savePaper(paper) {
    const papers = await readCollection('papers')
    const index = papers.findIndex((item) => item.id === paper.id)
    if (index >= 0) papers[index] = paper
    else papers.unshift(paper)
    await writeCollection('papers', papers.slice(0, 200))
    return paper
  },

  async deletePaper(id) {
    const papers = await readCollection('papers')
    const next = papers.filter((paper) => paper.id !== id)
    await writeCollection('papers', next)
    return next.length !== papers.length
  },

  async listAttempts() {
    const attempts = await readCollection('attempts')
    return attempts
      .map((attempt) => ({
        id: attempt.id,
        paperId: attempt.paperId,
        paperTitle: attempt.paperTitle,
        subject: attempt.subject,
        score: attempt.score,
        totalPoints: attempt.totalPoints,
        accuracy: attempt.accuracy,
        createdAt: attempt.createdAt,
        durationSec: attempt.durationSec,
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  },

  async getAttempt(id) {
    const attempts = await readCollection('attempts')
    return attempts.find((attempt) => attempt.id === id) ?? null
  },

  async saveAttempt(attempt) {
    const attempts = await readCollection('attempts')
    const index = attempts.findIndex((item) => item.id === attempt.id)
    if (index >= 0) attempts[index] = attempt
    else attempts.unshift(attempt)
    await writeCollection('attempts', attempts.slice(0, 300))
    return attempt
  },

  async overview() {
    const [papers, attempts] = await Promise.all([
      readCollection('papers'),
      readCollection('attempts'),
    ])
    const scored = attempts.filter((attempt) => typeof attempt.accuracy === 'number')
    // attempt.accuracy 已经是 0-100 的百分数，这里直接取均值，不能再乘 100
    const averageAccuracy = scored.length
      ? scored.reduce((sum, attempt) => sum + attempt.accuracy, 0) / scored.length
      : 0

    const knowledgeMap = new Map()
    for (const attempt of attempts) {
      for (const item of attempt.knowledgeStats ?? []) {
        const current = knowledgeMap.get(item.knowledgePoint) ?? { got: 0, total: 0 }
        current.got += item.got
        current.total += item.total
        knowledgeMap.set(item.knowledgePoint, current)
      }
    }

    return {
      paperCount: papers.length,
      attemptCount: attempts.length,
      averageAccuracy: Number(averageAccuracy.toFixed(1)),
      knowledge: [...knowledgeMap.entries()]
        .map(([knowledgePoint, value]) => ({
          knowledgePoint,
          accuracy: value.total ? Number(((value.got / value.total) * 100).toFixed(1)) : 0,
          total: value.total,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 12),
    }
  },
}
