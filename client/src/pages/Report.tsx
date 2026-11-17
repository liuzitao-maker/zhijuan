import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import KnowledgeRadar from '../components/KnowledgeRadar'
import PaperRenderer from '../components/PaperRenderer'
import { getAttempt, getPaper, type Attempt, type Paper } from '../lib/api'
import { RichText } from '../lib/math'

function verdictChip(verdict: string, accuracy: number) {
  if (verdict === '正确' || accuracy >= 100) return 'chip chip-success'
  if (verdict === '部分正确') return 'chip chip-warn'
  if (verdict === '待复核') return 'chip'
  return 'chip chip-danger'
}

export default function Report() {
  const { id } = useParams<{ id: string }>()
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [paper, setPaper] = useState<Paper | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    getAttempt(id)
      .then(async (data) => {
        setAttempt(data.attempt)
        try {
          const paperData = await getPaper(data.attempt.paperId)
          setPaper(paperData.paper)
        } catch {
          /* 试卷可能已被删除，报告仍可展示 */
        }
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : '加载失败'))
  }, [id])

  if (error) {
    return (
      <div className="card card-pad">
        <div className="empty">
          <strong>无法加载报告</strong>
          {error}
          <div style={{ marginTop: 14 }}>
            <Link className="btn" to="/">
              返回工作台
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="loading-line">
        <span className="spinner" /> 正在生成报告…
      </div>
    )
  }

  const answeredMap: Record<string, unknown> = {}
  for (const item of attempt.answers ?? []) answeredMap[item.questionId] = item.answer

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">学情报告</h2>
          <p className="page-sub">
            {attempt.paperTitle} · {new Date(attempt.createdAt).toLocaleString('zh-CN')}
            {attempt.durationSec ? ` · 用时 ${Math.round(attempt.durationSec / 60)} 分钟` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn" to="/">
            返回工作台
          </Link>
          <Link className="btn btn-primary" to={`/papers/${attempt.paperId}`}>
            再做一次
          </Link>
        </div>
      </div>

      <div className="card score-hero">
        <div
          className="ring"
          style={{ ['--pct' as string]: Math.max(0, Math.min(100, attempt.accuracy)) }}
        >
          <div className="ring-inner">
            <div className="ring-score">{attempt.score}</div>
            <div className="ring-total">/ {attempt.totalPoints} 分</div>
          </div>
        </div>

        <div className="score-side">
          <h2>本次正确率 {attempt.accuracy}%</h2>
          <div className="loading-line">
            共 {attempt.results.length} 题 · 客观题由确定性代码判分，简答题由阅卷智能体按评分要点给分
          </div>
          {attempt.diagnosis ? <div className="diagnosis">🎯 {attempt.diagnosis}</div> : null}
        </div>
      </div>

      <div
        className="two-col"
        style={{ marginTop: 16, gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.5fr)' }}
      >
        <div className="card card-pad">
          <h3 className="card-title">知识点掌握度</h3>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <KnowledgeRadar data={attempt.knowledgeStats} size={260} />
          </div>
        </div>

        <div className="card card-pad">
          <h3 className="card-title">逐题明细</h3>
          {attempt.results.map((result, index) => {
            const question = paper?.questions.find((item) => item.id === result.questionId)
            const ratio = result.maxScore ? (result.score / result.maxScore) * 100 : 0
            return (
              <div className="result-item" key={result.questionId}>
                <div className="result-head">
                  <span className="result-idx">第 {index + 1} 题</span>
                  <span className={verdictChip(result.verdict, ratio)}>{result.verdict}</span>
                  {question ? (
                    <span className="chip">{question.knowledgePoint}</span>
                  ) : null}
                  <span className="result-points">
                    {result.score} / {result.maxScore}
                  </span>
                </div>
                {question ? (
                  <div style={{ fontSize: 13, color: '#2a2620', lineHeight: 1.8, marginBottom: 6 }}>
                    <RichText
                      text={
                        question.stem.length > 110
                          ? `${question.stem.slice(0, 110)}…`
                          : question.stem
                      }
                    />
                  </div>
                ) : null}
                <div className="bar" style={{ marginBottom: 8 }}>
                  <i
                    style={{ width: `${ratio}%` }}
                    className={ratio >= 100 ? undefined : ratio > 0 ? 'warn' : 'danger'}
                  />
                </div>
                {result.feedback ? (
                  <div className="q-feedback">
                    💬 <RichText text={result.feedback} />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {paper ? (
        <div style={{ marginTop: 18 }}>
          <div className="page-head" style={{ marginBottom: 12 }}>
            <div>
              <h2 className="page-title" style={{ fontSize: 20 }}>
                完整解析
              </h2>
              <p className="page-sub">已标注你的答案、参考答案与解析</p>
            </div>
          </div>
          <PaperRenderer
            paper={paper}
            mode="review"
            answers={answeredMap}
            results={attempt.results}
            revealAnswers
          />
        </div>
      ) : null}
    </>
  )
}
