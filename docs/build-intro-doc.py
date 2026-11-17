# -*- coding: utf-8 -*-
"""生成《智卷 · 作品介绍文档》—— 对应提交表单第 6 项要求（7 个小节）。"""
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
OUT = os.path.join(HERE, "智卷-作品介绍文档.docx")

SERIF = "宋体"
SANS = "黑体"
ACCENT = RGBColor(0x3B, 0x3F, 0xBF)

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
sec.top_margin, sec.bottom_margin = Cm(2.3), Cm(2.1)
sec.left_margin, sec.right_margin = Cm(2.7), Cm(2.5)

normal = doc.styles["Normal"]
normal.font.name = SERIF
normal.font.size = Pt(10.5)
normal.element.rPr.rFonts.set(qn("w:eastAsia"), SERIF)


def set_font(run, name, size, bold=False, color=None):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    if color is not None:
        run.font.color.rgb = color
    rpr = run._element.get_or_add_rPr()
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        rf = OxmlElement("w:rFonts")
        rpr.append(rf)
    for attr in ("w:eastAsia", "w:ascii", "w:hAnsi"):
        rf.set(qn(attr), name)


def para(text="", size=10.5, bold=False, name=SERIF, indent=True, align=WD_ALIGN_PARAGRAPH.JUSTIFY,
         before=0, after=6, line=1.5, color=None):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = line
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.space_after = Pt(after)
    p.alignment = align
    if indent:
        p.paragraph_format.first_line_indent = Pt(size * 2)
    set_font(p.add_run(text), name, size, bold, color)
    return p


def h1(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(8)
    p.style = doc.styles["Heading 1"]
    set_font(p.add_run(text), SANS, 15, True, ACCENT)


def h2(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(4)
    p.style = doc.styles["Heading 2"]
    set_font(p.add_run(text), SANS, 12, True, RGBColor(0x14, 0x16, 0x1F))


def bullet(text, size=10.5):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.left_indent = Pt(18)
    p.paragraph_format.first_line_indent = Pt(-10)
    set_font(p.add_run("· " + text), SERIF, size)


def code(text):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.left_indent = Pt(14)
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), "F3F4FA")
    p._p.get_or_add_pPr().append(shading)
    set_font(p.add_run(text), "Consolas", 9)


