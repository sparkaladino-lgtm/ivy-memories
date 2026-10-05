# Plan: Pixel RPG Dialog & Typewriter Feature

## Objective
在展示网站的“My Memory”画廊页面中，为放大的图片添加沉浸式“像素风”文字介绍功能（复古 RPG 像素对话框 + 纯 CSS 锯齿与边框 + 极小英文像素字体 + 多段打字机叙事 + 点击推进 + 自动清零重置 + 严禁任何音频/Web Audio API），并通过 Agent-as-Judge 评审与 Forensic Auditor 审计。

## Milestones & Workflow

| # | Milestone | Subagents | Deliverables | Status |
|---|-----------|-----------|--------------|--------|
| M1 | 代码与架构勘探 | Explorer (`teamwork_preview_explorer`) | 勘探画廊结构、图片放大/灯箱逻辑、DOM节点、CSS架构，产出勘探报告 | PLANNED |
| M2 | 像素UI与多段打字机实现 | Worker (`teamwork_preview_worker`) | 编写纯CSS像素边框/背景/响应式样式、集成轻量像素字体、实现多段打字机逻辑与点击推进交互 | PLANNED |
| M3 | 功能与多端响应式验证 | Challenger (`teamwork_preview_challenger`) | 编写/执行针对多端视口、打字机动画、点击推进多段、图片切换重置的验证测试 | PLANNED |
| M4 | 独立评审 (Agent-as-Judge) | Reviewer (`teamwork_preview_reviewer`) / Critic (`teamwork_preview_critic`) | 对 UI 像素风格、自适应居中/底部布局、打字机动画与点击推进多段对话、重置逻辑进行打分与验收 | PLANNED |
| M5 | 法医合规审计 | Auditor (`teamwork_preview_auditor`) | 静态/动态审计：确认零音频文件、零 Web Audio API、无乱码且字体轻量 | PLANNED |
| M6 | 成果汇总与移交 | Orchestrator (`orchestrator_2`) | 编写 handoff.md 并向父代理 (Sentinel) 汇报最终成果 | PLANNED |

## Strict Constraints
1. 严禁编排者直接碰触业务源码或运行构建/测试脚本，所有探索与实现严格由专门子代理完成。
2. 绝对禁止引入音频文件或 Web Audio API。
3. 英文像素字体极小且中文字体协调，不引入破坏性性能开销。
4. 移动端与桌面端自适应居中或底部布局，美观沉浸无遮挡。
