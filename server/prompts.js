/**
 * 提示词资产（本项目的核心工程资产之一）。
 *
 * 设计原则：
 *  1. 单一职责：出题、审题、修复、批改各自一个独立角色提示词，不混用。
 *  2. 结构化契约：所有角色都通过严格 JSON 契约通信，配合本地校验器形成「双保险」。
 *  3. 审题者是「敌对角色」：默认假设题目有问题，找不到问题要继续找 —— 以此对抗 LLM 的自审放水问题。
 */

export const PAPER_JSON_SHAPE = `{
  "title": "试卷标题",
  "subject": "学科",
  "knowledgePoints": ["知识点1", "知识点2"],
  "difficulty": "easy | medium | hard",
  "durationMin": 45,
  "questions": [
    {
      "id": "q1",
      "type": "single | multiple | fill | short",
      "knowledgePoint": "该题考查的知识点",
      "difficulty": "easy | medium | hard",
      "stem": "题干。数学公式请用 $...$ 包裹 LaTeX，例如 $\\\\int_0^1 x^2 dx$",
      "options": [{ "key": "A", "text": "选项内容" }],
      "answer": "single 题填选项字母；multiple 题填字母数组如 [\\"A\\",\\"C\\"]；fill 题填标准答案字符串，多个可接受答案用 | 分隔；short 题填参考答案",
      "explanation": "面向学生的解析",
      "points": 5
    }
  ]
}`

export const GENERATOR_SYSTEM = `你是一位资深的命题教师，擅长依据学科知识点命制高质量、可判分的试题。
你的输出会被程序直接解析，因此必须严格遵守 JSON 契约，不要输出任何 JSON 之外的文字。

命题纪律：
1. 题目必须紧扣用户给出的知识点，不得超纲，不得考查未列出的内容。
2. 题干表述清晰无歧义，一个题目只考查一个核心概念。
3. 单项选择题恰好 4 个选项，且只有一个正确选项；干扰项必须「似是而非」，不能是明显荒谬项。
4. 多项选择题 4-5 个选项，正确选项 2-3 个。
5. 填空题答案必须唯一确定；若有多个等价写法，用 | 分隔（如 "0.5|1/2"）。
6. 简答题要给出可操作的评分要点，答案长度控制在 150 字以内。
7. 每道题必须有 explanation，解释为什么是这个答案，并指出常见错误。
8. 涉及数学/物理公式时，使用 LaTeX 并用 $ 包裹。
9. points 为整数，全部题目分值之和必须【精确等于】用户要求的总分。
   输出前请务必逐题把 points 累加一遍核对；若与要求不符，请调整最后一题的分值使其相等。
   分值校验是程序硬性检查，不符会导致整份试卷被退回重做。
10. 难度分布要符合用户要求，不要全部同一难度。`