def table(headers, rows, widths=None, size=9.5):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    for i, text in enumerate(headers):
        cell = t.rows[0].cells[i]
        cell.text = ""
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        set_font(p.add_run(text), SANS, size, True)
        shd = OxmlElement("w:shd")
        shd.set(qn("w:fill"), "E8EAF6")
        cell._tc.get_or_add_tcPr().append(shd)
    for row in rows:
        cells = t.add_row().cells
        for i, text in enumerate(row):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            p.paragraph_format.line_spacing = 1.2
            set_font(p.add_run(str(text)), SERIF, size)
    if widths:
        for i, w in enumerate(widths):
            for row in t.rows:
                row.cells[i].width = Cm(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def image(name, width_cm=15.0, caption_text=""):
    path = os.path.join(SHOTS, name)
    if not os.path.exists(path):
        return
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(path, width=Cm(width_cm))
    if caption_text:
        c = doc.add_paragraph()
        c.alignment = WD_ALIGN_PARAGRAPH.CENTER
        c.paragraph_format.space_after = Pt(10)
        r = c.add_run(caption_text)
        set_font(r, SERIF, 9)
        r.font.color.rgb = RGBColor(0x6A, 0x70, 0x88)


def footer_page_number():
    p = doc.sections[0].footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    for tag, attr in (("w:fldChar", "begin"), ("w:instrText", None), ("w:fldChar", "end")):
        el = OxmlElement(tag)
        if attr:
            el.set(qn("w:fldCharType"), attr)
        else:
            el.text = "PAGE"
        run._r.append(el)
    set_font(run, SERIF, 9)


footer_page_number()

# ── 封面 ──────────────────────────────────────────────────────────
for _ in range(5):
    doc.add_paragraph()
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_font(p.add_run("智  卷"), SANS, 34, True, ACCENT)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_font(p.add_run("AI 智能出卷与批改引擎"), SANS, 18, True)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_font(p.add_run("作 品 介 绍 文 档"), SANS, 14, True)
doc.add_paragraph()
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("让 AI 出题，也让 AI 互相监考")
set_font(r, SERIF, 11)
r.font.color.rgb = RGBColor(0x6A, 0x70, 0x88)

for _ in range(7):
    doc.add_paragraph()

info = [
    ("参赛赛事", "全国计算机应用能力与数字素养大赛 & 第九届传智杯"),
    ("参赛赛道", "AI 创新应用挑战赛 · 省赛 · 个人赛"),
    ("参赛编号", "2124074"),
    ("参赛姓名", "刘子豪"),
    ("所属院校", "宜春学院 · 计算机技术"),
    ("作品形式", "Web 全栈应用（React + Node.js + DeepSeek）"),
    ("完成时间", "2026 年 11 月"),
]
t = doc.add_table(rows=0, cols=2)
for key, value in info:
    cells = t.add_row().cells
    cells[0].width, cells[1].width = Cm(3.6), Cm(9)
    p0 = cells[0].paragraphs[0]
    p0.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_font(p0.add_run(key + "："), SANS, 10.5)
    set_font(cells[1].paragraphs[0].add_run(value), SERIF, 10.5)

doc.add_page_break()

# ── 一、项目详情及使用方式 ────────────────────────────────────────
h1("一、项目详情及使用方式")

h2("1.1 这是什么")
para("智卷是一个面向高校教学的 AI 智能出卷与批改引擎。教师或学生只需输入学科与知识点，系统即可在十余秒内"
     "生成一份包含单选、多选、填空、简答四种题型、带解析、可直接在线作答的试卷；作答后，客观题由确定性代码"
     "判分，简答题由阅卷智能体按评分要点给分，最终输出知识点掌握度雷达图与个性化学习诊断。")
para("项目的核心并不是「调一次大模型生成题目」，而是解决一个更本质的工程问题：大模型生成的结构化内容不可靠，"
     "而且让它自己检查自己时几乎必然放行。为此，项目设计并实现了「双智能体互检流水线」，把不可靠的模型输出"
     "转化为可交付的教学产品。")

h2("1.2 使用方式（五步）")
table(
    ["步骤", "操作", "说明"],
    [
        ["① 打开", "启动服务后访问 http://localhost:5173", "工作台展示试卷数、作答数、平均正确率与知识点雷达"],
        ["② 出卷", "点「新建试卷」，填学科、知识点、题数、总分、难度、题型", "可选快捷模板，支持额外要求（如侧重计算、避免超纲）"],
        ["③ 观看流水线", "点「生成试卷」后看右侧面板", "出题 → 本地校验 → 独立审题 →（必要时）修复，全程实时可见"],
        ["④ 作答", "点「开始作答」，完成题目后提交", "四种题型原生交互，公式由 KaTeX 渲染"],
        ["⑤ 看报告", "自动跳转学情报告", "得分环、知识点雷达、逐题反馈、完整解析与 AI 诊断"],
    ],
    widths=[2.2, 7.2, 6.2],
)
para("此外还提供试卷库、流水线回溯（可查看每份试卷生成时两个智能体做了什么）、离线演示数据等功能。")

h2("1.3 运行与复现")
para("项目为前后端分离的 Web 应用，一条命令同时启动：")
code("npm install\ncp .env.example server/.env   # 填入 DEEPSEEK_API_KEY\nnpm run dev                   # 前端 5173 / 后端 8787")
para("另提供无需模型 Key 的离线体验方式：npm run demo:data 载入 6 份已生成试卷与 2 份作答记录，"
     "可直接浏览完整产品；项目源码托管在公开仓库，含 40+ 条细粒度提交历史与 9 个单元测试。")

doc.add_page_break()

# ── 二、项目亮点 ──────────────────────────────────────────────────
h1("二、项目亮点")

h2("亮点一：让 AI 出题，也让 AI 互相监考")
para("单一模型既出题又审题时，会为自己的输出辩护。项目把生成与审查拆成两次完全独立的模型调用："
     "不同提示词、不同上下文、不同采样温度（出题 0.85，审题 0.15）。审查者看不到生成者的推理过程，"
     "只能面对最终产物逐题核算，并被要求以敌对视角默认「这份试卷有问题」。")

h2("亮点二：把「验证比生成便宜」变成工程实现")
bullet("结构合法性（题型、选项、答案是否落在选项内、解析是否存在）交给确定性代码校验，成本近乎为零；")
bullet("分值加总是纯算术问题，由归一化阶段直接补齐，不占用模型修复轮次；")
bullet("批改阶段只有简答题调用模型，单选、多选、填空全部由代码判分。")
para("实测：一个「分值不足」的错误，交给模型修复需要一轮调用（约 8 秒、4000 tokens），交给算术只需几行代码。")

h2("亮点三：全过程可观测、可审计")
para("流水线的每一步通过 SSE 实时推送到前端，用户能看到「现在是谁在工作、发现了什么、被打回了多少次」。"
     "每份试卷都保留完整的 pipelineTrace，可在试卷库中回溯。这把一个黑箱的 AI 生成过程变成了可审计的流程。")

h2("亮点四：为可靠性设计的多重闸门")
table(
    ["闸门", "机制", "解决的问题"],
    [
        ["结构化契约", "模型必须输出严格 JSON，本地归一化 + 硬校验", "输出格式不可靠"],
        ["一票否决", "审题通过且结构合法才允许交付", "审题放水或程序漏检"],
        ["逐题二元裁定", "每道题必须给出 ok 真/假，判false须给可核对证据", "模型「说没问题却判不通过」"],
        ["收敛上限", "最多 2 轮修复，超限降级交付并标记待人工复核", "反馈环死循环"],
    ],
    widths=[2.6, 7.4, 5.6],
)

h2("亮点五：一个完整的产品闭环，而不是一个 Demo")
para("从出卷、作答、批改到学情诊断，四个环节全部打通并可直接演示；同时保留了 40+ 条细粒度 Git 提交、"
     "9 个单元测试、全链路冒烟测试与多学科回归测试，具备可复现、可验证的工程属性。")

doc.add_page_break()

# ── 三、AI 技术落地使用情况 ──────────────────────────────────────
h1("三、AI 技术落地使用情况概述")

h2("3.1 产品内的 AI 落地：五个角色协同工作")
para("AI 不是装饰性入口，而是产品的主干。系统内共有五个模型角色，各自职责单一、上下文隔离：")
table(
    ["角色", "职责", "温度", "输出契约"],
    [
        ["出题 Agent", "按知识点命制题目（含选项、答案、解析、分值）", "0.85", "完整试卷 JSON"],
        ["审题 Agent", "敌对视角逐题裁定，要求给出可核对证据", "0.15", "verdicts[]"],
        ["修复 Agent", "仅针对 blocker/major 问题改写", "0.4", "完整试卷 JSON"],
        ["阅卷 Agent", "按评分要点批改简答题", "0.1", "逐题得分与反馈"],
        ["诊断 Agent", "生成学情诊断与下一步建议", "0.4", "诊断文本"],
    ],
    widths=[2.4, 7.8, 1.6, 3.8],
)

h2("3.2 开发过程中的 AI 协作（Vibe Coding）")
para("本项目全部代码、文档与提示词均在 AI 编程助手（DeepSeek Harness）协作下完成，开发过程完整留痕：")
bullet("40+ 条细粒度 Git 提交，每次提交对应一个可独立解释的功能落地，不存在一次性提交全部代码；")
bullet("会话记录完整导出：7 轮真实人类 Prompt、386 次工具调用，可在仓库 docs/ai-history/ 查看（密钥已打码）；")
bullet("《AI 协作记录》整理了 7 个核心迭代的 Prompt 链：意图 → AI 方案 → 决策依据 → 验证结果，含 3 次真实 Bug 的定位与修复。")
para("人类在其中负责意图定义、方案取舍与结果验收，AI 负责实现——这正是 Vibe Coding 的分工："
     "写代码的成本趋近于零，定义问题与判断质量的能力成为关键。")

h2("3.3 用 AI 生成代码，也验证 AI 生成的代码")
para("AI 生成代码的最大风险是「看起来很对」。项目为此建立了三层验证机制，全部可执行：")
table(
    ["层级", "手段", "命令", "结果"],
    [
        ["单元测试", "结构校验、分值归位、答案修正等纯函数", "npm test", "9 / 9 通过"],
        ["全链路冒烟", "真实调用模型跑通生成→审题→作答→批改", "node scripts/smoke.mjs", "10.7 秒通过"],
        ["多学科回归", "数据结构 / 计算机网络 / 概率论各生成一份并校验结构", "node scripts/check-robustness.mjs", "3 / 3 通过"],
    ],
    widths=[2.4, 7.2, 4.4, 2.4],
)
para("这套机制直接抓出了 4 个真实缺陷，其中一个典型案例：审题者在 detail 里写「经复核本题无问题」，"
     "却仍把 severity 标为 blocker 并判不通过，导致一份可交付的试卷被反复打回、修复智能体无从下手。"
     "修复方式是把输出契约从「自由文本 issue」改为「逐题二元裁定」，同类用例从 3 轮未通过、15476 tokens，"
     "降到 1 轮通过、4482 tokens。")

doc.add_page_break()

# ── 四、关键技术 ──────────────────────────────────────────────────
h1("四、项目中涉及的关键技术")

h2("4.1 双智能体互检流水线（核心）")
para("出题 → 本地结构校验 → 独立审题 → 修复 的带回边闭环。关键设计：")
bullet("生成者与审查者上下文完全独立，避免自审放水；")
bullet("审查者被设定为敌对角色，默认假设试卷有问题；")
bullet("反馈环带终止条件：最多 2 轮，超限降级交付并标注待人工复核；")
bullet("每一步产出结构化 trace 事件，供前端实时可视化与事后回溯。")

h2("4.2 逐题二元裁定的输出契约")
para("要求审题者对每道题给出 ok 真/假；ok=false 时必须写出可被第三方核对的错误证据（例如「正确后序序列应为 "
     "DEBFCA，选项 A 是 DEBCFA」），写不出证据就必须判 ok=true；禁止在 evidence 中写推理过程或改口。"
     "程序只依据 ok 与 severity 计算是否通过，不再信任模型给出的布尔结论；若返回结构缺失则判定审题异常并重试。")

h2("4.3 确定性校验与分值增量归位")
para("模型输出先经过归一化（补全 id、字符串选项转对象、答案统一大写、多选题答案归一、数值分值转数字），"
     "再做硬校验（题数为零、总分不符、缺少要求题型、题干为空、缺少答案或解析）。分值加总属于算术问题，"
     "由「从分值最大的题开始吸收差值」的确定性算法补齐，并处理四舍五入残差。")

h2("4.4 SSE 流式事件通道")
para("生成接口返回 text/event-stream，服务端在流水线每一步主动推送事件；前端因 EventSource 仅支持 GET，"
     "改用 fetch + ReadableStream 手工按双换行切分事件块并解析 event/data 字段，使 POST 也能享受流式体验；"
     "服务端每 15 秒发送注释心跳防止代理断连。")

h2("4.5 分层批改")
table(
    ["题型", "判分方式", "理由"],
    [
        ["单选 / 多选", "集合比对；多选漏选给一半分，错选 0 分", "完全确定"],
        ["填空", "归一化后与多个可接受答案比对（支持 0.5|1/2）", "完全确定"],
        ["简答", "LLM 依据参考答案与评分要点给分，须给出扣分理由", "需语义理解"],
    ],
    widths=[2.8, 8.6, 4.2],
)

h2("4.6 技术栈")
table(
    ["层次", "技术"],
    [
        ["前端", "React 18、TypeScript、React Router 6、KaTeX、原生 CSS 设计系统"],
        ["后端", "Node.js、Express 4"],
        ["模型", "DeepSeek Chat（OpenAI 兼容协议，可替换）"],
        ["流式通道", "Server-Sent Events（POST + ReadableStream 手工解析）"],
        ["持久化", "JSON 文件（为保证 10 分钟复现刻意不用数据库）"],
        ["工程保障", "Node 内置 test runner、冒烟测试、多学科回归、干净克隆验证"],
    ],
    widths=[3.2, 12],
)

doc.add_page_break()

# ── 五、项目图片 ──────────────────────────────────────────────────
h1("五、项目相关图片")

image("screen-home.png", 15.6, "图 1　工作台：核心指标、最近作答、知识点掌握度雷达图")
image("screen-pipeline.jpg", 15.6, "图 2　新建试卷：右侧实时展示双智能体流水线的每一步（出题 / 校验 / 审题 / 修复）")
image("screen-paper.png", 14.6, "图 3　在线作答：纸感排版与 KaTeX 公式渲染，支持四种题型")
image("screen-report.png", 15.6, "图 4　学情报告：得分环、知识点雷达、逐题反馈与 AI 学情诊断")

doc.add_page_break()

# ── 六、发表与获奖情况 ────────────────────────────────────────────
h1("六、项目之前是否发表过或获奖")
para("本项目为本次赛事专门创作，此前未在任何平台发表、未参加过其他比赛、未获得过任何奖项。")
para("项目全部代码与文档均为原创：出题/审题/修复/批改的提示词、流水线编排、结构校验器、分层批改器、"
     "前端设计系统与所有界面，均在本项目内从零实现；未直接引用或包装任何开源项目作为参赛作品。")

h1("七、是否在其他项目基础上优化")
para("否。本项目不基于任何已有项目或代码库，是从零开始的独立创作。")
para("项目中使用的第三方依赖均为通用基础库（React、Express、KaTeX 等），仅作为运行时基础，"
     "不含任何与「智能出卷与批改」业务相关的既有实现。")

doc.add_paragraph()
para("（本文档共 7 节，对应表单第 6 项「作品介绍文档」的具体要求：项目详情及使用方式、项目亮点、"
     "AI 技术落地使用情况、关键技术、项目图片、发表或获奖情况、是否基于其他项目优化。）", size=9.5)

doc.save(OUT)
print("saved:", OUT)

