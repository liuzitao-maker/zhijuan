import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import KnowledgeRadar from '../components/KnowledgeRadar'
import {
  getHealth,
  getOverview,
  listAttempts,
  listPapers,
  type AttemptSummary,
  type Health,
  type Overview,
  type PaperSummary,
} from '../lib/api'

export default function Home() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [papers, setPapers] = useState<PaperSummary[]>([])
  const [attempts, setAttempts] = useState<AttemptSummary[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getOverview(), listPapers(), listAttempts(), getHealth()])
      .then(([overviewData, paperData, attemptData, healthData]) => {
        setOverview(overviewData)
        setPapers(paperData.papers)
        setAttempts(attemptData.attempts)
        setHealth(healthData)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <section className="hero">
        <h1>让 AI 出题，也让 AI 互相监考。</h1>
        <p>
          智卷把一个知识点，变成一份可直接作答的试卷：出题智能体负责命题，独立审题智能体以「敌对视角」逐题挑错，
          发现问题自动打回修复 —— 直到通过为止。作答后，客观题由确定性代码判分，主观题由阅卷智能体按评分要点给分，
          最后生成学情诊断。
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary btn-lg" to="/generate">
            立即生成一份试卷
          </Link>
          <Link className="btn btn-lg" to="/library">
            打开试卷库
          </Link>
        </div>
      </section>

      {health && !health.hasApiKey ? (
        <div className="alert alert-error" style={{ marginBottom: 18 }}>
          未检测到 API Key。请把项目根目录的 <code>.env.example</code> 复制为{' '}
          <code>server/.env</code>，填入 <code>DEEPSEEK_API_KEY</code> 后重启服务。
        </div>
      ) : null}

      <div className="stat-grid">
        <div className="card stat">
          <div className="stat-label">已生成试卷</div>
          <div className="stat-value">
            {overview?.paperCount ?? 0}
            <small>份</small>
          </div>
          <div className="stat-foot">全部通过双智能体流水线</div>
        </div>
        <div className="card stat">
          <div className="stat-label">完成作答</div>
          <div className="stat-value">
            {overview?.attemptCount ?? 0}
            <small>次</small>
          </div>
          <div className="stat-foot">含客观题自动判分</div>
        </div>
        <div className="card stat">
          <div className="stat-label">平均正确率</div>
          <div className="stat-value">
            {overview?.averageAccuracy ?? 0}
            <small>%</small>
          </div>
          <div className="stat-foot">按得分率加权统计</div>
        </div>
        <div className="card stat">
          <div className="stat-label">覆盖知识点</div>
          <div className="stat-value">
            {overview?.knowledge.length ?? 0}
            <small>个</small>
          </div>
          <div className="stat-foot">用于生成学情雷达图</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card card-pad">
          <h3 className="card-title">最近作答</h3>
          {loading ? (
            <div className="loading-line">
              <span className="spinner" /> 加载中…
            </div>
          ) : attempts.length === 0 ? (
            <div className="empty">
              <strong>还没有作答记录</strong>
              生成一份试卷并完成它，这里就会出现你的成绩轨迹
            </div>
          ) : (
            attempts.slice(0, 6).map((attempt) => (
              <div className="list-row" key={attempt.id}>
                <div className="list-main">
                  <div className="list-title">{attempt.paperTitle}</div>
                  <div className="list-meta">
                    {attempt.subject} · {new Date(attempt.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
                <span
                  className={`chip ${
                    attempt.accuracy >= 80
                      ? 'chip-success'
                      : attempt.accuracy >= 60
                        ? 'chip-warn'
                        : 'chip-danger'
                  }`}
                >
                  {attempt.accuracy}%
                </span>
                <Link className="btn btn-ghost" to={`/reports/${attempt.id}`}>
                  查看报告
                </Link>
              </div>
            ))
          )}
        </div>

        <div className="card card-pad">
          <h3 className="card-title">知识掌握度</h3>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <KnowledgeRadar data={overview?.knowledge ?? []} />
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <h3 className="card-title">最近的试卷</h3>
        {papers.length === 0 ? (
          <div className="empty">
            <strong>试卷库是空的</strong>
            去「新建试卷」输入一个知识点，30 秒内就能得到一份带解析的试卷
          </div>
        ) : (
          papers.slice(0, 5).map((paper) => (
            <div className="list-row" key={paper.id}>
              <div className="list-main">
                <div className="list-title">{paper.title}</div>
                <div className="list-meta">
                  {paper.subject} · {paper.questionCount} 题 · 满分 {paper.totalPoints}
                </div>
              </div>
              {paper.reviewPassed ? (
                <span className="chip chip-success">审题通过</span>
              ) : (
                <span className="chip chip-warn">待复核</span>
              )}
              <Link className="btn btn-ghost" to={`/papers/${paper.id}`}>
                去作答
              </Link>
            </div>
          ))
        )}
      </div>
    </>
  )
}