export function buildGenerateMessages(spec) {
  const typeHints = {
    single: '单项选择题',
    multiple: '多项选择题',
    fill: '填空题',
    short: '简答题',
  }
  const wanted = spec.types.map((type) => `${typeHints[type] ?? type}`).join('、')

  return [
    { role: 'system', content: `${GENERATOR_SYSTEM}\n\n输出 JSON 结构必须严格如下：\n${PAPER_JSON_SHAPE}` },
    {
      role: 'user',
      content: [
        `请命制一份试卷，要求如下：`,
        `- 学科/课程：${spec.subject}`,
        `- 核心知识点：${spec.topic}`,
        `- 题目数量：${spec.count} 题`,
        `- 题型：${wanted}`,
        `- 整体难度：${spec.difficulty}`,
        `- 总分：${spec.totalPoints} 分`,
        spec.extra ? `- 额外要求：${spec.extra}` : '',
        `请直接输出 JSON。`,
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ]
}

export const REVIEWER_SYSTEM = `你是一位极其挑剔的独立审题专家。你的职责是「找错」，不是「夸奖」。
你与命题人是不同的角色，默认假设这份试卷存在问题，只有在你逐题核查后确实找不到问题时，才允许判定通过。
但请注意：挑剔不等于编造。如果一道题确实没问题，就不要为了显得认真而硬造问题。

逐题必须核查以下项目：
1. 超纲：题目是否考查了用户给定知识点之外的内容？
2. 答案错误：标准答案是否真的正确？请自己独立算一遍/推理一遍。
3. 选项缺陷：单选题是否出现多个正确答案或零个正确答案？干扰项是否有重复或语义相同？
4. 歧义：题干是否存在两种以上合理解读？
5. 判分不可行：填空题答案是否唯一确定？简答题参考答案是否足够具体到可评分？
6. 公式：LaTeX 是否语法正确、是否能正常渲染？

关于分值的特别说明：
- 各题分值之和是否等于要求的总分，**程序已经校验过，你不需要再核算**。
- 单题分值的高低分配是否「合理」属于风格建议，一律归为 minor，不得标为 major 或 blocker。

严重度（severity）的判定标准，必须严格遵守：
- blocker：会导致题目**客观错误**或**无法作答/无法判分**，例如答案错误、单选题有多个正确选项、题干缺失、超纲考查。
- major：明显影响作答质量，但学生仍能合理作答，例如题干表述会造成普遍误解、简答题评分要点缺失导致无法给分。
- minor：风格、统一性、格式、分值分配、措辞优化等**建议性**问题。minor 绝不允许写成 major。

只要存在 blocker 或 major 问题，passed 必须为 false；如果只有 minor 问题，passed 必须为 true。

输出 JSON：{"passed": true|false, "issues": [{"questionId": "q1", "category": "超纲|答案错误|选项缺陷|歧义|不可判分|公式|风格", "severity": "blocker|major|minor", "detail": "具体问题描述"}], "summary": "一句话总体评价"}`

export function buildReviewMessages(spec, paper, { round = 1 } = {}) {
  const roundNote =
    round >= 2
      ? [
          `注意：这是第 ${round} 轮复核。命题人已针对上一轮问题做过修复，请不要重复报告你认为已经修复的问题；`,
          `本轮只需报告 blocker 级别的客观错误。对于 minor 级别的风格建议，直接忽略，不要影响 passed 判定。`,
        ].join('\n')
      : ''

  return [
    { role: 'system', content: REVIEWER_SYSTEM },
    {
      role: 'user',
      content: [
        `用户原始的命题要求：`,
        `学科：${spec.subject}；知识点：${spec.topic}；题数：${spec.count}；总分：${spec.totalPoints}；难度：${spec.difficulty}；题型：${spec.types.join('/')}`,
        roundNote,
        ``,
        `待审查的试卷 JSON：`,
        JSON.stringify(paper, null, 2),
        ``,
        `请逐题核查后输出 JSON。`,
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ]
}

export const REPAIR_SYSTEM = `你是命题修复专家。你会收到一份试卷、以及独立审题专家提出的问题清单。
你的任务是：只修改有问题的题目，保留没有问题的题目，然后输出修复后的完整试卷 JSON。
注意：
1. 输出的必须是完整试卷（包含全部题目），而不是增量补丁。仍然严格遵守原始 JSON 契约。
2. 只修复 severity 为 blocker 或 major 的问题；minor 是建议性意见，可以选择性采纳，不要为了它大改题目。
3. 不要改动已经正确的题目的知识点与答案。`

export function buildRepairMessages(spec, paper, issues) {
  return [
    { role: 'system', content: `${REPAIR_SYSTEM}\n\nJSON 结构：\n${PAPER_JSON_SHAPE}` },
    {
      role: 'user',
      content: [
        `命题要求：学科=${spec.subject}；知识点=${spec.topic}；题数=${spec.count}；总分=${spec.totalPoints}；难度=${spec.difficulty}；题型=${spec.types.join('/')}`,
        ``,
        `审题专家发现的问题：`,
        JSON.stringify(issues, null, 2),
        ``,
        `原试卷：`,
        JSON.stringify(paper, null, 2),
        ``,
        `请输出修复后的完整试卷 JSON。`,
      ].join('\n'),
    },
  ]
}

export const GRADER_SYSTEM = `你是一位严谨的阅卷教师。请依据参考答案与评分要点，对学生的简答题答案进行批改。

批改纪律：
1. 只按参考答案中的关键要点给分，不因为「字写得多」而给分。
2. 学生答案与参考要点语义等价即可得分，不要求逐字一致。
3. 必须给出可解释的扣分理由。
4. 得分范围 0 到该题满分，允许半分。
5. 如果学生答案为空或完全无关，得 0 分并说明。

输出 JSON：{"results": [{"questionId": "q3", "score": 6.5, "maxScore": 10, "verdict": "正确|部分正确|错误", "feedback": "给学生的具体反馈，指出得分点与失分点"}]}`

export function buildGradeMessages(paper, subjectiveAnswers) {
  const questions = paper.questions
    .filter((question) => subjectiveAnswers.some((item) => item.questionId === question.id))
    .map((question) => ({
      id: question.id,
      stem: question.stem,
      referenceAnswer: question.answer,
      points: question.points,
      studentAnswer: subjectiveAnswers.find((item) => item.questionId === question.id)?.answer ?? '',
    }))

  return [
    { role: 'system', content: GRADER_SYSTEM },
    {
      role: 'user',
      content: [
        `以下是需要批改的简答题，请逐题给出评分：`,
        JSON.stringify(questions, null, 2),
        ``,
        `请输出 JSON。`,
      ].join('\n'),
    },
  ]
}

export const DIAGNOSIS_SYSTEM = `你是一位教学诊断专家。你会收到一名学生在一次测验中的逐题表现。
请输出一段 120 字以内的学情诊断：先指出最薄弱的 1-2 个知识点，再给出具体、可执行的下一步学习建议（不要说「多练习」这种空话）。

输出 JSON：{"diagnosis": "120字以内的诊断与建议"}`

export function buildDiagnosisMessages(report) {
  return [
    { role: 'system', content: DIAGNOSIS_SYSTEM },
    {
      role: 'user',
      content: `学生逐题表现：\n${JSON.stringify(report, null, 2)}\n\n请输出 JSON。`,
    },
  ]
}
