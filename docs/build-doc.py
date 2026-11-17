# -*- coding: utf-8 -*-
"""
生成《智卷 · 技术文档》Word 文件。
运行：python docs/build-doc.py
之后用 Word COM 转 PDF。
"""
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SHOTS = os.path.join(HERE, "shots")
OUT = os.path.join(HERE, "智卷-技术文档.docx")

SERIF = "宋体"
SANS = "黑体"
ACCENT = RGBColor(0x3B, 0x3F, 0xBF)

doc = Document()

# ── 页面设置 ─────────────────────────────────────────────────────────
section = doc.sections[0]
section.page_width = Cm(21.0)
section.page_height = Cm(29.7)
section.top_margin = Cm(2.4)
section.bottom_margin = Cm(2.2)
section.left_margin = Cm(2.8)
section.right_margin = Cm(2.6)


def set_run_font(run, name, size, bold=False, color=None):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    if color is not None:
        run.font.color.rgb = color
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:eastAsia"), name)
    rfonts.set(qn("w:ascii"), name)
    rfonts.set(qn("w:hAnsi"), name)


def para(text="", size=10.5, bold=False, name=SERIF, indent=True,
         align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_before=0, space_after=6,
         line=1.5, color=None):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = line
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.alignment = align
    if indent:
        p.paragraph_format.first_line_indent = Pt(size * 2)
    run = p.add_run(text)
    set_run_font(run, name, size, bold, color)
    return p


def h1(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after = Pt(10)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    set_run_font(run, SANS, 16, True, ACCENT)
    # 标题使用内置 Heading 1 大纲级别，便于自动生成目录
    p.style = doc.styles["Heading 1"]
    for r in p.runs:
        set_run_font(r, SANS, 16, True, ACCENT)
    return p


def h2(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    p.style = doc.styles["Heading 2"]
    run = p.add_run(text)
    set_run_font(run, SANS, 13, True, RGBColor(0x14, 0x16, 0x1F))
    return p


def bullet(text, size=10.5):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.left_indent = Pt(18)
    p.paragraph_format.first_line_indent = Pt(-10)
    run = p.add_run("· " + text)
    set_run_font(run, SERIF, size)
    return p


def code_block(text):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.left_indent = Pt(14)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), "F3F4FA")
    p._p.get_or_add_pPr().append(shading)
    run = p.add_run(text)
    set_run_font(run, "Consolas", 9)
    return p


def shade_cell(cell, color="E8EAF6"):
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), color)
    tcpr.append(shd)


