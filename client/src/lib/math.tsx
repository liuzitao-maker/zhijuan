import katex from 'katex'
import type { ReactNode } from 'react'

/**
 * 极简富文本渲染：支持 $行内公式$、$$块级公式$$、**加粗**。
 * 刻意不引入完整的 Markdown 依赖 —— 题目文本的格式需求很窄，
 * 自己实现反而更可控，也让「10 分钟复现」少一堆依赖。
 */

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string; display: boolean }

export function splitMath(input: string): Segment[] {
  const segments: Segment[] = []
  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: input.slice(lastIndex, match.index) })
    }
    if (match[1] !== undefined) {
      segments.push({ kind: 'math', value: match[1], display: true })
    } else {
      segments.push({ kind: 'math', value: match[2], display: false })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < input.length) {
    segments.push({ kind: 'text', value: input.slice(lastIndex) })
  }

  return segments
}

function renderEmphasis(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((piece, index) => {
    if (piece.startsWith('**') && piece.endsWith('**')) {
      return <strong key={`${keyPrefix}-b${index}`}>{piece.slice(2, -2)}</strong>
    }
    return <span key={`${keyPrefix}-t${index}`}>{piece}</span>
  })
}

export function RichText({ text }: { text: string }) {
  if (!text) return null
  const segments = splitMath(text)

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === 'math') {
          let html = ''
          try {
            html = katex.renderToString(segment.value, {
              throwOnError: false,
              displayMode: segment.display,
              output: 'html',
            })
          } catch {
            html = segment.value
          }
          return (
            <span
              key={`m${index}`}
              className={segment.display ? 'math-block' : undefined}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        }
        return (
          <span key={`t${index}`}>{renderEmphasis(segment.value, `s${index}`)}</span>
        )
      })}
    </>
  )
}

export const TYPE_LABELS: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  fill: '填空题',
  short: '简答题',
}

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}
