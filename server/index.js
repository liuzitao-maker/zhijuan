import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { config, hasApiKey, ROOT } from './env.js'
import { gradePaper } from './grading.js'
import { runGenerationPipeline } from './pipeline.js'
import { store } from './store.js'
import { TYPE_LABELS, DIFFICULTY_LABELS } from './paper-schema.js'

const app = express()
app.use(express.json({ limit: '2mb' }))

const VALID_TYPES = Object.keys(TYPE_LABELS)
const VALID_DIFFICULTIES = Object.keys(DIFFICULTY_LABELS)

function normalizeSpec(body) {
  const subject = String(body?.subject ?? '').trim() || '通用'
  const topic = String(body?.topic ?? '').trim()
  if (!topic) throw new Error('请填写核心知识点')

  const count = Math.min(20, Math.max(3, Number(body?.count) || 8))
  const totalPoints = Math.min(200, Math.max(10, Number(body?.totalPoints) || count * 10))
  const difficulty = VALID_DIFFICULTIES.includes(body?.difficulty) ? body.difficulty : 'medium'
  const rawTypes = Array.isArray(body?.types) ? body.types : []
  const types = rawTypes.filter((type) => VALID_TYPES.includes(type))
  const extra = String(body?.extra ?? '').trim()

  return {
    subject,
    topic,
    count,
    totalPoints,
    difficulty,
    types: types.length ? types : ['single', 'fill', 'short'],
    extra,
  }
}

function sseHandler(handler) {
  return async (req, res) => {
    if (!hasApiKey()) {
      res.status(400).json({
        error: '尚未配置 API Key。请复制 .env.example 为 server/.env 并填入 DEEPSEEK_API_KEY。',
        code: 'no_api_key',
      })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    const controller = new AbortController()
    req.on('close', () => controller.abort())

    const send = (event, data) => {
      if (res.writableEnded) return
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': ping\n\n')
    }, 15_000)

    try {
      await handler(req, res, send, controller.signal)
    } catch (error) {
      console.error('[sse] handler error:', error)
      send('error', { message: error?.message ?? '服务端未知错误' })
    } finally {
      clearInterval(heartbeat)
      if (!res.writableEnded) res.end()
    }
  }
}

// ── 基础信息 ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    hasApiKey: hasApiKey(),
    model: config.model,
    baseUrl: config.baseUrl,
    types: TYPE_LABELS,
    difficulties: DIFFICULTY_LABELS,
  })
})

// ── 生成试卷（SSE 流式返回流水线每一步）──────────────────────────────
app.post(
  '/api/papers/generate',
  sseHandler(async (req, res, send, signal) => {
    const startedAt = Date.now()
    const spec = normalizeSpec(req.body)

    send('spec', spec)

    const { paper, review, trace, usage, rounds } = await runGenerationPipeline(spec, {
      emit: (event) => send('trace', event),
      signal,
    })

    const totalPoints = paper.questions.reduce((sum, question) => sum + question.points, 0)
    const saved = {
      ...paper,
      id: store.newId('paper'),
      createdAt: new Date().toISOString(),
      totalPoints,
      spec,
      review,
      pipelineTrace: trace,
      usage,
      rounds,
      elapsedMs: Date.now() - startedAt,
    }

    await store.savePaper(saved)
    send('paper', saved)
    send('done', { paperId: saved.id, totalPoints, elapsedMs: saved.elapsedMs })
  }),
)

// ── 试卷库 ──────────────────────────────────────────────────────────
app.get('/api/papers', async (req, res) => {
  res.json({ papers: await store.listPapers() })
})

app.get('/api/papers/:id', async (req, res) => {
  const paper = await store.getPaper(req.params.id)
  if (!paper) return res.status(404).json({ error: '试卷不存在' })
  res.json({ paper })
})

app.delete('/api/papers/:id', async (req, res) => {
  const removed = await store.deletePaper(req.params.id)
  res.json({ removed })
})

// ── 提交作答并批改 ──────────────────────────────────────────────────
app.post('/api/attempts', async (req, res) => {
  if (!hasApiKey()) {
    return res.status(400).json({
      error: '尚未配置 API Key。请复制 .env.example 为 server/.env 并填入 DEEPSEEK_API_KEY。',
      code: 'no_api_key',
    })
  }

  const { paperId, answers, durationSec } = req.body ?? {}
  const paper = await store.getPaper(String(paperId ?? ''))
  if (!paper) return res.status(404).json({ error: '试卷不存在' })

  try {
    const graded = await gradePaper(paper, answers, { durationSec: Number(durationSec) || 0 })
    const attempt = {
      id: store.newId('attempt'),
      paperId: paper.id,
      paperTitle: paper.title,
      subject: paper.subject,
      createdAt: new Date().toISOString(),
      answers: (answers ?? []).map((item) => ({
        questionId: item.questionId,
        answer: item.answer ?? '',
      })),
      ...graded,
    }
    await store.saveAttempt(attempt)
    res.json({ attempt })
  } catch (error) {
    console.error('[attempts] grading failed:', error)
    res.status(500).json({ error: error?.message ?? '批改失败' })
  }
})

app.get('/api/attempts', async (req, res) => {
  res.json({ attempts: await store.listAttempts() })
})

app.get('/api/attempts/:id', async (req, res) => {
  const attempt = await store.getAttempt(req.params.id)
  if (!attempt) return res.status(404).json({ error: '作答记录不存在' })
  res.json({ attempt })
})

// ── 学情总览 ────────────────────────────────────────────────────────
app.get('/api/overview', async (req, res) => {
  res.json(await store.overview())
})

// ── 生产模式：托管前端构建产物 ──────────────────────────────────────
if (fs.existsSync(config.distDir)) {
  app.use(express.static(config.distDir))
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(config.distDir, 'index.html'))
  })
}

// ── 启动 ────────────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  const keyState = hasApiKey() ? '已配置' : '未配置（请填写 server/.env）'
  console.log('')
  console.log('  智卷 · AI 智能出卷与批改引擎')
  console.log(`  API   : http://127.0.0.1:${config.port}`)
  console.log(`  模型  : ${config.model} (${config.baseUrl})`)
  console.log(`  Key   : ${keyState}`)
  console.log(`  根目录: ${ROOT}`)
  console.log('')
})

process.on('SIGINT', () => {
  server.close(() => process.exit(0))
})
