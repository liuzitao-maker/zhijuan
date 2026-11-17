import type { KnowledgeStat } from '../lib/api'

/**
 * 纯 SVG 知识掌握度雷达图。
 * 不引入图表库 —— 少一个依赖，「10 分钟复现」就少一个失败点。
 */
export default function KnowledgeRadar({
  data,
  size = 300,
}: {
  data: KnowledgeStat[]
  size?: number
}) {
  const items = data.slice(0, 6)
  if (items.length < 3) {
    return (
      <div className="empty" style={{ padding: '20px 0' }}>
        <strong>数据不足</strong>
        完成 1 次测验、覆盖至少 3 个知识点后，这里会生成掌握度雷达图
      </div>
    )
  }

  const center = size / 2
  const radius = size / 2 - 52
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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="知识点掌握度雷达图">
      <defs>
        <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.22" />
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
        return <line key={item.knowledgePoint} x1={center} y1={center} x2={x} y2={y} stroke="#eceef6" />
      })}

      <polygon points={polygon} fill="url(#radarFill)" stroke="#6366f1" strokeWidth={2} />

      {items.map((item, index) => {
        const [x, y] = pointAt(index, 1.2)
        const anchor = Math.abs(x - center) < 12 ? 'middle' : x > center ? 'start' : 'end'
        return (
          <text
            key={`label-${item.knowledgePoint}`}
            x={x}
            y={y}
            textAnchor={anchor}
            fontSize={11}
            fill="#6a7088"
            dominantBaseline="middle"
          >
            {item.knowledgePoint.length > 7
              ? `${item.knowledgePoint.slice(0, 7)}…`
              : item.knowledgePoint}
            <tspan fill="#9aa0b5" fontSize={10}>
              {' '}
              {Math.round(item.accuracy)}%
            </tspan>
          </text>
        )
      })}
    </svg>
  )
}
