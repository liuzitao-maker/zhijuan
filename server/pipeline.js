import { completeJson } from './llm.js'
import { buildGenerateMessages, buildRepairMessages, buildReviewMessages } from './prompts.js'
import { normalizePaper, summarizePaper, validatePaper } from './paper-schema.js'

export const MAX_REPAIR_ROUNDS = 2

const emptyUsage = () => ({ promptTokens: 0, completionTokens: 0, totalTokens: 0 })

function mergeUsage(total, next) {
  total.promptTokens += next?.promptTokens ?? 0
  total.completionTokens += next?.completionTokens ?? 0
  total.totalTokens += next?.totalTokens ?? 0
  return total
}

/**
 * 「生成 → 本地校验 → 独立审题 → 修复」闭环流水线。
 *
 * 这是本项目的核心创新点：
 *  - 生成者与审查者是两个独立的模型调用，上下文互不共享（避免自审放水）。
 *  - 审查者被设定为敌对角色，默认假设有错。
 *  - 本地结构校验作为廉价前置关卡，先淘汰明显不合法的输出。
 *  - 只要审题不通过且未超轮次，就把问题清单回灌给修复 Agent，形成带反馈边的循环。
 *
 * @param {object} spec 命题需求
 * @param {{emit: (event: object) => void, signal?: AbortSignal}} context
 */
export async function runGenerationPipeline(spec, { emit, signal }) {
  const trace = []
  const usage = emptyUsage()
  let seq = 0

  const push = (event) => {
    const payload = { id: `t${++seq}`, at: Date.now(), ...event }
    trace.push(payload)
    emit?.(payload)
    return payload
  }

  let paper = null
  let lastIssues = []
  let review = null
  let round = 0

  push({
    stage: 'pipeline',
    status: 'running',
    title: '启动命题流水线',
    detail: `${spec.subject} · ${spec.topic} · ${spec.count} 题 · 总分 ${spec.totalPoints}`,
  })

  while (round <= MAX_REPAIR_ROUNDS) {
    round += 1

    // ── 1. 生成 / 修复 ──────────────────────────────────────────────
    const isRepair = round > 1 && paper !== null
    push({
      stage: isRepair ? 'repair' : 'generate',
      status: 'running',
      round,
      title: isRepair ? `第 ${round} 轮：修复 Agent 依据问题清单改写` : '出题 Agent 生成试卷',
      detail: isRepair ? `${lastIssues.length} 个待修复问题` : '正在命制题目…',
    })

    const startedAt = Date.now()
    const result = await completeJson({
      messages: isRepair
        ? buildRepairMessages(spec, paper, lastIssues)
        : buildGenerateMessages(spec),
      temperature: isRepair ? 0.4 : 0.85,
      maxTokens: 8000,
      signal,
      label: isRepair ? 'repair' : 'generate',
    })
    mergeUsage(usage, result.usage)

    const normalized = normalizePaper(result.data, spec)
    paper = normalized.paper
    const summary = summarizePaper(paper)

    push({
      stage: isRepair ? 'repair' : 'generate',
      status: 'passed',
      round,
      durationMs: Date.now() - startedAt,
      title: isRepair ? '修复完成' : '试卷生成完成',
      detail: `${summary.count} 题 · 总分 ${summary.totalPoints} · 用时 ${(Date.now() - startedAt) / 1000}s`,
      tokens: result.usage,
    })

    // ── 2. 本地结构校验（廉价关卡）────────────────────────────────
    const validation = validatePaper(paper, spec)
    const localIssues = [...normalized.issues, ...validation.issues]

    push({
      stage: 'validate',
      status: localIssues.length === 0 ? 'passed' : 'warn',
      round,
      title: '本地结构校验',
      detail:
        localIssues.length === 0
          ? '题型 / 选项 / 答案 / 分值 / 解析 全部通过'
          : `发现 ${localIssues.length} 处结构问题`,
      issues: localIssues,
    })

    // ── 3. 独立审题 Agent（昂贵关卡）──────────────────────────────
    push({
      stage: 'review',
      status: 'running',
      round,
      title: '独立审题 Agent 交叉复核',
      detail: '敌对视角：默认假设题目有错，逐题核查超纲/答案/歧义',
    })

    const reviewStartedAt = Date.now()
    const reviewResult = await completeJson({
      messages: buildReviewMessages(spec, paper, { round }),
      temperature: 0.15,
      maxTokens: 4000,
      signal,
      label: 'review',
    })
    mergeUsage(usage, reviewResult.usage)

    const rawReview = reviewResult.data ?? {}
    const issues = Array.isArray(rawReview.issues) ? rawReview.issues : []
    // 收敛策略：第 1 轮 blocker 与 major 都阻断；后续轮次只让 blocker 阻断，
    // 避免陷入「审题者不断提出新的风格建议 → 永远无法通过」的死循环。
    const blocking = issues.filter(
      (issue) =>
        issue?.severity === 'blocker' || (round === 1 && issue?.severity === 'major'),
    )
    const passed = rawReview.passed === true && blocking.length === 0

    review = {
      passed,
      issues,
      summary: String(rawReview.summary ?? ''),
      rounds: round,
    }

    push({
      stage: 'review',
      status: passed ? 'passed' : 'failed',
      round,
      durationMs: Date.now() - reviewStartedAt,
      title: passed ? '审题通过' : '审题未通过',
      detail: passed
        ? String(rawReview.summary ?? '未发现阻断性问题')
        : `${blocking.length} 个阻断性问题：${blocking
            .map((issue) => `${issue.questionId ?? '?'} ${issue.category ?? ''}`)
            .slice(0, 4)
            .join('；')}`,
      issues,
    })

    if (passed) break

    lastIssues = blocking.length > 0 ? blocking : issues
    if (round > MAX_REPAIR_ROUNDS) {
      push({
        stage: 'pipeline',
        status: 'warn',
        round,
        title: '达到最大修复轮次',
        detail: `已修复 ${MAX_REPAIR_ROUNDS} 轮仍有问题，保留当前版本交付，并在试卷上标记「待人工复核」`,
      })
      break
    }
  }

  push({
    stage: 'done',
    status: review?.passed ? 'passed' : 'warn',
    title: '流水线完成',
    detail: `共 ${round} 轮 · 累计 ${usage.totalTokens} tokens`,
    tokens: usage,
  })

  return {
    paper,
    review,
    trace,
    usage,
    rounds: round,
  }
}