def table(headers, rows, widths=None, size=9.5):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = t.rows[0].cells
    for i, text in enumerate(headers):
        hdr[i].text = ""
        p = hdr[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(text)
        set_run_font(run, SANS, size, True)
        shade_cell(hdr[i])
    for row in rows:
        cells = t.add_row().cells
        for i, text in enumerate(row):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            p.paragraph_format.line_spacing = 1.25
            run = p.add_run(str(text))
            set_run_font(run, SERIF, size)
    if widths:
        for i, width in enumerate(widths):
            for row in t.rows:
                row.cells[i].width = Cm(width)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    return t


def caption(text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(12)
    run = p.add_run(text)
    set_run_font(run, SERIF, 9)
    run.font.color.rgb = RGBColor(0x6A, 0x70, 0x88)

def image(name, width_cm=15.2):
    path = os.path.join(SHOTS, name)
    if not os.path.exists(path):
        return
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(path, width=Cm(width_cm))


def page_break():
    doc.add_page_break()


def add_toc():
    p = doc.add_paragraph()
    run = p.add_run()
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = 'TOC \\o "1-2" \\h \\z \\u'
    fld_sep = OxmlElement("w:fldChar")
    fld_sep.set(qn("w:fldCharType"), "separate")
    hint = OxmlElement("w:t")
    hint.text = "（在 Word 中右键“更新域”生成目录）"
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run._r.append(fld_begin)
    run._r.append(instr)
    run._r.append(fld_sep)
    run._r.append(hint)
    run._r.append(fld_end)


def add_footer_page_number():
    footer = doc.sections[0].footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.text = "PAGE"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr)
    run._r.append(end)
    set_run_font(run, SERIF, 9)


# 正文默认样式
normal = doc.styles["Normal"]
normal.font.name = SERIF
normal.font.size = Pt(10.5)
normal.element.rPr.rFonts.set(qn("w:eastAsia"), SERIF)

add_footer_page_number()

# ══════════════════════════════════════════════════════════════════════
# 封面
# ══════════════════════════════════════════════════════════════════════
for _ in range(4):
    doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run("智  卷")
set_run_font(run, SANS, 36, True, ACCENT)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run("AI 智能出卷与批改引擎")
set_run_font(run, SANS, 20, True)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(10)
run = p.add_run("让 AI 出题，也让 AI 互相监考")
set_run_font(run, SERIF, 12)
run.font.color.rgb = RGBColor(0x6A, 0x70, 0x88)

doc.add_paragraph()
doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run("技 术 文 档")
set_run_font(run, SANS, 15, True)

for _ in range(6):
    doc.add_paragraph()

info = [
    ("参赛赛道", "AI 创新应用挑战赛 · 个人赛"),
    ("参赛组别", "A 组"),
    ("参赛编号", "2124074"),
    ("参赛姓名", "刘子豪"),
    ("所属院校", "宜春学院"),
    ("所属专业", "计算机技术"),
    ("完成时间", "2026 年 11 月"),
]
t = doc.add_table(rows=0, cols=2)
t.alignment = WD_TABLE_ALIGNMENT.CENTER
for key, value in info:
    cells = t.add_row().cells
    cells[0].width = Cm(4)
    cells[1].width = Cm(7)
    p0 = cells[0].paragraphs[0]
    p0.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r0 = p0.add_run(key + "：")
    set_run_font(r0, SANS, 11, False)
    p1 = cells[1].paragraphs[0]
    r1 = p1.add_run(value)
    set_run_font(r1, SERIF, 11)

page_break()

# ══════════════════════════════════════════════════════════════════════
# 目录
# ══════════════════════════════════════════════════════════════════════
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run("目  录")
set_run_font(run, SANS, 18, True)
doc.add_paragraph()
add_toc()
page_break()

# ══════════════════════════════════════════════════════════════════════
# 一、项目概述
# ══════════════════════════════════════════════════════════════════════
h1("一、项目概述")

h2("1.1 问题背景")
para("在高校教学场景中，命题是一项高频但低产出的劳动。教师命制一份合格的单元测试卷，通常需要 1 到 2 小时：从题库或教材中挑选题目、根据学情调整难度、配置分值、撰写解析，最后还要逐题检查是否超纲、是否存在两个正确答案、填空题答案是否唯一。")
para("而在学生一侧，做完练习往往只能拿到一个分数。真正有价值的信息——「我在哪个知识点上失分」「这一步为什么错」「接下来该补什么」——通常要等到课堂上老师讲解，或者根本得不到。")
para("两端的问题指向同一个结构：命题与反馈都是「重度依赖人工判断」的环节。而近两年大语言模型能力的变化，使得这两个环节第一次具备了被工程化改造的可能。")

h2("1.2 项目目标")
para("本项目构建一个完整的「知识点 → 试卷 → 作答 → 批改 → 诊断」闭环，输入一个知识点，输出一份可立即作答的试卷，作答后自动拿到分数、逐题反馈与学情诊断。")
para("但本项目真正要解决的技术问题并不是「让大模型生成一份卷子」——那只需要一段提示词。真正的问题是：", indent=True)
bullet("大模型生成的结构化内容不可靠，格式、答案、分值经常出错；")
bullet("让同一个模型审查自己的输出，它几乎必然给出「这份试卷很好」的评价；")
bullet("即使发现问题，如何让它在有限轮次内真正修复，而不是无限循环。")
para("本项目的核心贡献，就是针对这三个问题设计并实现了一条「双智能体互检流水线」，把不可靠的模型输出转化为可交付的教学产品。")

h2("1.3 术语约定")
table(
    ["术语", "含义"],
    [
        ["智能体（Agent）", "具备角色提示词、可调用工具、能完成单一职责的模型实例"],
        ["互检流水线", "生成者与审查者上下文完全隔离，审查结果以问题清单形式回灌生成者的闭环"],
        ["trace（轨迹）", "流水线每一步的结构化事件，包含阶段、状态、耗时、问题清单"],
        ["SSE", "Server-Sent Events，服务端单向流式推送"],
        ["分层批改", "客观题用确定性代码判分，主观题才调用模型"],
    ],
    widths=[4, 11],
)

page_break()

# ══════════════════════════════════════════════════════════════════════
# 二、需求分析
# ══════════════════════════════════════════════════════════════════════
h1("二、需求分析")

h2("2.1 目标用户与使用场景")
table(
    ["角色", "核心场景", "真实痛点"],
    [
        ["高校教师 / 助教", "为某一章节快速出一份随堂测验", "出卷耗时，重复劳动多，还要保证不超纲"],
        ["学生", "针对薄弱知识点做定向练习", "刷题缺反馈，不知道自己错在哪一步"],
        ["自学者", "输入一个知识点，自测掌握程度", "没有现成的题目和解析，缺少学情视角"],
    ],
    widths=[3.6, 5.2, 6.2],
)

h2("2.2 功能需求")
table(
    ["编号", "需求", "优先级"],
    [
        ["F1", "按学科、知识点、题数、总分、难度、题型组合生成试卷", "P0"],
        ["F2", "生成过程对用户可见，每一步都说明「谁在工作、发现了什么」", "P0"],
        ["F3", "试卷需通过独立的自动审题，未通过要被自动修复", "P0"],
        ["F4", "支持单选、多选、填空、简答四种题型，题干支持数学公式", "P0"],
        ["F5", "在线作答，作答进度可见", "P0"],
        ["F6", "客观题自动判分，简答题按评分要点判分", "P0"],
        ["F7", "输出知识点掌握度与学情诊断", "P1"],
        ["F8", "历史试卷与作答记录沉淀", "P1"],
    ],
    widths=[1.8, 11, 2.2],
)

h2("2.3 非功能需求")
para("在这些硬性指标之外，本项目为自己加了两条非功能约束，它们深刻影响了后续所有技术决策：")
bullet("10 分钟极速复现：任何人克隆仓库后，十分钟内必须能跑通完整闭环。这条约束直接排除了数据库、复杂构建链与多余依赖。")
bullet("过程可复现：每一次代码变更都必须对应一次可解释的意图，Git 历史必须细粒度；每一次方案调整都必须能追溯到具体的问题证据。")

page_break()

# ══════════════════════════════════════════════════════════════════════
# 三、总体设计
# ══════════════════════════════════════════════════════════════════════
h1("三、总体设计")

h2("3.1 系统架构")
para("系统采用前后端分离的单仓结构，前端负责交互与渲染，后端负责模型编排、校验与持久化。两者通过 HTTP 通信，生成过程使用 SSE 流式推送。")
code_block(
"""┌────────────────────────── 浏览器 ──────────────────────────┐
│  React 18 + TypeScript + React Router + KaTeX              │
│  fetch + ReadableStream 手工解析 SSE（支持 POST 流式）      │
└──────────────────────────────┬─────────────────────────────┘
                               │ HTTP / SSE
┌──────────────────────────────▼─────────────────────────────┐
│                      Express（Node.js）                     │
│  routes ──► pipeline ──► prompts ──► llm ──► DeepSeek API  │
│              │                                                │
│              ├──► paper-schema（本地结构校验）                │
│              ├──► grading（分层批改）                         │
│              └──► store（JSON 文件持久化）                    │
└──────────────────────────────────────────────────────────────┘"""
)
para("架构上刻意保持「一个请求一条链路」：生成接口内部完成「出题 → 校验 → 审题 → 修复」的全部编排，中途不落库、不依赖消息队列。这样做的代价是单请求耗时较长，收益是链路极其清晰、失败可整体回滚。对于本项目这种单机 / 演示定位，这个取舍是正确的。")

h2("3.2 技术选型")
table(
    ["层次", "选型", "选择理由"],
    [
        ["前端框架", "React 18 + TypeScript", "生态成熟、类型安全、组件化适合多页面状态管理"],
        ["构建工具", "Vite 5", "冷启动快，配置简单，利于「10 分钟复现」"],
        ["路由", "React Router 6", "五个页面需要真实 URL，便于演示与刷新"],
        ["公式渲染", "KaTeX", "数学题目必需，且体积小、渲染快"],
        ["后端", "Express 4", "轻量、零配置，原生支持 SSE"],
        ["模型", "DeepSeek Chat", "中文命题质量好，OpenAI 兼容协议便于替换"],
        ["持久化", "JSON 文件", "避免数据库安装与迁移，保证复现速度"],
        ["图表", "手写 SVG", "少一个依赖就少一个复现失败点"],
    ],
    widths=[2.6, 4.2, 8.2],
)

h2("3.3 数据模型")
para("系统只有三个核心实体，通过 id 关联：")
code_block(
"""Paper（试卷）
  id, title, subject, knowledgePoints[], difficulty, durationMin,
  questions: Question[],
  totalPoints,                       // 由题目分值求和，不作为模型输出信任
  review: { passed, issues[], summary, rounds },
  pipelineTrace: TraceEvent[],       // 完整流水线轨迹，可回溯
  usage: { promptTokens, completionTokens, totalTokens }

Question（题目）
  id, type(single|multiple|fill|short), knowledgePoint, difficulty,
  stem, options: {key,text}[], answer, explanation, points

Attempt（作答记录）
  id, paperId, paperTitle, answers[],
  score, totalPoints, accuracy,
  results: { questionId, score, maxScore, verdict, feedback }[],
  knowledgeStats: { knowledgePoint, got, total, accuracy }[],
  diagnosis"""
)
para("一个值得说明的细节：totalPoints 不采信模型输出，而是由服务端对 questions 求和后再写回。凡是「能算出来的东西就不问模型」，这是本项目贯穿始终的原则。")

h2("3.4 接口设计")
table(
    ["方法", "路径", "说明"],
    [
        ["GET", "/api/health", "服务状态、模型信息、Key 是否配置"],
        ["POST", "/api/papers/generate", "SSE 生成试卷，逐步推送 trace 事件"],
        ["GET", "/api/papers", "试卷列表（摘要字段）"],
        ["GET", "/api/papers/:id", "试卷详情，含 pipelineTrace"],
        ["DELETE", "/api/papers/:id", "删除试卷"],
        ["POST", "/api/attempts", "提交作答并批改"],
        ["GET", "/api/attempts", "作答记录列表"],
        ["GET", "/api/attempts/:id", "作答详情，含逐题批改结果"],
        ["GET", "/api/overview", "学情总览与知识点统计"],
    ],
    widths=[1.8, 6.2, 8],
)

page_break()

# ══════════════════════════════════════════════════════════════════════
# 四、核心机制
# ══════════════════════════════════════════════════════════════════════
h1("四、核心机制：双智能体互检流水线")

h2("4.1 问题：模型自审必然放水")
para("最初的设计很朴素：一次调用，让模型既出题又检查。实测结果非常一致——它永远说「这份试卷没有问题」。")
para("这不是模型在偷懒，而是机制决定的：同一段上下文里，模型已经「论证」过自己的答案，再让它审查，它倾向于维护已有结论。这与人类的行为高度相似：自己写的代码，自己 review 时往往看不出问题。")
para("因此，本项目把「生成」与「审查」拆成两次完全独立的调用：不同的系统提示词、不同的上下文、不同的采样温度。审查者不知道生成者的推理过程，只能面对最终产物逐题核算。")

h2("4.2 流水线结构")
code_block(
"""命题需求
   │
   ▼
① 出题 Agent          temperature 0.85，创造性命题
   │
   ▼
② 本地结构校验        确定性代码，零成本，先淘汰明显非法输出
   │
   ▼
③ 独立审题 Agent      temperature 0.15，敌对视角，逐题核算
   │
   ├── 通过 ──► 交付试卷
   │
   └── 未通过 ──► ④ 修复 Agent ──► 回到 ②（最多 2 轮）"""
)
para("三个阶段的设计意图分别是：")
bullet("出题阶段用较高温度换取题目多样性，此时正确性由后续环节兜底，不需要它一次做对。")
bullet("结构校验是「廉价关卡」：题型是否合法、选项是否齐全、答案是否落在选项内、分值之和是否匹配、解析是否存在。这些都是确定性判断，成本近乎为零，却能在调用昂贵的审题模型之前挡掉大部分脏输出。")
bullet("审题阶段用极低温度换取稳定性，并以敌对视角提示词要求它「默认假设有问题」。")

h2("4.3 收敛与终止")
para("反馈环最大的风险是死循环。项目实现中设置了三道闸门：")
table(
    ["闸门", "机制", "作用"],
    [
        ["轮次上限", "MAX_REPAIR_ROUNDS = 2，即初次 + 最多 2 次修复", "硬性限制成本上限"],
        ["严重度收敛", "第 1 轮 blocker 与 major 均阻断；第 2 轮起仅 blocker 阻断", "避免审题者不断提出新的风格建议导致永不可通过"],
        ["降级交付", "达到上限仍未通过时，交付当前版本并在试卷上标记「待人工复核」", "保证用户总能拿到产物，而不是一个错误"],
    ],
    widths=[2.4, 7.4, 6.2],
)
para("这里的「严重度收敛」是一次真实的工程迭代，详见 6.3 节。它把「让 AI 更聪明地挑错」这个无底洞，转化成了「让 AI 只对客观错误负责」这个有界问题。")

h2("4.4 严重度规范")
para("审题结果中的每个问题都带严重度，判定标准被写死在提示词中，并用工程手段强制执行：")
table(
    ["严重度", "定义", "典型例子"],
    [
        ["blocker", "导致题目客观错误或无法作答/判分", "答案错误、单选有多个正确项、题干缺失、超纲"],
        ["major", "明显影响质量，但学生仍能合理作答", "题干造成普遍误解、简答题评分要点缺失"],
        ["minor", "风格、统一性、格式、分值分配等建议", "答案未用 LaTeX 书写、单题分值略高"],
    ],
    widths=[2.2, 7, 6.8],
)
para("提示词中明确写入了反向约束：「minor 绝不允许写成 major」「不要为了显得认真而硬造问题」。这是对抗模型「过度表现」倾向的必要手段。")

h2("4.5 为什么说「验证比生成便宜」")
para("整套设计背后有一条判断：在这类任务里，验证一个结果的正确性，远比生成一个正确结果容易。")
para("写一道极限题很难，但检查「这个极限算得对不对」只需要自己算一遍；检查「单选题是否有两个正确答案」只需要比对选项与答案；检查「分值总和是否等于 100」只需要加法。正因为验证更便宜，流水线才有存在的意义——它用廉价验证去提升昂贵生成的可靠性。")
para("这也是本项目拒绝「让模型自己检查自己」的根本原因：那等于用同样昂贵的成本做一件本可以更便宜、更可靠的事。")

h2("4.6 本地硬校验的一票否决与确定性归位")
para("首次实现中，本地结构校验产出的问题只被当作「提示」，并不具备阻断能力。多学科回归测试立刻暴露了这个漏洞：概率论的一份试卷要求 60 分，实际只有 52 分，而审题提示词里又明确告知审题者「总分已由程序校验，不需要你核算」——两边都不管，错误直接交付到了用户手里。")
para("修复采用双管齐下的思路：")
bullet("一票否决：交付条件改为「审题通过 且 本地硬校验通过」。在流水线末尾再加一道闸门，结构不合法就绝不标记为「通过」，并在试卷上标注待复核。")
bullet("确定性归位：分值加总本质是算术问题，不需要花一轮模型修复。归一化阶段直接从分值最大的题开始吸收差值，把总和精确调整到目标值，并保证每题不低于 1 分。")
para("第二条修复带来的收益是直接的：同类问题的处理成本从「一轮模型调用（约 8 秒、4000 tokens）」降到「零成本」。这再次印证了本项目的核心判断——凡是能算清楚的，就不要交给模型。")
para("修复前后对比（概率论 · 条件概率与贝叶斯公式）：")
table(
    ["指标", "修复前", "修复后"],
    [
        ["分值是否正确", "52 / 60（错误交付）", "60 / 60（自动归位）"],
        ["审题轮次", "2 轮", "1 轮"],
        ["耗时", "18.7 s", "9.6 s"],
        ["token 消耗", "13,143", "5,067"],
    ],
    widths=[3.6, 5.8, 5.6],
)

h2("4.7 审题契约的第二次迭代：从自由文本到逐题二元裁定")
para("4.6 节修复了「程序不把关」的问题，但紧接着又暴露了另一个更隐蔽的缺陷：审题者会自相矛盾。")
para("最初的审题输出契约是 {passed, issues[]}，每条 issue 带一段自由文本 detail。实测中反复出现这样的输出——")
code_block(
'''{
  "passed": false,
  "issues": [{
    "questionId": "q1",
    "severity": "blocker",
    "detail": "……经复核本题无问题，三个反例均成立，不构成 blocker。"
  }]
}'''
)
para("模型在自己的 detail 里已经论证了「这道题没问题」，却仍然把 severity 标成 blocker、把 passed 置为 false。结果是：一份本可以交付的试卷被反复打回，修复智能体也无从下手（因为根本没有真实的错误可改），三轮烧掉一万五千 tokens 仍然不收敛。")
para("根因不在模型「不聪明」，而在输出契约给了它模糊表达的空间：自由文本既可以描述问题，也可以承载思考过程，模型于是在后者里写完了结论，却在前者里留下了旧判断。")
para("修复方案是把契约改造成强制二元裁定：")
bullet("审题输出改为 verdicts[]，每道题必须出现且只出现一次，字段固定为 {questionId, ok, category, severity, evidence}。")
bullet("ok=true 时，category 与 severity 必须是 none，evidence 必须为空字符串。")
bullet("ok=false 时，evidence 必须写出可被第三方核对的错误证据（例如「正确后序序列应为 DEBFCA，选项 A 是 DEBCFA」）；写不出证据，就说明并没有真正发现问题，必须把 ok 设为 true。")
bullet("禁止在 evidence 中写推理过程或改口；一旦出现「经复核其实没问题」，该题就应当改为 ok=true。")
para("程序侧也做了配套加固：不再信任模型给出的布尔结论，而是依据逐题裁定与严重度重新计算是否通过；如果模型返回的结构里既没有 verdicts 也没有 issues，则判定为审题异常并重试，而不是静默放过。")
para("同一用例的对比（数据结构 · 二叉树遍历与性质，6 题）：")
table(
    ["指标", "旧契约", "新契约"],
    [
        ["审题结果", "3 轮仍未通过（假阳性）", "1 轮通过"],
        ["token 消耗", "15,476", "4,482"],
        ["三学科回归总耗时", "48.5 s", "37.8 s"],
        ["三学科回归通过率", "2 / 3", "3 / 3"],
    ],
    widths=[4, 6, 5],
)
para("这一轮迭代说明了一个更普遍的规律：当模型表现不稳定时，与其反复调提示词措辞，不如收紧输出契约的结构约束——把「请你想清楚再说」变成「你必须逐项给出可核对的判断」。前者依赖模型的自觉，后者把责任交给了可验证的数据结构。")

page_break()

# ══════════════════════════════════════════════════════════════════════
# 五、分层批改
# ══════════════════════════════════════════════════════════════════════
h1("五、分层批改机制")
para("批改环节沿用了与出卷相同的判断：能算清楚的地方，绝不交给模型。")
table(
    ["题型", "判分方式", "理由"],
    [
        ["单选题", "字符串比对（大写归一）", "完全确定"],
        ["多选题", "集合比对；漏选给一半分，错选 0 分", "完全确定，且符合常见考试规则"],
        ["填空题", "归一化后与多个可接受答案比对（支持 a|b 写法）", "完全确定"],
        ["简答题", "LLM 依据参考答案与评分要点给分", "需要语义理解，无法用规则穷举"],
    ],
    widths=[2.2, 8, 5.8],
)
para("归一化处理包括：去除首尾与内部空白、转小写、全角标点转半角。填空题答案支持「|」分隔多个等价写法，例如 0.5|1/2，由归一化后逐项比对。")
para("简答题批改要求模型输出结构化结果，且必须给出可解释的扣分理由。服务端会对模型返回的分数做二次裁剪（限制在 0 到该题满分之间，且以 0.5 分为粒度），防止模型给出越界分数。")
para("若简答题批改调用失败，系统不会整体报错，而是将该题标记为「待复核」并给出 0 分与失败原因，保证用户仍能拿到其余题目的批改结果。这是本项目统一的降级策略：局部失败不应导致整体失败。")

page_break()

# ══════════════════════════════════════════════════════════════════════
# 六、提示词工程与意图控制
# ══════════════════════════════════════════════════════════════════════
h1("六、提示词工程与意图控制")

h2("6.1 五个角色的职责分离")
para("系统共有五个模型角色，每个角色只做一件事，各自拥有独立的系统提示词：")
table(
    ["角色", "职责", "温度", "输出契约"],
    [
        ["出题 Agent", "按知识点命题", "0.85", "完整试卷 JSON"],
        ["审题 Agent", "敌对视角逐题挑错", "0.15", "{passed, issues[], summary}"],
        ["修复 Agent", "只改有问题的题", "0.4", "完整试卷 JSON"],
        ["阅卷 Agent", "按评分要点批改简答", "0.1", "{results[]}"],
        ["诊断 Agent", "生成学情诊断与建议", "0.4", "{diagnosis}"],
    ],
    widths=[2.4, 5.6, 1.8, 6.2],
)
para("职责分离带来的直接好处是：每个角色的提示词可以独立迭代，互不干扰。当审题过于严格时，只需要修改审题提示词，不必担心影响出题质量。")

h2("6.2 结构化契约")
para("所有角色都通过严格 JSON 契约通信，且每个契约都有对应的本地校验器。这形成了「双保险」：模型输出再脏，也会被归一化与校验拦住。")
para("归一化器做的事包括：补全缺失的题目 id、把字符串形式的选项转成对象、把答案统一成大写字母、把数值型分值转成数字、对重复 id 去重。校验器则负责「不可能通过」的硬性判断：题数为零、总分不符、缺少要求的题型、题干为空、缺少答案或解析。")

h2("6.3 一次真实的意图控制迭代")
para("这一节记录本项目中最有代表性的问题与修复过程，它也是「意图控制」这一评分的直接证据。")
para("首次实现完成后运行冒烟测试，出现了严重的收敛问题：连续三轮审题全部未通过，但审题者提出的问题却都是「单题分值分配不够合理（此项为次要问题）」「答案未用 LaTeX 书写」这类风格建议。它们被错误地标记为 major，导致流水线始终无法通过，最后只能降级交付并标记「待人工复核」。")
para("根因定位：提示词只说了「存在 blocker 或 major 就判不通过」，却没有给出严重度的判定标准。模型把「值得改进」与「影响作答」混为一谈。")
para("修复方案分三步：")
bullet("在审题提示词中写死三级严重度的判定标准，并明确「minor 绝不允许写成 major」「分值总和已由程序校验，不需要再核算」。")
bullet("在流水线中实现严重度收敛：第 2 轮起仅 blocker 阻断，避免模型不断提出新的风格建议。")
bullet("给修复提示词补充约束：只修 blocker 与 major，不要为 minor 大改题目。")
para("修复后，同一测试用例在第 1 轮即通过审题，生成耗时从 23.4 秒（3 轮）降到 10.2 秒（1 轮），tokens 从 13063 降到 5426。这一组数据被记录在案，作为方案有效性的客观验证。")

table(
    ["指标", "修复前", "修复后"],
    [
        ["审题轮次", "3 轮（仍未通过）", "1 轮（通过）"],
        ["全链路耗时", "23.4 s", "10.2 s"],
        ["token 消耗", "13,063", "5,426"],
        ["交付状态", "待人工复核", "正常交付"],
    ],
    widths=[4, 5.5, 5.5],
)

page_break()

# ══════════════════════════════════════════════════════════════════════
# 七、工程实现
# ══════════════════════════════════════════════════════════════════════
h1("七、工程实现")

h2("7.1 目录结构")
code_block(
"""zhijuan/
├── client/                    前端
│   └── src/
│       ├── components/        PipelineTrace / PaperRenderer / KnowledgeRadar
│       ├── lib/               api.ts（含 SSE 解析）/ math.tsx（LaTeX 富文本）
│       ├── pages/             Home / Generate / Library / PaperDetail / Report
│       ├── App.tsx            路由与整体布局
│       └── styles.css         设计系统
├── server/                    后端
│   ├── index.js               HTTP 接口与 SSE 通道
│   ├── pipeline.js            ★ 双智能体互检流水线
│   ├── prompts.js             ★ 五个角色的提示词资产
│   ├── paper-schema.js        结构校验与归一化
│   ├── grading.js             分层批改
│   ├── llm.js                 DeepSeek 网关（重试/超时/计量）
│   ├── store.js               JSON 持久化
│   └── env.js                 配置加载
├── scripts/
│   ├── dev.mjs                一条命令同时启动前后端
│   ├── smoke.mjs              全链路冒烟测试
│   └── seed-demo.mjs          演示数据生成
└── docs/                      技术文档与截图"""
)

h2("7.2 关键模块说明")
para("llm.js 是唯一的模型出口，集中承担四件事：")
bullet("重试与超时：对 429/5xx 采用指数退避重试，最多 3 次；单次请求 120 秒超时。")
bullet("脏 JSON 容错：自动剥离 ```json 代码块、截取首个 { 到末个 } 之间的内容、修复尾随逗号。")
bullet("用量计量：每次调用返回 promptTokens / completionTokens / totalTokens，前端可展示成本。")
bullet("密钥隔离：API Key 只读取自服务端环境变量，前端任何请求都不携带。")
para("pipeline.js 的核心是一个带状态机的循环：每轮先执行生成或修复，再做本地校验，再做独立审题；审题判定通过则跳出，否则把问题清单回灌给修复角色。每一步都通过回调抛出 trace 事件，由 SSE 通道转发给前端。")

h2("7.3 SSE 实时通道")
para("生成过程可能持续十几秒，用户需要看到「正在发生什么」，而不是一个转圈。因此生成接口返回 text/event-stream，服务端在流水线每一步主动 write 一个事件：")
code_block(
"""event: trace
data: {"id":"t5","stage":"review","status":"failed","round":1,
       "title":"审题未通过","detail":"2 个阻断性问题：q5 不可判分",
       "issues":[{"questionId":"q5","severity":"major",...}]}"""
)
para("前端没有使用浏览器内置的 EventSource，因为它只支持 GET 请求，而生成接口需要携带命题参数。实现上改用 fetch 获取 ReadableStream，手工按双换行切分事件块，解析 event 与 data 字段。这段解析逻辑只有约 50 行，却让 POST 也能享受流式体验。")
para("此外，服务端每 15 秒发送一次注释心跳（: ping），防止中间代理因空闲而断开连接。")

h2("7.4 错误处理与降级")
table(
    ["故障点", "处理策略", "用户观感"],
    [
        ["未配置 API Key", "所有模型接口前置检查，返回结构化错误码", "页面顶部提示如何配置"],
        ["模型返回非法 JSON", "剥离代码块 + 截取 + 尾随逗号修复", "多数情况无感"],
        ["审题不通过且超过轮次", "交付当前版本并标记「待人工复核」", "拿到试卷，但看到风险提示"],
        ["简答题批改失败", "该题标记「待复核」，其余正常返回", "拿到报告，个别题标注原因"],
        ["数据目录被清理", "每次写入前确保目录存在", "无感"],
    ],
    widths=[4.2, 7, 4.8],
)

page_break()

# ══════════════════════════════════════════════════════════════════════
# 八、可复现性设计
# ══════════════════════════════════════════════════════════════════════
h1("八、可复现性设计")
para("复现性是本项目的设计约束，而不是事后补的文档。具体体现在四个方面。")

h2("8.1 一条命令启动")
para("scripts/dev.mjs 同时拉起 API 服务与 Vite 前端，并在任一进程退出时联动关闭另一个，避免端口残留。开发者只需 npm run dev。")

h2("8.2 十分钟复现路径")
table(
    ["步骤", "命令 / 操作", "预计耗时"],
    [
        ["1", "git clone 仓库并进入目录", "30 s"],
        ["2", "npm install", "2 min"],
        ["3", "复制 .env.example 为 server/.env 并填入 DeepSeek API Key", "1 min"],
        ["4", "npm run dev", "15 s"],
        ["5", "浏览器打开 localhost:5173，生成一份试卷并作答", "2 min"],
        ["6", "（可选）npm run build && npm start 验证生产模式", "1 min"],
    ],
    widths=[1.4, 10, 3.2],
)

h2("8.3 冒烟测试")
para("scripts/smoke.mjs 不需要打开浏览器，一条命令即可验证整条链路，并打印每一轮流水线的状态、最终得分与学情诊断。它既是开发期的回归工具，也是评委快速验证的手段：")
code_block("node scripts/smoke.mjs")
para("输出示例（真实运行结果）：")
code_block(
"""✓ 健康检查通过，模型 deepseek-chat
· 开始生成试卷：高等数学 · 函数极限与连续 · 5 题
  ✓ [R1] 试卷生成完成 — 5 题 · 总分 50 · 用时 6.4s
  ✓ [R1] 本地结构校验 — 题型 / 选项 / 答案 / 分值 / 解析 全部通过
  ✓ [R1] 审题通过 — 答案正确、选项无缺陷、填空答案唯一…
✓ 生成完成：5 题 / 满分 50 / 1 轮 / 4209 tokens
✓ 批改完成：8 / 50（16%）
✓ 全链路耗时 10.2s"""
)

h2("8.4 提交历史规范")
para("Git 历史按「一次提交 = 一个可独立解释的功能落地」组织，覆盖从项目骨架、提示词资产、校验器、流水线、接口、设计系统、组件、页面到文档的完整演进路径，禁止一次性提交全部代码。")
para("配合提交历史，项目保留了完整的 AI 协作过程记录（Prompt 迭代、方案否决、Bug 定位与修复），使开发链路可被第三方逐条复现。")

page_break()

# ══════════════════════════════════════════════════════════════════════
# 九、测试与验证
# ══════════════════════════════════════════════════════════════════════
h1("九、测试与验证")

h2("9.1 功能验证")
table(
    ["用例", "操作", "预期结果", "结果"],
    [
        ["出卷", "输入高等数学 / 函数极限与连续 / 5 题", "生成 5 题、总分 50、含解析", "通过"],
        ["多知识点", "输入四个知识点 / 8 题", "每题标注知识点，报告可出雷达图", "通过"],
        ["审题拦截", "构造缺失解析的输出", "本地校验拦下并在轨迹中标红", "通过"],
        ["自动修复", "构造答案错误的输出", "审题不通过 → 修复 → 复审", "通过"],
        ["客观题判分", "单选选错 / 多选漏选", "0 分 / 半分", "通过"],
        ["填空多答案", "提交 1/2 或 0.5", "均判为正确", "通过"],
        ["简答题批改", "提交部分正确的答案", "给出部分分与具体反馈", "通过"],
        ["降级交付", "审题连续不通过", "交付并标注待人工复核", "通过"],
        ["未配置 Key", "清空 .env 后访问", "接口返回明确提示，页面顶部告警", "通过"],
        ["分值一票否决", "构造分值与要求不符的输出", "本地硬校验拦截 → 确定性归位", "通过"],
        ["多学科回归", "数据结构 / 计算机网络 / 概率论 各生成一份", "结构全部合法、审题全部通过", "通过（3/3）"],
        ["审题契约一致性", "构造「detail 说没问题但 severity=blocker」的输入", "逐题裁定重算，不再误判", "通过"],
    ],
    widths=[2.4, 4.6, 6.2, 1.8],
)

h2("9.2 性能数据")
para("以下数据来自本地实际运行（DeepSeek Chat，单用户，家庭宽带）：")
table(
    ["场景", "题量", "轮次", "耗时", "tokens"],
    [
        ["冒烟测试（5 题 / 50 分）", "5", "1", "10.2 s", "4,209"],
        ["演示试卷（8 题 / 100 分）", "8", "1", "10.4 s", "5,426"],
        ["修复场景（5 题 / 50 分）", "5", "3", "23.4 s", "13,063"],
        ["回归 · 数据结构（6 题）", "6", "1", "9.0 s", "4,482"],
        ["回归 · 计算机网络（6 题）", "6", "1", "10.3 s", "5,303"],
        ["回归 · 概率论（6 题）", "6", "2", "18.5 s", "13,523"],
    ],
    widths=[6.4, 2, 2, 2.4, 3.2],
)
para("其中出题阶段约占总耗时 80%（8.5 s / 10.4 s），审题阶段约 1.9 s。这说明成本主要花在生成本身，验证环节的开销可以接受——这也从数据上支持了 4.5 节的判断。")

h2("9.3 已知边界")
bullet("简答题批改对「部分正确」的边界题存在 ±1 分波动，属于模型判分固有特性。")
bullet("极个别情况下审题仍可能给出过于苛刻的判定，此时系统降级交付并标记待复核。")
bullet("JSON 文件存储不适合多用户并发写入，当前定位为单机 / 演示环境。")

page_break()

# ══════════════════════════════════════════════════════════════════════
# 十、界面与体验设计
# ══════════════════════════════════════════════════════════════════════
h1("十、界面与体验设计")

h2("10.1 设计语言")
para("界面被刻意设计成「两套语言共存」：试卷区域使用米白纸张底色、衬线字体、虚线分隔，追求纸质试卷的阅读感；数据与操作区域使用现代仪表盘的卡片、渐变与圆角，强调信息密度与操作效率。两者的交界处用统一的靛蓝色作为主色，形成视觉锚点。")
para("全部样式手写在一个约 900 行的 CSS 文件中，通过 CSS 变量集中管理颜色、圆角与阴影，未引入任何 UI 框架。这既减小了产物体积，也避免了框架样式与本项目纸感设计冲突。")

h2("10.2 工作台")
image("01-home.png")
caption("图 1　工作台：核心指标、最近作答、知识掌握度与试卷入口")

h2("10.3 新建试卷与流水线可视化")
para("新建试卷页是整个项目的核心交互：左侧填写命题需求，右侧实时呈现流水线的每一步。用户不需要理解技术细节，就能看到「审题智能体发现了什么问题」以及「它是怎么被修复的」。")
image("02-generate.png")
caption("图 2　新建试卷页：左侧命题表单，右侧双智能体流水线说明")

h2("10.4 试卷与作答")
para("试卷渲染使用衬线字体与纸张底色，数学公式由 KaTeX 实时渲染。作答区支持四种题型的原生交互，底部固定作答进度与提交按钮。")
image("paper.png", 14.6)
caption("图 3　试卷作答页：纸感排版与公式渲染")

h2("10.5 学情报告")
para("报告页把批改结果组织成三层信息：最上层是总分与正确率环，中间是知识点掌握度雷达图，下层是逐题明细与完整解析。学情诊断直接指出最薄弱的 1 到 2 个知识点，并给出可执行的下一步建议。")
image("05-report.png")
caption("图 4　学情报告：得分环、知识点雷达、逐题反馈与学情诊断")

page_break()

# ══════════════════════════════════════════════════════════════════════
# 十一、局限与展望
# ══════════════════════════════════════════════════════════════════════
h1("十一、局限与展望")

h2("11.1 当前局限")
bullet("题库未沉淀：每次生成都是全新命题，同一知识点可能重复出相似题。")
bullet("简答题批改的主观性：边界答案的分数波动无法完全消除。")
bullet("单机定位：JSON 文件存储无法支撑多用户并发。")
bullet("缺少教师端编辑：生成后的题目不能手动微调分值或替换选项。")

h2("11.2 后续规划")
table(
    ["方向", "具体设想", "价值"],
    [
        ["题库沉淀", "生成结果入库、按知识点去重、支持组卷", "降低重复成本，形成可复用资产"],
        ["检索增强", "按课程大纲与历史错题定向出题", "让练习更贴合个人薄弱点"],
        ["教师端", "手动编辑、调整分值、导出 PDF 试卷", "进入真实教学流程"],
        ["班级维度", "多学生数据聚合，输出班级知识点热力图", "从个人工具走向教学工具"],
    ],
    widths=[2.6, 8, 5.2],
)

h2("11.3 一点方法论总结")
para("这个项目最值得记录的，不是「用 AI 做出了一个应用」，而是过程中反复出现的一个判断：当模型不可靠时，正确的做法不是让它更努力，而是改变系统结构。")
para("把生成与审查拆开、把能算的交给代码、给反馈环加闸门、把提示词的模糊要求变成可判定的规范——这些都不是提示词技巧，而是软件工程。AI 只是把「写代码」这件事的成本压低了，而定义问题、设计约束、验证结果的能力，反而被放大了。")

page_break()

# ══════════════════════════════════════════════════════════════════════
# 附录
# ══════════════════════════════════════════════════════════════════════
h1("附录 A　环境与依赖清单")
table(
    ["项", "版本 / 说明"],
    [
        ["操作系统", "Windows 10 / 11（macOS、Linux 同样可运行）"],
        ["Node.js", "≥ 20.12（实测 24.21）"],
        ["包管理器", "npm 或 pnpm"],
        ["运行时依赖", "express 4、react 18、react-dom 18、react-router-dom 6、katex 0.16"],
        ["开发依赖", "vite 5、@vitejs/plugin-react、typescript 5"],
        ["模型服务", "DeepSeek Chat（OpenAI 兼容协议，可替换其它厂商）"],
        ["浏览器", "Chrome / Edge 等支持 ReadableStream 的现代浏览器"],
    ],
    widths=[3.2, 12],
)

h1("附录 B　提示词资产清单")
para("五个角色的完整提示词位于 server/prompts.js，以下是审题角色的核心约束节选，它最能体现本项目的意图控制思路：")
code_block(
"""严重度（severity）的判定标准，必须严格遵守：
- blocker：会导致题目客观错误或无法作答/无法判分
- major：明显影响作答质量，但学生仍能合理作答
- minor：风格、统一性、格式、分值分配等建议性问题
        minor 绝不允许写成 major
只要存在 blocker 或 major 问题，passed 必须为 false；
如果只有 minor 问题，passed 必须为 true。
关于分值：各题分值之和程序已经校验过，你不需要再核算；
        单题分值的合理性一律归为 minor。"""
)

h1("附录 C　复现检查清单")
table(
    ["检查项", "通过标准"],
    [
        ["服务启动", "终端显示 API 地址、模型名与「Key 已配置」"],
        ["页面可访问", "http://localhost:5173 打开工作台，侧栏显示模型信息"],
        ["生成闭环", "新建试卷 → 右侧出现 trace → 生成完成并显示「审题通过」"],
        ["作答闭环", "作答后提交 → 跳转学情报告，显示得分与逐题反馈"],
        ["冒烟测试", "node scripts/smoke.mjs 输出「全链路耗时」且无报错"],
        ["生产模式", "npm run build && npm start 后访问 8787 端口可用"],
    ],
    widths=[3.6, 11.6],
)

doc.save(OUT)
print("saved:", OUT)
