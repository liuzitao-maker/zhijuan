import type { KnowledgeStat } from '../lib/api'

/**
 * 纯 SVG 知识掌握度雷达图。
 * 不引入图表库 —— 少一个依赖，「10 分钟复现」就少一个失败点。
 * 外围知识点用下方图例列出，避免长中文名把 SVG 视口撑破。
 */
export default function KnowledgeRadar({
  data,
  size = 300,
}: {
  data: KnowledgeStat[]
  size?: number
}) {
  const items = data.slice(0, 6)

  // 知识点少于 3 个时无法构成雷达多边形，退化为条形掌握度列表（信息量不丢）
  if (items.length < 3) {
    if (data.length === 0) {
      return (
        <div className="empty" style={{ padding: '20px 0' }}>
          <strong>数据不足</strong>
          完成一次测验后，这里会显示各知识点的掌握度
        </div>
      )
    }
    return (
      <div className="kp-list" style={{ width: '100%', padding: '6px 2px' }}>
        {data.map((item) => {
          const level = item.accuracy >= 80 ? '' : item.accuracy >= 50 ? 'warn' : 'danger'
          return (
            <div className="kp-row" key={item.knowledgePoint}>
              <div className="kp-head">
                <span className="kp-name">{item.knowledgePoint}</span>
                <span className="kp-val">
                  {item.got} / {item.total} 分 · {Math.round(item.accuracy)}%
                </span>
              </div>
              <div className={`bar ${level}`}>
                <i style={{ width: `${Math.max(4, item.accuracy)}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const center = size / 2
  const radius = size / 2 - 34
  const count = items.length

  const pointAt = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2
    return [center + Math.cos(angle) * radius * ratio, center + Math.sin(angle) * radius * ratio] as const
  }

  const polygon = items
    .map((item, index) => pointAt(index, Math.max(0.06, item.accuracy / 100)).join(','))
    .join(' ')

  const rings = [0.25, 0.5, 0.75, 1]

  return (
    <div style={{ width: '100%' }}>
      <svg
        width="100%"
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="知识点掌握度雷达图"
        style={{ display: 'block', maxHeight: size }}
      >
        <defs>
          <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {rings.map((ratio) => (
          <polygon
            key={ratio}
            points={items.map((_, index) => pointAt(index, ratio).join(',')).join(' ')}
            fill="none"
            stroke="#e6e8f0"
            strokeWidth={1}
          />
        ))}

        {items.map((item, index) => {
          const [x, y] = pointAt(index, 1)
          return (
            <line
              key={item.knowledgePoint}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#eceef6"
            />
          )
        })}

        <polygon points={polygon} fill="url(#radarFill)" stroke="#6366f1" strokeWidth={2} />

        {items.map((item, index) => {
          const [x, y] = pointAt(index, Math.max(0.06, item.accuracy / 100))
          return <circle key={`dot-${item.knowledgePoint}`} cx={x} cy={y} r={3} fill="#4f46e5" />
        })}
      </svg>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 14px',
          marginTop: 10,
          justifyContent: 'center',
        }}
      >
        {items.map((item) => (
          <span
            key={`legend-${item.knowledgePoint}`}
            style={{ fontSize: 11.5, color: 'var(--ink-500)', display: 'inline-flex', gap: 5 }}
          >
            <i
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#4f46e5',
                display: 'inline-block',
                marginTop: 5,
              }}
            />
            <span>
              {item.knowledgePoint}
              <b style={{ color: 'var(--ink-700)', marginLeft: 4 }}>{Math.round(item.accuracy)}%</b>
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
