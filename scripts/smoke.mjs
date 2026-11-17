/**
 * 冒烟测试：不打开浏览器，用一条命令验证「生成 → 审题 → 作答 → 批改」整条闭环。
 * 用于复现验证与 CI。运行前需已启动 API 服务（npm run dev:server）。
 *
 *   node scripts/smoke.mjs
 */
const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:8787'

function log(flag, message) {
  console.log(`${flag} ${message}`)
}

async function readSse(response, onEvent) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let paper = null

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let index = buffer.indexOf('\n\n')
    while (index >= 0) {
      const chunk = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)
      let event = 'message'
      let data = ''
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (data) {
        const parsed = JSON.parse(data)
        onEvent(event, parsed)
        if (event === 'paper') paper = parsed
        if (event === 'error') throw new Error(parsed.message)
      }
      index = buffer.indexOf('\n\n')
    }
  }

  return paper
}

async function main() {
  const startedAt = Date.now()

  // 1. 健康检查
  const health = await fetch(`${BASE}/api/health`).then((response) => response.json())
  if (!health.hasApiKey) {
    console.error('✗ 未配置 API Key，请先在 server/.env 填写 DEEPSEEK_API_KEY')
    process.exit(1)
  }
  log('✓', `健康检查通过，模型 ${health.model}`)

  // 2. 生成试卷（SSE）
  const spec = {
    subject: '高等数学',
    topic: '函数极限与连续',
    count: 5,
    totalPoints: 50,
    difficulty: 'medium',
    types: ['single', 'fill', 'short'],
    extra: '侧重计算，避免超纲',
  }
  log('·', `开始生成试卷：${spec.subject} · ${spec.topic} · ${spec.count} 题`)

  const response = await fetch(`${BASE}/api/papers/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(spec),
  })
  if (!response.ok) {
    console.error('✗ 生成接口返回', response.status, await response.text())
    process.exit(1)
  }

  const paper = await readSse(response, (event, payload) => {
    if (event === 'trace') {
      const icon =
        payload.status === 'passed' ? '✓' : payload.status === 'failed' ? '✗' : payload.status === 'warn' ? '!' : '·'
      console.log(`  ${icon} [R${payload.round ?? 1}] ${payload.title}${payload.detail ? ` — ${payload.detail}` : ''}`)
    }
  })

  if (!paper) {
    console.error('✗ 未收到试卷')
    process.exit(1)
  }
  log('✓', `生成完成：${paper.questions.length} 题 / 满分 ${paper.totalPoints} / ${paper.rounds} 轮 / ${paper.usage.totalTokens} tokens`)

  // 3. 构造作答：单选选 A，填空写 0，简答写一句话
  const answers = paper.questions.map((question) => ({
    questionId: question.id,
    answer:
      question.type === 'single'
        ? 'A'
        : question.type === 'multiple'
          ? ['A']
          : question.type === 'fill'
            ? '0'
            : '由极限的定义可知，函数在该点连续。',
  }))

  const attemptResponse = await fetch(`${BASE}/api/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paperId: paper.id, answers, durationSec: 120 }),
  })
  if (!attemptResponse.ok) {
    console.error('✗ 批改接口返回', attemptResponse.status, await attemptResponse.text())
    process.exit(1)
  }
  const { attempt } = await attemptResponse.json()

  log('✓', `批改完成：${attempt.score} / ${attempt.totalPoints}（${attempt.accuracy}%）`)
  log('·', `学情诊断：${attempt.diagnosis}`)
  log('·', `知识点：${attempt.knowledgeStats.map((item) => `${item.knowledgePoint} ${item.accuracy}%`).join('，')}`)
  log('✓', `全链路耗时 ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)
  console.log('\n报告地址（浏览器）：', `${BASE}/#/reports/${attempt.id}`)
}

main().catch((error) => {
  console.error('✗ 冒烟测试失败：', error.message)
  process.exit(1)
})

