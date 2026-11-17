import type { GradeResult, Paper } from '../lib/api'
import { DIFFICULTY_LABELS, RichText, TYPE_LABELS } from '../lib/math'

interface Props {
  paper: Paper
  mode: 'answer' | 'review'
  answers: Record<string, unknown>
  onChange?: (questionId: string, value: unknown) => void
  results?: GradeResult[]
  revealAnswers?: boolean
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (value === null || value === undefined || value === '') return []
  return String(value)
    .split(/[,，\s]+/)
    .filter(Boolean)
}

export default function PaperRenderer({
  paper,
  mode,
  answers,
  onChange,
  results = [],
  revealAnswers = false,
}: Props) {
  const resultMap = new Map(results.map((item) => [item.questionId, item]))

  return (
    <div className="paper">
      <div className="paper-head">
        <h1 className="paper-title">{paper.title}</h1>
        <div className="paper-meta">
          <span>学科：{paper.subject}</span>
          <span>共 {paper.questions.length} 题</span>
          <span>满分 {paper.totalPoints} 分</span>
          <span>建议用时 {paper.durationMin} 分钟</span>
          <span>难度：{DIFFICULTY_LABELS[paper.difficulty] ?? paper.difficulty}</span>
        </div>
        {paper.review?.passed === false ? (
          <div className="paper-meta" style={{ marginTop: 8, color: '#c47d0a' }}>
            ⚠ 本题卷未通过自动审题，建议人工复核后使用
          </div>
        ) : null}
      </div>

      {paper.questions.map((question, index) => {
        const raw = answers[question.id]
        const picked = toArray(raw)
        const result = resultMap.get(question.id)
        const correctKeys = toArray(question.answer)

        return (
          <div className="question" key={question.id}>
            <div className="q-stem">
              <span className="q-index">
                {index + 1}. [{TYPE_LABELS[question.type] ?? question.type}]
              </span>
              <RichText text={question.stem} />
              <span className="q-points">（{question.points} 分）</span>
            </div>

            {(question.type === 'single' || question.type === 'multiple') && (
              <div className="options">
                {question.options.map((option) => {
                  const isPicked = picked.includes(option.key)
                  const isCorrect = correctKeys.includes(option.key)
                  const classes = ['option']
                  if (mode === 'answer' && isPicked) classes.push('picked')
                  if (mode === 'review' && revealAnswers && isCorrect) classes.push('correct')
                  if (mode === 'review' && revealAnswers && isPicked && !isCorrect)
                    classes.push('wrong')

                  return (
                    <label
                      key={option.key}
                      className={classes.join(' ')}
                      onClick={() => {
                        if (mode !== 'answer' || !onChange) return
                        if (question.type === 'single') {
                          onChange(question.id, option.key)
                        } else {
                          const next = isPicked
                            ? picked.filter((key) => key !== option.key)
                            : [...picked, option.key].sort()
                          onChange(question.id, next)
                        }
                      }}
                    >
                      <span className="option-key">{option.key}</span>
                      <span>
                        <RichText text={option.text} />
                      </span>
                    </label>
                  )
                })}
              </div>
            )}

            {question.type === 'fill' && mode === 'answer' && (
              <input
                className="answer-input"
                placeholder="在此填写答案"
                value={String(raw ?? '')}
                onChange={(event) => onChange?.(question.id, event.target.value)}
              />
            )}

            {question.type === 'short' && mode === 'answer' && (
              <textarea
                className="answer-input"
                placeholder="在此作答（可写解题过程）"
                value={String(raw ?? '')}
                onChange={(event) => onChange?.(question.id, event.target.value)}
              />
            )}

            {mode === 'review' && (
              <div className="q-answer-box">
                <div>
                  <span className="label">你的答案：</span>
                  {raw && (Array.isArray(raw) ? raw.length : String(raw).trim())
                    ? Array.isArray(raw)
                      ? raw.join('')
                      : String(raw)
                    : '（未作答）'}
                </div>
                {revealAnswers ? (
                  <>
                    <div style={{ marginTop: 4 }}>
                      <span className="label">参考答案：</span>
                      {Array.isArray(question.answer)
                        ? question.answer.join('')
                        : question.answer}
                    </div>
                    {question.explanation ? (
                      <div style={{ marginTop: 4 }}>
                        <span className="label">解析：</span>
                        <RichText text={question.explanation} />
                      </div>
                    ) : null}
                  </>
                ) : null}
                {result?.feedback ? (
                  <div className="q-feedback">
                    <span className="label">评语：</span>
                    <RichText text={result.feedback} />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
