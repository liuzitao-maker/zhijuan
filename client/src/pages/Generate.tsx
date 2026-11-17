import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PipelineTrace from '../components/PipelineTrace'
import {
  streamGenerate,
  type Paper,
  type GenerateSpec,
  type TraceEvent,
} from '../lib/api'
import { DIFFICULTY_LABELS, TYPE_LABELS } from '../lib/math'

const PRESETS = [
  { subject: '高等数学', topic: '函数极限与连续', types: ['single', 'fill', 'short'] },
  { subject: '数据结构', topic: '二叉树遍历与性质', types: ['single', 'fill', 'short'] },
  { subject: '概率论', topic: '条件概率与贝叶斯公式', types: ['single', 'fill', 'short'] },
  { subject: '计算机网络', topic: 'TCP 三次握手与拥塞控制', types: ['single', 'multiple', 'short'] },
  { subject: '线性代数', topic: '矩阵的秩与线性方程组', types: ['single', 'fill', 'short'] },
]

const ALL_TYPES = ['single', 'multiple', 'fill', 'short']

export default function Generate() {
  const navigate = useNavigate()

  const [subject, setSubject] = useState('高等数学')
  const [topic, setTopic] = useState('函数极限与连续')
  const [count, setCount] = useState(8)
  const [totalPoints, setTotalPoints] = useState(100)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [types, setTypes] = useState<string[]>(['single', 'fill', 'short'])
  const [extra, setExtra] = useState('')

  const [running, setRunning] = useState(false)
  const [trace, setTrace] = useState<TraceEvent[]>([])
  const [paper, setPaper] = useState<Paper | null>(null)
  const [error, setError] = useState('')

  const canSubmit = useMemo(
    () => topic.trim().length > 0 && types.length > 0 && !running,
    [topic, types, running],
  )

  const toggleType = (type: string) => {
    setTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    )
  }

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setSubject(preset.subject)
    setTopic(preset.topic)
    setTypes(preset.types)
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setRunning(true)
    setTrace([])
    setPaper(null)
    setError('')

    const spec: GenerateSpec = {
      subject: subject.trim() || '通用',
      topic: topic.trim(),
      count,
      totalPoints,
      difficulty,
      types,
      extra: extra.trim(),
    }

    try {
      const result = await streamGenerate(spec, {
        onTrace: (event) => setTrace((current) => [...current, event]),
        onPaper: (generated) => setPaper(generated),
      })
      setPaper(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '生成失败，请重试')
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">新建试卷</h2>
          <p className="page-sub">
            给出一个知识点，双智能体流水线会生成一份带解析、可作答、可自动批改的试卷
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        {/* ── 左：命题需求 ─────────────────────────────── */}
        <div className="card card-pad">
          <div className="field full" style={{ marginBottom: 16 }}>
            <label>快速模板</label>
            <div className="type-picker">
              {PRESETS.map((preset) => (
                <button
                  key={preset.topic}
                  type="button"
                  className="type-option"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.topic}
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>学科 / 课程</label>
              <input
                className="input"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="如：高等数学"
              />
            </div>

            <div className="field">
              <label>整体难度</label>
              <div className="segmented">
                {(['easy', 'medium', 'hard'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={difficulty === level ? 'on' : ''}
                    onClick={() => setDifficulty(level)}
                  >
                    {DIFFICULTY_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>

            <div className="field full">
              <label>核心知识点</label>
              <textarea
                className="textarea"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="例如：函数极限与连续（含洛必达法则、无穷小比较）"
              />
              <span className="hint">越具体，出题越准。可以直接粘贴课件标题或考纲条目。</span>
            </div>

            <div className="field">
              <label>题目数量</label>
              <input
                className="input"
                type="number"
                min={3}
                max={20}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              />
              <span className="hint">建议 6–12 题</span>
            </div>

            <div className="field">
              <label>试卷总分</label>
              <input
                className="input"
                type="number"
                min={10}
                max={200}
                step={5}
                value={totalPoints}
                onChange={(event) => setTotalPoints(Number(event.target.value))}
              />
              <span className="hint">分值会按题目自动分配</span>
            </div>

            <div className="field full">
              <label>题型组合</label>
              <div className="type-picker">
                {ALL_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`type-option${types.includes(type) ? ' on' : ''}`}
                    onClick={() => toggleType(type)}
                  >
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <div className="field full">
              <label>额外要求（可选）</label>
              <textarea
                className="textarea"
                value={extra}
                onChange={(event) => setExtra(event.target.value)}
                placeholder="例如：侧重计算题；避免超纲；每题给出易错点提示"
                style={{ minHeight: 62 }}
              />
            </div>
          </div>

          {error ? (
            <div className="alert alert-error" style={{ marginTop: 16 }}>
              {error}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={!canSubmit}>
              {running ? (
                <>
                  <span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }} />
                  流水线运行中…
                </>
              ) : (
                '生成试卷'
              )}
            </button>
            {paper ? (
              <button className="btn btn-lg" onClick={() => navigate(`/papers/${paper.id}`)}>
                去作答 →
              </button>
            ) : null}
          </div>
        </div>

        {/* ── 右：流水线实时轨迹 ────────────────────────── */}
        <div className="card card-pad" style={{ position: 'sticky', top: 24 }}>
          <h3 className="card-title">
            双智能体流水线
            {running ? (
              <span className="loading-line" style={{ marginLeft: 'auto' }}>
                <span className="spinner" /> 进行中
              </span>
            ) : paper ? (
              <span className="chip chip-success" style={{ marginLeft: 'auto' }}>
                已完成 · {paper.rounds} 轮
              </span>
            ) : null}
          </h3>

          <PipelineTrace events={trace} />

          {paper ? (
            <div className="alert alert-info" style={{ marginTop: 14 }}>
              已生成《{paper.title}》：{paper.questions.length} 题，满分 {paper.totalPoints}，共{' '}
              {paper.rounds} 轮，消耗 {paper.usage?.totalTokens ?? 0} tokens。
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-primary" onClick={() => navigate(`/papers/${paper.id}`)}>
                  开始作答
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
