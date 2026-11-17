import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PaperRenderer from '../components/PaperRenderer'
import PipelineTrace from '../components/PipelineTrace'
import { getPaper, submitAttempt, type Paper } from '../lib/api'

export default function PaperDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [paper, setPaper] = useState<Paper | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showTrace, setShowTrace] = useState(false)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getPaper(id)
      .then((data) => setPaper(data.paper))
      .catch((caught) => setError(caught instanceof Error ? caught.message : '加载失败'))
      .finally(() => setLoading(false))
    startedAt.current = Date.now()
  }, [id])

  const answeredCount = useMemo(
    () =>
      paper
        ? paper.questions.filter((question) => {
            const value = answers[question.id]
            return Array.isArray(value) ? value.length > 0 : String(value ?? '').trim().length > 0
          }).length
        : 0,
    [paper, answers],
  )

  const handleSubmit = async () => {
    if (!paper || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const payload = paper.questions.map((question) => ({
        questionId: question.id,
        answer: answers[question.id] ?? '',
      }))
      const durationSec = Math.round((Date.now() - startedAt.current) / 1000)
      const { attempt } = await submitAttempt({ paperId: paper.id, answers: payload, durationSec })
      navigate(`/reports/${attempt.id}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '提交失败')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-line">
        <span className="spinner" /> 正在载入试卷…
      </div>
    )
  }

  if (!paper) {
    return (
      <div className="card card-pad">
        <div className="empty">
          <strong>试卷不存在</strong>
          {error}
          <div style={{ marginTop: 14 }}>
            <Link className="btn" to="/library">
              返回试卷库
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">{paper.title}</h2>
          <p className="page-sub">
            已完成 {answeredCount} / {paper.questions.length} 题 · 满分 {paper.totalPoints} 分
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setShowTrace((current) => !current)}>
            {showTrace ? '隐藏' : '查看'}流水线记录
          </button>
          <Link className="btn" to="/library">
            返回
          </Link>
        </div>
      </div>

      {showTrace ? (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <h3 className="card-title">
            生成这份试卷时，两个智能体做了什么
            <span className="chip chip-brand" style={{ marginLeft: 'auto' }}>
              {paper.rounds} 轮 · {paper.usage?.totalTokens ?? 0} tokens
            </span>
          </h3>
          <PipelineTrace events={paper.pipelineTrace ?? []} />
        </div>
      ) : null}

      {error ? <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div> : null}

      <PaperRenderer
        paper={paper}
        mode="answer"
        answers={answers}
        onChange={(questionId, value) =>
          setAnswers((current) => ({ ...current, [questionId]: value }))
        }
      />

      <div
        className="card card-pad"
        style={{
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          position: 'sticky',
          bottom: 16,
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div className="loading-line">
          作答进度 <b>{answeredCount}</b> / {paper.questions.length}
        </div>
        <span className="spacer" />
        <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }} />
              阅卷中（客观题本地判分 + 简答题 AI 批改）…
            </>
          ) : (
            '提交并批改'
          )}
        </button>
      </div>
    </>
  )
}
