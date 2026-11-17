import { config } from './env.js'

/**
 * LLM 网关：对 DeepSeek（OpenAI 兼容）API 的统一封装。
 * 设计要点：
 *  1. 所有调用集中在此，便于统一重试、超时、计量。
 *  2. JSON 模式 + 本地兜底解析，模型输出脏数据时不至于整条流水线崩。
 *  3. 每次调用都记录 token 用量，前端可以展示成本。
 */

export class LlmError extends Error {
  constructor(message, { status, code } = {}) {
    super(message)
    this.name = 'LlmError'
    this.status = status
    this.code = code
  }
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504])

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 从模型输出里「挖」出 JSON 对象。
 * 模型经常会包 ```json 代码块、或在前后加解释文字，这里做容错。
 */
export function extractJson(text) {
  if (!text || typeof text !== 'string') throw new LlmError('模型返回为空')
  let source = text.trim()

  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) source = fenced[1].trim()

  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new LlmError('模型未返回合法 JSON 对象')
  }
  const slice = source.slice(start, end + 1)
  try {
    return JSON.parse(slice)
  } catch (error) {
    // 常见脏数据：尾随逗号
    const repaired = slice.replace(/,\s*([}\]])/g, '$1')
    try {
      return JSON.parse(repaired)
    } catch {
      throw new LlmError(`JSON 解析失败：${error.message}`)
    }
  }
}

/**
 * 调用对话补全接口。
 * @param {object} options
 * @param {Array<{role:string, content:string}>} options.messages
 * @param {boolean} [options.json] 是否要求 JSON 输出
 * @param {number} [options.temperature]
 * @param {number} [options.maxTokens]
 * @param {AbortSignal} [options.signal]
 */
export async function complete({
  messages,
  json = false,
  temperature = 0.7,
  maxTokens = 8000,
  signal,
  label = 'llm',
}) {
  const startedAt = Date.now()
  let lastError

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 120_000)
      const onAbort = () => controller.abort()
      signal?.addEventListener('abort', onAbort, { once: true })

      const body = {
        model: config.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }
      if (json) body.response_format = { type: 'json_object' }

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)

      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        const error = new LlmError(`HTTP ${response.status}：${detail.slice(0, 300)}`, {
          status: response.status,
        })
        if (RETRYABLE_STATUS.has(response.status) && attempt < 3) {
          lastError = error
          await sleep(attempt * 900)
          continue
        }
        throw error
      }

      const payload = await response.json()
      const content = payload?.choices?.[0]?.message?.content ?? ''
      const usage = payload?.usage ?? {}

      return {
        content,
        usage: {
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
        },
        latencyMs: Date.now() - startedAt,
        label,
      }
    } catch (error) {
      lastError = error
      if (error?.status === 401 || error?.status === 403) break
      if (attempt < 3) await sleep(attempt * 900)
    }
  }

  if (lastError?.status === 401 || lastError?.status === 403) {
    throw new LlmError('API Key 无效或权限不足，请检查 server/.env 里的 DEEPSEEK_API_KEY', {
      status: lastError.status,
    })
  }
  throw lastError instanceof LlmError
    ? lastError
    : new LlmError(`调用模型失败：${lastError?.message ?? '未知错误'}`)
}

export async function completeJson(options) {
  const result = await complete({ ...options, json: true })
  return { ...result, data: extractJson(result.content) }
}
