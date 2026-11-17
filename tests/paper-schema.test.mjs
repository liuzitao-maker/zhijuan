import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePaper, summarizePaper, validatePaper } from '../server/paper-schema.js'

const SPEC = {
  subject: '高等数学',
  topic: '函数极限',
  count: 3,
  totalPoints: 30,
  difficulty: 'medium',
  types: ['single', 'fill', 'short'],
}

function makeRaw(overrides = {}) {
  return {
    title: '测试卷',
    subject: '高等数学',
    questions: [
      {
        id: 'q1',
        type: 'single',
        stem: '极限 $\\lim_{x\\to0}\\frac{\\sin x}{x}$ 的值为？',
        options: [
          { key: 'A', text: '0' },
          { key: 'B', text: '1' },
        ],
        answer: 'A',
        explanation: '重要极限',
        points: 10,
        knowledgePoint: '函数极限',
      },
      {
        id: 'q2',
        type: 'fill',
        stem: '若 $f(x)$ 在 $x=0$ 连续，则 $\\lim_{x\\to0}f(x)=$ ____',
        answer: 'f(0)',
        explanation: '连续定义',
        points: 10,
        knowledgePoint: '函数连续',
      },
      {
        id: 'q3',
        type: 'short',
        stem: '简述连续的定义。',
        answer: '左右极限存在且相等并等于函数值',
        explanation: '考察连续定义',
        points: 10,
        knowledgePoint: '函数连续',
      },
    ],
    ...overrides,
  }
}

test('分值本来就正确时不应误报失败', () => {
  const raw = makeRaw()
  // 10 + 10 + 10 = 30，与 SPEC.totalPoints 完全一致
  const { paper, issues } = normalizePaper(raw, SPEC)
  const total = paper.questions.reduce((sum, question) => sum + question.points, 0)
  assert.equal(total, SPEC.totalPoints)
  assert.equal(
    issues.some((issue) => issue.includes('无法调整')),
    false,
  )
})

test('分值不符时自动归位到目标总分', () => {
  const raw = makeRaw()
  raw.questions[0].points = 1
  raw.questions[1].points = 1
  raw.questions[2].points = 1
  const { paper } = normalizePaper(raw, SPEC)
  const total = paper.questions.reduce((sum, question) => sum + question.points, 0)
  assert.equal(total, SPEC.totalPoints)
})

test('答案不在选项中时会被修正并记录问题', () => {
  const raw = makeRaw()
  raw.questions[0].answer = 'Z'
  const { paper, issues } = normalizePaper(raw, SPEC)
  assert.ok(['A', 'B'].includes(paper.questions[0].answer))
  assert.ok(issues.some((issue) => issue.includes('答案不在选项中')))
})

test('多选题支持字符串形式的答案', () => {
  const raw = makeRaw()
  raw.questions[0].type = 'multiple'
  raw.questions[0].options = [
    { key: 'A', text: '1' },
    { key: 'B', text: '2' },
    { key: 'C', text: '3' },
  ]
  raw.questions[0].answer = 'A,C'
  const { paper } = normalizePaper(raw, SPEC)
  assert.deepEqual(paper.questions[0].answer, ['A', 'C'])
})

test('缺少解析时结构校验会拦下', () => {
  const raw = makeRaw()
  delete raw.questions[0].explanation
  const { paper } = normalizePaper(raw, SPEC)
  const validation = validatePaper(paper, SPEC)
  assert.equal(validation.ok, false)
  assert.ok(validation.issues.some((issue) => issue.includes('解析')))
})

test('题数为 0 时校验失败', () => {
  const { paper } = normalizePaper({ questions: [] }, SPEC)
  const validation = validatePaper(paper, SPEC)
  assert.equal(validation.ok, false)
})

test('缺少要求的题型时校验失败', () => {
  const raw = makeRaw()
  raw.questions = raw.questions.filter((question) => question.type === 'single')
  const { paper } = normalizePaper(raw, SPEC)
  const validation = validatePaper(paper, SPEC)
  assert.equal(validation.ok, false)
  assert.ok(validation.issues.some((issue) => issue.includes('缺少要求的题型')))
})

test('题号重复会被自动去重', () => {
  const raw = makeRaw()
  raw.questions[1].id = 'q1'
  const { paper } = normalizePaper(raw, SPEC)
  const ids = paper.questions.map((question) => question.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('汇总信息正确', () => {
  const { paper } = normalizePaper(makeRaw(), SPEC)
  const summary = summarizePaper(paper)
  assert.equal(summary.count, 3)
  assert.equal(summary.totalPoints, 30)
  assert.deepEqual(summary.byType, { single: 1, fill: 1, short: 1 })
})
