import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deletePaper, listPapers, type PaperSummary } from '../lib/api'
import { DIFFICULTY_LABELS } from '../lib/math'

export default function Library() {
  const [papers, setPapers] = useState<PaperSummary[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    listPapers()
      .then((data) => setPapers(data.papers))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleDelete = async (id: string) => {
    await deletePaper(id).catch(() => {})
    load()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">试卷库</h2>
          <p className="page-sub">共 {papers.length} 份试卷，全部由双智能体流水线生成</p>
        </div>
        <Link className="btn btn-primary" to="/generate">
          新建试卷
        </Link>
      </div>

      {loading ? (
        <div className="loading-line">
          <span className="spinner" /> 加载中…
        </div>
      ) : papers.length === 0 ? (
        <div className="card card-pad">
          <div className="empty">
            <strong>还没有试卷</strong>
            输入一个知识点，30 秒内生成第一份试卷
            <div style={{ marginTop: 14 }}>
              <Link className="btn btn-primary" to="/generate">
                去生成
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid-cards">
          {papers.map((paper) => (
            <div className="card paper-card" key={paper.id}>
              <div className="tags">
                <span className="chip chip-brand">{paper.subject}</span>
                <span className="chip">{DIFFICULTY_LABELS[paper.difficulty] ?? paper.difficulty}</span>
                {paper.reviewPassed ? (
                  <span className="chip chip-success">审题通过</span>
                ) : (
                  <span className="chip chip-warn">待复核</span>
                )}
              </div>
              <h3>{paper.title}</h3>
              <div className="tags">
                {paper.knowledgePoints.slice(0, 4).map((point) => (
                  <span className="chip" key={point}>
                    {point}
                  </span>
                ))}
              </div>
              <div className="foot">
                <span>
                  {paper.questionCount} 题 · {paper.totalPoints} 分
                </span>
                <span className="spacer" />
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', fontSize: 12 }}
                  onClick={() => handleDelete(paper.id)}
                >
                  删除
                </button>
                <Link className="btn" to={`/papers/${paper.id}`}>
                  作答
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
