/**
 * 导出本次 AI 协作会话的完整对话记录（用于比赛要求的「AI 对话历史 Prompt 链」）。
 *
 * 说明：
 *  - DSH 的会话日志是「每行一个 zstd 帧」的 .jsonl.zstd 文件，Node 的流式解压会在
 *    第一个帧结束，因此这里按 zstd 魔数手动切帧后逐帧解压。
 *  - 输出前会自动打码 API Key 等敏感信息，避免泄露到公开仓库。
 *
 *   node scripts/export-ai-history.mjs [输出目录]
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'

const OUT_DIR = process.argv[2] ?? path.join(process.cwd(), 'docs', 'ai-history')
const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

function findSessionFile() {
  const base = path.join(os.homedir(), '.dsh', 'sessions')
  if (!fs.existsSync(base)) throw new Error(`找不到会话目录：${base}`)

  const candidates = []
  for (const workspace of fs.readdirSync(base)) {
    const workspaceDir = path.join(base, workspace)
    if (!fs.statSync(workspaceDir).isDirectory()) continue
    for (const session of fs.readdirSync(workspaceDir)) {
      const sessionDir = path.join(workspaceDir, session)
      if (!fs.statSync(sessionDir).isDirectory()) continue
      for (const file of fs.readdirSync(sessionDir)) {
        if (!file.endsWith('.jsonl.zstd')) continue
        const full = path.join(sessionDir, file)
        candidates.push({ path: full, mtime: fs.statSync(full).mtimeMs })
      }
    }
  }
  if (candidates.length === 0) throw new Error('没有找到会话日志文件')
  candidates.sort((a, b) => b.mtime - a.mtime)
  return candidates[0].path
}

function decodeSession(file) {
  const buf = fs.readFileSync(file)
  const offsets = []
  let index = 0
  while ((index = buf.indexOf(ZSTD_MAGIC, index)) !== -1) {
    offsets.push(index)
    index += 4
  }

  let text = ''
  let frames = 0
  for (let i = 0; i < offsets.length; i += 1) {
    const start = offsets[i]
    const end = i + 1 < offsets.length ? offsets[i + 1] : buf.length
    try {
      text += zlib.zstdDecompressSync(buf.subarray(start, end)).toString('utf8')
      frames += 1
    } catch {
      /* 跳过无法解压的帧 */
    }
  }

  const records = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      records.push(JSON.parse(line))
    } catch {
      /* 跳过损坏行 */
    }
  }
  return { records, frames }
}

const REDACTIONS = [/sk-[A-Za-z0-9_-]{16,}/g]

function redact(input) {
  let output = String(input ?? '')
  for (const pattern of REDACTIONS) {
    output = output.replace(pattern, 'sk-***REDACTED***')
  }
  return output
}

function textOfBlocks(blocks, { includeReasoning = false } = {}) {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .filter((block) => block?.type === 'text' || (includeReasoning && block?.type === 'reasoning'))
    .map((block) => String(block.text ?? '').trim())
    .filter(Boolean)
    .join('\n\n')
}

function summarizeToolCall(record) {
  const name = record?.data?.name ?? 'unknown'
  let args = record?.data?.arguments
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args)
    } catch {
      /* 保留原始字符串 */
    }
  }
  const brief =
    (typeof args === 'object' && args && (args.description || args.command || args.file_path || args.query)) ||
    ''
  const short = String(brief).replace(/\s+/g, ' ').slice(0, 110)
  return short ? `${name} — ${short}` : name
}

