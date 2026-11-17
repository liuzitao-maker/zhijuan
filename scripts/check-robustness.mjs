/**
 * 多学科健壮性回归：对若干不同学科与知识点真实调用生成接口，
 * 自动检查结构合法性、公式配对、选项完整性等硬性指标。
 *
 *   node scripts/check-robustness.mjs
 */
const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:8787'

const CASES = [
  {
    name: '数据结构',
    subject: '数据结构',
    topic: '二叉树遍历与性质',
    count: 6,
    totalPoints: 60,
    difficulty: 'medium',
    types: ['single', 'fill', 'short'],
  },
  {
    name: '计算机网络',
    subject: '计算机网络',
    topic: 'TCP 三次握手与拥塞控制',
    count: 6,
    totalPoints: 60,
    difficulty: 'medium',
    types: ['single', 'multiple', 'short'],
  },
  {
    name: '概率论',
    subject: '概率论与数理统计',
    topic: '条件概率与贝叶斯公式',
    count: 6,
    totalPoints: 60,
    difficulty: 'medium',
    types: ['single', 'fill', 'short'],
  },
]

async function readSse(response) {
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
        if (event === 'paper') paper = parsed
      }
      index = buffer.indexOf('\n\n')
    }
  }
  return paper
}

function inspect(paper, spec) {
  const problems = []
  const questions = paper.questions ?? []

  if (questions.length !== spec.count) {
    problems.push(`题数不符：期望 ${spec.count}，实际 ${questions.length}`)
  }

  const total = questions.reduce((sum, q) => sum + q.points, 0)
  if (Math.abs(total - spec.totalPoints) > 0.01) {
    problems.push(`总分不符：期望 ${spec.totalPoints}，实际 ${total}`)
  }

  for (const q of questions) {
    if (!q.stem || q.stem.length < 4) problems.push(`${q.id} 题干过短`)

    // LaTeX 的 $ 必须成对
    const dollars = (q.stem.match(/\$/g) ?? []).length
    if (dollars % 2 !== 0) problems.push(`${q.id} 题干 $ 符号不成对（${dollars} 个）`)

    if (!q.explanation) problems.push(`${q.id} 缺少解析`)

    if (q.type === 'single' || q.type === 'multiple') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        problems.push(`${q.id} 选项不足`)
      } else {
        const keys = q.options.map((o) => o.key)
        if (new Set(keys).size !== keys.length) problems.push(`${q.id} 选项 key 重复`)
        q.options.forEach((o) => {
          if (!o.text || !String(o.text).trim()) problems.push(`${q.id} 存在空选项`)
        })
      }
      const answers = Array.isArray(q.answer) ? q.answer : [q.answer]
      const validKeys = (q.options ?? []).map((o) => o.key)
      for (const a of answers) {
        if (!validKeys.includes(String(a).toUpperCase())) {
          problems.push(`${q.id} 答案 ${a} 不在选项中`)
        }
      }
      if (q.type === 'multiple' && answers.length < 2) {
        problems.push(`${q.id} 多选题答案少于 2 个`)
      }
    } else {
      const answerText = Array.isArray(q.answer) ? q.answer.join('|') : String(q.answer ?? '')
      if (!answerText.trim()) problems.push(`${q.id} 缺少答案`)
    }
  }

  return problems
}

async function main() {
  let failed = 0
  const startedAll = Date.now()

  for (const spec of CASES) {
    const started = Date.now()
    process.stdout.write(`\n▶ ${spec.name} · ${spec.topic} … `)

    let response
    try {
      response = await fetch(`${BASE}/api/papers/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spec),
      })
    } catch (error) {
      console.log(`请求失败：${error.message}`)
      failed += 1
      continue
    }

    if (!response.ok) {
      console.log(`HTTP ${response.status}`)
      failed += 1
      continue
    }

    const paper = await readSse(response)
    const seconds = ((Date.now() - started) / 1000).toFixed(1)
    if (!paper) {
      console.log('未拿到试卷')
      failed += 1
      continue
    }

    const problems = inspect(paper, spec)
    const passed = paper.review?.passed
    const rounds = paper.rounds
    console.log(`${seconds}s，${rounds} 轮，审题${passed ? '通过' : '未通过'}，${paper.usage.totalTokens} tokens`)

    if (problems.length) {
      failed += 1
      console.log('  ✗ 结构问题：')
      problems.slice(0, 8).forEach((p) => console.log('    · ' + p))
    } else {
      console.log('  ✓ 结构全部合法')
    }
    if (!passed) {
      console.log('  ! 审题未通过：' + (paper.review?.summary ?? ''))
    }
    console.log('  题目预览：')
    paper.questions.slice(0, 3).forEach((q, i) => {
      const stem = q.stem.replace(/\s+/g, ' ').slice(0, 70)
      console.log(`    ${i + 1}. [${q.type}] ${stem}`)
    })
  }

  console.log(`\n合计耗时 ${((Date.now() - startedAll) / 1000).toFixed(1)}s，失败用例 ${failed} / ${CASES.length}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('回归测试异常：', error.message)
  process.exit(1)
})
