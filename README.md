# 概率论与数理统计 · 知识库 & 题库

基于《概率论与数理统计——基于案例分析》（上海交通大学数学科学学院）整理的复习网站：9 章知识点讲解 + 题库自测 + 期末模拟试卷。纯静态 SPA，公式由自托管 KaTeX 渲染。

## 内容
- **9 章**：随机事件与概率 / 随机变量及分布 / 多维随机变量 / 数字特征 / 大数定律与中心极限定理 / 数理统计预备 / 参数估计 / 假设检验 / 回归分析
- **134** 个知识点讲解、**198** 道题（单选/多选/判断/计算，含解析）
- **3** 套期末模拟试卷（A/B/C 卷，各 100 分，附参考答案）

## 本地预览
```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

## 部署
纯静态站点，托管于 Cloudflare Pages。构建设置：Framework=None，Build command 留空，Output directory=`/`（根目录）。push 到 main 即自动重新构建。

## 结构
- `index.html` — 页面外壳
- `assets/app.js` — SPA 路由与渲染器（Markdown + KaTeX）
- `data/lectures.json` — 章节/试卷索引
- `data/c1..c9.json` — 各章知识点与题库
- `data/exam1..3.json` — 模拟试卷
- `vendor/katex/` — 自托管 KaTeX（国内可直接加载）

> 内容仅供学习复习使用。
