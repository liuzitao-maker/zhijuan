/**
 * 生成一组演示数据：一份覆盖多个知识点的试卷 + 一次「接近满分」的作答。
 * 用于文档截图、演示视频素材与首次体验。
 *
 *   node scripts/seed-demo.mjs
 */
const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:8787'

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
      }
      index = buffer.indexOf('\n\n')
    }
  }
  return paper
}

const SHORT_ANSWER_TEXT = [
  '先求出左右极限：右极限为 1/2，左极限为 a，令二者相等并等于函数值，解得 a = 1/2。',
  '由极限的四则运算法则与该点连续的定义可知，函数在该点连续需要左右极限存在且相等，并等于函数值。',
  '利用泰勒展开或等价无穷小替换，将分子展开到二阶，化简后取极限即可得到结果。',
]

async function main() {
  const spec = {
    subject: '高等数学',
    topic: '函数极限、函数连续、导数与微分、微分中值定理',
    count: 8,
    totalPoints: 100,
    difficulty: 'medium',
    types: ['single', 'fill', 'short'],
    extra: '每题覆盖一个明确的知识点，难度以基础到中等为主，题目表述简洁',
  }

  console.log('· 生成演示试卷…')
  const response = await fetch(`${BASE}/api/papers/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(spec),
  })
  if (!response.ok) throw new Error(`生成失败：${await response.text()}`)

  const paper = await readSse(response, (event, payload) => {
    if (event === 'trace') {
      const icon = payload.status === 'passed' ? '✓' : payload.status === 'failed' ? '✗' : '·'
      console.log(`  ${icon} [R${payload.round ?? 1}] ${payload.title}`)
    }
  })
  if (!paper) throw new Error('未收到试卷')
  console.log(`✓ ${paper.title}｜${paper.questions.length} 题｜${paper.rounds} 轮`)

  // 故意答错一道客观题，让报告看起来更真实（而不是满分）
  let wrongOnce = false
  const answers = paper.questions.map((question, index) => {
    if (question.type === 'single' || question.type === 'multiple') {
      const correct = Array.isArray(question.answer)
        ? question.answer
        : [String(question.answer).toUpperCase()]
      if (!wrongOnce && question.type === 'single') {
        wrongOnce = true
        const wrongKey =
          question.options.map((option) => option.key).find((key) => !correct.includes(key)) ?? correct[0]
        return { questionId: question.id, answer: wrongKey }
      }
      return { questionId: question.id, answer: correct }
    }
    if (question.type === 'fill') {
      return { questionId: question.id, answer: String(question.answer).split('|')[0] }
    }
    return {
      questionId: question.id,
      answer: SHORT_ANSWER_TEXT[index % SHORT_ANSWER_TEXT.length],
    }
  })

  console.log('· 提交作答并批改…')
  const attemptResponse = await fetch(`${BASE}/api/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paperId: paper.id, answers, durationSec: 680 }),
  })
  if (!attemptResponse.ok) throw new Error(`批改失败：${await attemptResponse.text()}`)

  const { attempt } = await attemptResponse.json()
  console.log(`✓ 得分 ${attempt.score} / ${attempt.totalPoints}（${attempt.accuracy}%）`)
  console.log(`✓ 知识点：${attempt.knowledgeStats.map((item) => `${item.knowledgePoint} ${item.accuracy}%`).join('，')}`)
  console.log('\n演示数据已就绪：')
  console.log(`  试卷：${BASE}/api/papers/${paper.id}`)
  console.log(`  报告：http://localhost:5173/reports/${attempt.id}`)
}

main().catch((error) => {
  console.error('✗ 生成演示数据失败：', error.message)
  process.exit(1)
})
