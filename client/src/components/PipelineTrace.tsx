import type { TraceEvent } from '../lib/api'

const ICONS: Record<string, string> = {
  running: '·',
  passed: '✓',
  warn: '!',
  failed: '×',
}

const STAGE_LABELS: Record<string, string> = {
  pipeline: '编排',
  generate: '出题',
  validate: '校验',
  review: '审题',
  repair: '修复',
  done: '完成',
}

export default function PipelineTrace({
  events,
  compact = false,
}: {
  events: TraceEvent[]
  compact?: boolean
}) {
  if (events.length === 0) {
    return (
      <div className="empty" style={{ padding: '28px 12px' }}>
        <strong>等待启动</strong>
        点击「生成试卷」后，这里会实时显示每一个智能体的动作
      </div>
    )
  }

  return (
    <div className="trace">
      {events.map((event) => (
        <div className="trace-item" key={event.id}>
          <div className={`trace-dot ${event.status}`}>{ICONS[event.status] ?? '·'}</div>
          <div className="trace-body">
            <div className="trace-title">
              {!compact && (
                <span className="chip chip-brand" style={{ fontSize: 10.5 }}>
                  {STAGE_LABELS[event.stage] ?? event.stage}
                </span>
              )}
              <span>{event.title}</span>
              {event.round ? <span className="trace-round">R{event.round}</span> : null}
              {event.durationMs ? (
                <span className="trace-round">{(event.durationMs / 1000).toFixed(1)}s</span>
              ) : null}
            </div>
            {event.detail ? <div className="trace-detail">{event.detail}</div> : null}
            {Array.isArray(event.issues) && event.issues.length > 0 ? (
              <ul className="trace-issues">
                {event.issues.slice(0, 6).map((issue, index) => {
                  const record = issue as Record<string, unknown>
                  const label = record.detail ?? record.questionId ?? JSON.stringify(issue)
                  return <li key={index}>· {String(label)}</li>
                })}
              </ul>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