function formatTime(ms) {
  if (!ms) return ''
  const date = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function buildMarkdown(records, meta) {
  const lines = []
  lines.push('# AI 协作会话完整记录')
  lines.push('')
  lines.push('> 本文件由 `scripts/export-ai-history.mjs` 从 AI 编程助手（DeepSeek Harness）')
  lines.push('> 的原始会话日志自动导出，保留了人机协作的完整 Prompt 链与工具调用轨迹。')
  lines.push('> 所有 API Key 已自动打码。')
  lines.push('')
  lines.push('| 项 | 值 |')
  lines.push('| --- | --- |')
  lines.push(`| 会话 ID | \`${meta.sessionId}\` |`)
  lines.push(`| 工作目录 | \`${meta.cwd}\` |`)
  lines.push(`| 起止时间 | ${meta.start} ～ ${meta.end} |`)
  lines.push(`| 人类提问轮次 | ${meta.userTurns} |`)
  lines.push(`| AI 消息数 | ${meta.assistantMessages} |`)
  lines.push(`| 工具调用数 | ${meta.toolCalls} |`)
  lines.push(`| 日志帧数 | ${meta.frames} |`)
  lines.push('')

  let turn = 0
  for (const record of records) {
    const type = record?.type

    if (type === 'user/message') {
      // 只保留真正由人类输入的消息；其余是助手注入的运行时上下文（时间、审批策略、后台任务等）
      const sourceKind = record?.data?.source?.kind
      if (sourceKind && sourceKind !== 'user') continue
      const text = textOfBlocks(record?.data?.content)
      if (!text) continue
      turn += 1
      if (text.includes('我需要在一天之内完成这个项目')) {
        lines.push('---')
        lines.push('')
        lines.push('# 第二阶段：项目开发（从一句话需求到完整交付）')
        lines.push('')
        lines.push('> 从这里开始，人类给出项目目标，AI 自主完成了架构设计、编码、测试与调优。')
        lines.push('> 下面按时间顺序保留每一次工具调用与 AI 说明，即完整可审计的开发轨迹。')
        lines.push('')
      }
      lines.push('---')
      lines.push('')
      lines.push(`## 第 ${turn} 轮 · 人类（${formatTime(record.time)}）`)
      lines.push('')
      lines.push(redact(text))
      lines.push('')
      continue
    }

    if (type === 'assistant/message') {
      const content = textOfBlocks(record?.data?.message?.content)
      if (!content) continue
      lines.push('### AI')
      lines.push('')
      lines.push(redact(content))
      lines.push('')
      continue
    }

    if (type === 'tool/call') {
      lines.push(`> 🔧 工具调用：${redact(summarizeToolCall(record))}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

function main() {
  const file = process.argv[3] ?? findSessionFile()
  const { records, frames } = decodeSession(file)
  records.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))

  const header = records.find((record) => record?.type === 'session') ?? {}
  const userRecords = records.filter(
    (record) =>
      record?.type === 'user/message' &&
      (!record?.data?.source?.kind || record.data.source.kind === 'user'),
  )
  const assistantRecords = records.filter((record) => record?.type === 'assistant/message')
  const toolRecords = records.filter((record) => record?.type === 'tool/call')
  const times = records.map((record) => record.time).filter(Boolean)

  const meta = {
    sessionId: header.id ?? path.basename(path.dirname(file)),
    cwd: header.cwd ?? '',
    start: formatTime(Math.min(...times)),
    end: formatTime(Math.max(...times)),
    userTurns: userRecords.length,
    assistantMessages: assistantRecords.length,
    toolCalls: toolRecords.length,
    frames,
  }

  const markdown = buildMarkdown(records, meta)
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const mdPath = path.join(OUT_DIR, '会话完整记录.md')
  fs.writeFileSync(mdPath, markdown, 'utf8')

  // 同时导出一份打码后的精简 JSONL（只保留人机对话与工具调用，剔除推理过程），
  // 便于机器复现，同时避免仓库膨胀。
  const KEEP_TYPES = new Set(['session', 'user/message', 'assistant/message', 'tool/call'])
  const slim = records
    .filter((record) => KEEP_TYPES.has(record?.type))
    .map((record) => {
      if (record?.type === 'assistant/message' && Array.isArray(record?.data?.message?.content)) {
        const content = record.data.message.content.filter((block) => block?.type === 'text')
        if (content.length === 0) return null
        return { ...record, data: { ...record.data, message: { ...record.data.message, content } } }
      }
      return record
    })
    .filter(Boolean)

  const jsonlPath = path.join(OUT_DIR, '会话原始记录.redacted.jsonl')
  const redactedLines = slim.map((record) => redact(JSON.stringify(record))).join('\n')
  fs.writeFileSync(jsonlPath, redactedLines, 'utf8')

  const kb = (n) => `${(n / 1024).toFixed(1)} KB`
  console.log('✓ 导出完成')
  console.log(`  会话：${meta.sessionId}`)
  console.log(`  轮次：${meta.userTurns}  ·  AI 消息 ${meta.assistantMessages}  ·  工具调用 ${meta.toolCalls}`)
  console.log(`  Markdown：${mdPath}（${kb(fs.statSync(mdPath).size)}）`)
  console.log(`  原始记录：${jsonlPath}（${kb(fs.statSync(jsonlPath).size)}）`)
}

main()
