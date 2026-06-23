/* ===== 机器学习知识库 & 题库 SPA ===== */
const App = (() => {
  const appEl = document.getElementById('app');
  let index = null;            // lectures.json
  const lectureCache = {};     // id -> lecture data
  let searchIndex = null;      // built lazily

  /* ---------- utils ---------- */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // very small markdown-ish renderer (keeps $...$ math intact for KaTeX)
  function mdToHtml(src) {
    if (!src) return '';
    if (Array.isArray(src)) src = src.join('\n');
    const lines = String(src).split('\n');
    let html = '', listType = null, inCode = false, code = '';
    const flushList = () => { if (listType) { html += `</${listType}>`; listType = null; } };
    const inline = (t) => esc(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      ;
    const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    const isSep = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l) && l.includes('-');
    const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.replace(/\s+$/, '');
      if (line.trim().startsWith('```')) {
        if (inCode) { html += `<pre><code>${esc(code)}</code></pre>`; code = ''; inCode = false; }
        else { flushList(); inCode = true; }
        continue;
      }
      if (inCode) { code += raw + '\n'; continue; }
      // markdown table: header row + separator row + body rows
      if (isRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
        flushList();
        const header = cells(line);
        i += 2;
        let body = '';
        while (i < lines.length && isRow(lines[i])) {
          const c = cells(lines[i]);
          body += '<tr>' + c.map(x => `<td>${inline(x)}</td>`).join('') + '</tr>';
          i++;
        }
        i--;
        html += `<table class="md-table"><thead><tr>${header.map(x => `<th>${inline(x)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
        continue;
      }
      if (!line.trim()) { flushList(); continue; }
      let m;
      if ((m = line.match(/^>\s?(.*)/))) { flushList(); html += `<div class="note">${inline(m[1])}</div>`; continue; }
      if ((m = line.match(/^[-*]\s+(.*)/))) {
        if (listType !== 'ul') { flushList(); html += '<ul>'; listType = 'ul'; }
        html += `<li>${inline(m[1])}</li>`; continue;
      }
      if ((m = line.match(/^\d+\.\s+(.*)/))) {
        if (listType !== 'ol') { flushList(); html += '<ol>'; listType = 'ol'; }
        html += `<li>${inline(m[1])}</li>`; continue;
      }
      if ((m = line.match(/^#{2,4}\s+(.*)/))) { flushList(); html += `<h4>${inline(m[1])}</h4>`; continue; }
      flushList();
      html += `<p>${inline(line)}</p>`;
    }
    flushList();
    if (inCode) html += `<pre><code>${esc(code)}</code></pre>`;
    return html;
  }

  function renderMath(scope) {
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(scope || document.body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true },
          ],
          throwOnError: false,
        });
      } catch (e) { /* noop */ }
    }
  }

  async function getIndex() {
    if (index) return index;
    index = await fetch('./data/lectures.json').then(r => r.json());
    return index;
  }
  async function getLecture(id) {
    if (lectureCache[id]) return lectureCache[id];
    try {
      const data = await fetch(`./data/${id}.json`).then(r => r.ok ? r.json() : null);
      lectureCache[id] = data;
      return data;
    } catch (e) { return null; }
  }
  async function getAllLectures() {
    const idx = await getIndex();
    const all = await Promise.all(idx.lectures.map(l => getLecture(l.id)));
    return idx.lectures.map((meta, i) => ({ meta, data: all[i] })).filter(x => x.data);
  }

  /* ---------- views ---------- */
  async function viewHome() {
    const idx = await getIndex();
    const all = await getAllLectures();
    let totalKp = 0, totalQ = 0;
    const counts = {};
    all.forEach(({ meta, data }) => {
      const kp = (data.knowledgePoints || []).length;
      const q = (data.questions || []).length;
      totalKp += kp; totalQ += q; counts[meta.id] = { kp, q };
    });
    const cards = idx.lectures.map(l => {
      const c = counts[l.id] || { kp: 0, q: 0 };
      return `<a class="card" href="#/lecture/${l.id}">
        <div class="c-top"><span class="c-icon">${l.icon || '📘'}</span>
          <div><div class="c-order">第 ${l.order} 章</div><h3 class="c-title">${esc(l.title)}</h3></div></div>
        <div class="c-en">${esc(l.en || '')}</div>
        <div class="c-desc">${esc(l.desc || '')}</div>
        <div class="c-meta"><span>知识点 <b>${c.kp}</b></span><span>题目 <b>${c.q}</b></span></div>
      </a>`;
    }).join('');
    appEl.innerHTML = `
      <section class="hero">
        <h1>${esc(idx.course)}</h1>
        <div class="sub">${esc(idx.subtitle)}${idx.instructor ? ' · ' + esc(idx.instructor) : ''}</div>
        <div class="hero-stats">
          <div class="stat"><b>${idx.lectures.length}</b><span>章</span></div>
          <div class="stat"><b>${totalKp}</b><span>知识点</span></div>
          <div class="stat"><b>${totalQ}</b><span>题目</span></div>
        </div>
        <p class="sub">点击章节查看知识点讲解，前往 <a href="#/quiz">题库练习</a> 自测，或做 <a href="#/exams">期末模拟卷</a>。</p>
      </section>
      <h2 class="section-title">📖 课程章节</h2>
      <div class="grid">${cards}</div>`;
  }

  async function viewLecture(id) {
    const idx = await getIndex();
    const meta = idx.lectures.find(l => l.id === id);
    const data = await getLecture(id);
    if (!meta || !data) { appEl.innerHTML = `<div class="empty">未找到该章内容。<br><a href="#/">返回首页</a></div>`; return; }
    const kps = data.knowledgePoints || [];
    const toc = kps.map((k, i) => `<a href="#kp-${i}" data-toc="${i}">${i + 1}. ${esc(k.title)}</a>`).join('');
    const body = kps.map((k, i) => `
      <div class="kp" id="kp-${i}">
        <h3><span class="kp-num">${i + 1}</span>${esc(k.title)}</h3>
        <div class="kp-body">${mdToHtml(k.content)}</div>
        ${(k.tags && k.tags.length) ? `<div class="tags">${k.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>`).join('');
    const qCount = (data.questions || []).length;
    appEl.innerHTML = `
      <div class="lec-head">
        <div class="crumb"><a href="#/">首页</a> / 第 ${meta.order} 章</div>
        <h1>${meta.icon || ''} ${esc(data.title || meta.title)}</h1>
        <div class="en">${esc(data.subtitle || meta.en || '')}</div>
        ${data.summary ? `<div class="summary">${mdToHtml(data.summary)}</div>` : ''}
      </div>
      <div class="lec-layout">
        <nav class="toc">${toc}<div class="kp-foot"><a class="pill active" href="#/quiz/${id}">📝 本章练习 (${qCount})</a></div></nav>
        <div class="kp-list">${body || '<div class="empty">本章内容整理中…</div>'}</div>
      </div>`;
    renderMath(appEl);
    setupToc(kps.length);
  }

  function setupToc(n) {
    const links = [...appEl.querySelectorAll('.toc a[data-toc]')];
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          const i = en.target.id.replace('kp-', '');
          links.forEach(a => a.classList.toggle('active', a.dataset.toc === i));
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    appEl.querySelectorAll('.kp').forEach(el => obs.observe(el));
  }

  /* ---------- quiz ---------- */
  let quizState = { lec: 'all', type: 'all', diff: 'all', questions: [], answers: {} };

  async function viewQuiz(presetLec) {
    const idx = await getIndex();
    const all = await getAllLectures();
    const pool = [];
    all.forEach(({ meta, data }) => {
      (data.questions || []).forEach(q => pool.push({ ...q, _lec: meta.id, _lecTitle: meta.title, _order: meta.order }));
    });
    if (presetLec) quizState.lec = presetLec;
    quizState._pool = pool;

    const lecOpts = ['<option value="all">全部章节</option>']
      .concat(idx.lectures.map(l => `<option value="${l.id}" ${quizState.lec === l.id ? 'selected' : ''}>第${l.order}章 ${esc(l.title)}</option>`)).join('');

    appEl.innerHTML = `
      <div class="lec-head"><h1>📝 题库练习</h1><div class="en">共 ${pool.length} 道题 · 选择章节与条件后开始自测</div></div>
      <div class="quiz-toolbar">
        <select id="qLec">${lecOpts}</select>
        <select id="qType">
          <option value="all">全部题型</option>
          <option value="single">单选</option>
          <option value="multiple">多选</option>
          <option value="truefalse">判断</option>
          <option value="short">简答</option>
        </select>
        <select id="qDiff">
          <option value="all">全部难度</option>
          <option value="easy">简单</option>
          <option value="medium">中等</option>
          <option value="hard">困难</option>
        </select>
        <span class="grow"></span>
        <button id="qShuffle">🔀 乱序</button>
        <button id="qStart" class="btn-primary">开始 / 筛选</button>
      </div>
      <div id="quizArea"></div>`;

    const sync = () => { quizState.lec = qLec.value; quizState.type = qType.value; quizState.diff = qDiff.value; };
    const qLec = document.getElementById('qLec'), qType = document.getElementById('qType'), qDiff = document.getElementById('qDiff');
    qType.value = quizState.type; qDiff.value = quizState.diff;
    document.getElementById('qStart').onclick = () => { sync(); buildQuiz(false); };
    document.getElementById('qShuffle').onclick = () => { sync(); buildQuiz(true); };
    buildQuiz(false);
  }

  function buildQuiz(shuffle) {
    let qs = quizState._pool.filter(q =>
      (quizState.lec === 'all' || q._lec === quizState.lec) &&
      (quizState.type === 'all' || q.type === quizState.type) &&
      (quizState.diff === 'all' || q.difficulty === quizState.diff));
    if (shuffle) qs = shuffleArr(qs.slice());
    quizState.questions = qs; quizState.answers = {};
    const area = document.getElementById('quizArea');
    if (!qs.length) { area.innerHTML = `<div class="empty">没有符合条件的题目，换个筛选试试。</div>`; return; }
    area.innerHTML = `
      <div class="quiz-summary" id="quizSummary">本组共 <b>${qs.length}</b> 道题。作答后点「显示答案」查看解析，或答完点「提交全部」统计得分。
        <div class="q-actions"><button id="submitAll" class="btn-primary">提交全部 ✅</button><button id="revealAll">显示全部答案</button></div>
      </div>
      ${qs.map((q, i) => renderQuestion(q, i)).join('')}`;
    qs.forEach((q, i) => bindQuestion(q, i));
    document.getElementById('submitAll').onclick = submitAll;
    document.getElementById('revealAll').onclick = () => quizState.questions.forEach((q, i) => revealQuestion(q, i));
    renderMath(area);
  }

  const LETTERS = 'ABCDEFGH';
  function renderQuestion(q, i) {
    const typeLabel = { single: '单选', multiple: '多选', truefalse: '判断', short: '简答' }[q.type] || '题目';
    const diffLabel = { easy: '简单', medium: '中等', hard: '困难' }[q.difficulty] || '';
    let bodyHtml = '';
    if (q.type === 'short') {
      bodyHtml = `<div class="short-ans"><textarea id="ta-${i}" placeholder="在此作答（自我检测，不评分）…"></textarea></div>`;
    } else if (q.type === 'truefalse') {
      bodyHtml = ['正确', '错误'].map((t, k) =>
        `<div class="opt" data-q="${i}" data-k="${k === 0}"><span class="opt-key">${k === 0 ? '✓' : '✗'}</span><span>${t}</span></div>`).join('');
    } else {
      bodyHtml = (q.options || []).map((o, k) =>
        `<div class="opt" data-q="${i}" data-k="${LETTERS[k]}"><span class="opt-key">${LETTERS[k]}</span><span>${esc(o)}</span></div>`).join('');
    }
    return `
      <div class="q-card" id="q-${i}">
        <div class="q-meta">
          <span class="badge type">${typeLabel}</span>
          ${diffLabel ? `<span class="badge ${q.difficulty}">${diffLabel}</span>` : ''}
          <span class="badge lec">第${q._order}章 ${esc(q._lecTitle)}</span>
        </div>
        <div class="q-stem"><span class="qn">${i + 1}.</span>${esc(q.stem)}</div>
        <div class="q-opts">${bodyHtml}</div>
        <div class="q-actions">
          <button data-reveal="${i}">显示答案</button>
        </div>
        <div class="explain" id="ex-${i}"></div>
      </div>`;
  }

  function bindQuestion(q, i) {
    const card = document.getElementById(`q-${i}`);
    if (q.type !== 'short') {
      card.querySelectorAll('.opt').forEach(opt => {
        opt.onclick = () => {
          const k = opt.dataset.k;
          if (q.type === 'multiple') {
            const set = new Set(quizState.answers[i] || []);
            set.has(k) ? set.delete(k) : set.add(k);
            quizState.answers[i] = [...set];
            opt.classList.toggle('selected');
          } else {
            quizState.answers[i] = (q.type === 'truefalse') ? (k === 'true') : k;
            card.querySelectorAll('.opt').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
          }
        };
      });
    }
    card.querySelector(`[data-reveal="${i}"]`).onclick = () => revealQuestion(q, i);
  }

  function normAns(q) {
    if (q.type === 'multiple') return [].concat(q.answer).map(String).sort().join('');
    if (q.type === 'truefalse') return String(q.answer);
    return String(q.answer);
  }
  function userAns(q, i) {
    const a = quizState.answers[i];
    if (a == null) return null;
    if (q.type === 'multiple') return [].concat(a).map(String).sort().join('');
    return String(a);
  }

  function revealQuestion(q, i) {
    const card = document.getElementById(`q-${i}`);
    const ex = document.getElementById(`ex-${i}`);
    if (q.type !== 'short') {
      const correctKeys = q.type === 'multiple' ? [].concat(q.answer).map(String)
        : q.type === 'truefalse' ? [String(q.answer)] : [String(q.answer)];
      card.querySelectorAll('.opt').forEach(o => {
        const k = o.dataset.k;
        const isCorrect = correctKeys.includes(k);
        const isPicked = o.classList.contains('selected');
        o.classList.remove('selected');
        if (isCorrect) o.classList.add('correct');
        else if (isPicked) o.classList.add('wrong');
      });
    }
    const ansText = q.type === 'truefalse' ? (q.answer ? '正确' : '错误')
      : q.type === 'multiple' ? [].concat(q.answer).join('、')
      : q.type === 'short' ? '' : q.answer;
    ex.innerHTML = `
      ${q.type === 'short'
        ? `<div class="ex-head">参考答案</div><div>${mdToHtml(q.answer)}</div>`
        : `<div class="ex-head">正确答案：<span class="ex-ans">${esc(ansText)}</span></div>`}
      ${q.explanation ? `<div class="ex-head" style="margin-top:8px">解析</div><div>${mdToHtml(q.explanation)}</div>` : ''}`;
    ex.classList.add('show');
    renderMath(ex);
  }

  function submitAll() {
    let correct = 0, graded = 0;
    quizState.questions.forEach((q, i) => {
      revealQuestion(q, i);
      if (q.type === 'short') return;
      graded++;
      if (userAns(q, i) !== null && userAns(q, i) === normAns(q)) correct++;
    });
    const sum = document.getElementById('quizSummary');
    const pct = graded ? Math.round(correct / graded * 100) : 0;
    sum.innerHTML = `成绩：客观题答对 <b>${correct}</b> / ${graded}（${pct}%）${quizState.questions.some(q=>q.type==='short')?'，简答题请对照参考答案自评。':''}
      <div class="q-actions"><button id="retry" class="btn-primary">重做本组</button></div>`;
    document.getElementById('retry').onclick = () => buildQuiz(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function shuffleArr(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((i + 1) * pseudo()); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  let _seed = 1;
  function pseudo() { _seed = (_seed * 9301 + 49297) % 233280; return _seed / 233280; }

  /* ---------- exams (mock papers) ---------- */
  const examCache = {};
  async function getExam(id) {
    if (examCache[id]) return examCache[id];
    const d = await fetch(`./data/${id}.json`).then(r => r.ok ? r.json() : null);
    examCache[id] = d;
    return d;
  }

  async function viewExams() {
    const idx = await getIndex();
    const exams = idx.exams || [];
    const datas = await Promise.all(exams.map(e => getExam(e.id)));
    const cards = exams.map((e, i) => {
      const d = datas[i] || {};
      const nQ = (d.sections || []).reduce((s, sec) => s + sec.questions.length, 0);
      const types = (d.sections || []).map(s => s.name.replace(/^[一二三四五六、]+/, '')).join(' · ');
      return `<a class="card" href="#/exam/${e.id}">
        <div class="c-top"><span class="c-icon">📝</span>
          <div><div class="c-order">${esc(e.code || '')} · ${e.points || 100} 分</div><h3 class="c-title">${esc(e.title)}</h3></div></div>
        <div class="c-desc">${esc(types)}</div>
        <div class="c-meta"><span>题量 <b>${nQ}</b></span><span>满分 <b>${e.points || 100}</b></span></div>
      </a>`;
    }).join('');
    appEl.innerHTML = `
      <div class="lec-head">
        <h1>📝 期末真题 & 模拟试卷</h1>
        <div class="en">4 套上海交大历年期末真题（2024 春 / 2024 秋 / 2025 春 / 2025 秋）+ 3 套仿真模拟卷 · 全部附完整参考解答与解析</div>
        <div class="summary">建议<strong>限时 120 分钟、合上答案先做一遍</strong>，再逐题对照参考答案与解析。真题按原卷转写求解，模拟卷按本教材（《概率论与数理统计——基于案例分析》）章节范围命制。</div>
      </div>
      <div class="grid">${cards}</div>`;
  }

  const CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  function examOptionsHtml(q) {
    if (q.type === 'truefalse') {
      return `<div class="exam-opts"><span class="exam-opt">A. 正确（√）</span><span class="exam-opt">B. 错误（×）</span></div>`;
    }
    if (q.options) {
      return `<div class="exam-opts">${q.options.map((o, k) => `<span class="exam-opt">${LETTERS[k]}. ${esc(o)}</span>`).join('')}</div>`;
    }
    return '';
  }
  function examAnswerHtml(q) {
    let ans;
    if (q.type === 'truefalse') ans = q.answer ? '正确（√）' : '错误（×）';
    else if (q.type === 'multiple') ans = [].concat(q.answer).join('、');
    else if (q.type === 'single') ans = q.answer;
    else ans = null; // open question
    return `
      ${ans !== null ? `<div class="ex-head">参考答案：<span class="ex-ans">${esc(ans)}</span></div>` : `<div class="ex-head">参考答案</div>`}
      ${q.answer && ans === null ? `<div>${mdToHtml(q.answer)}</div>` : ''}
      ${q.explanation ? `<div class="ex-head" style="margin-top:8px">解析</div><div>${mdToHtml(q.explanation)}</div>` : ''}`;
  }

  async function viewExam(id) {
    const idx = await getIndex();
    const meta = (idx.exams || []).find(e => e.id === id);
    const d = await getExam(id);
    if (!d) { appEl.innerHTML = `<div class="empty">未找到该试卷。<br><a href="#/exams">返回试卷列表</a></div>`; return; }
    let gi = 0; // global question counter for answer toggles
    const sections = (d.sections || []).map(sec => {
      const secPts = sec.questions.reduce((s, q) => s + (q.points || 0), 0);
      const qs = sec.questions.map((q, n) => {
        const qid = gi++;
        const qtype = q.type || sec.type;
        const qq = { ...q, type: qtype };
        return `<div class="exam-q">
          <div class="exam-q-head"><span class="exam-qn">${n + 1}.</span><span class="exam-stem">${esc(q.stem)}</span><span class="exam-pts">（${q.points} 分）</span></div>
          ${examOptionsHtml(qq)}
          <button class="exam-reveal" data-ex="${qid}">显示答案</button>
          <div class="explain" id="exa-${qid}">${examAnswerHtml(qq)}</div>
        </div>`;
      }).join('');
      return `<section class="exam-sec">
        <h2 class="exam-sec-title">${esc(sec.name)} <span class="exam-sec-pts">（${secPts} 分）</span></h2>
        ${sec.desc ? `<div class="exam-sec-desc">${esc(sec.desc)}</div>` : ''}
        ${qs}
      </section>`;
    }).join('');
    appEl.innerHTML = `
      <div class="exam-paper">
        <div class="exam-header">
          <div class="crumb"><a href="#/exams">模拟卷</a> / ${esc(meta ? meta.code : '')}</div>
          <h1>${esc(d.title)} <span class="exam-code">${esc(d.code || '')}</span></h1>
          <div class="exam-info">满分 ${d.totalPoints || 100} 分 · 建议用时 ${esc(d.duration || '120分钟')} · ${esc(d.note || '开卷')}</div>
          <div class="q-actions"><button id="exRevealAll" class="btn-primary">显示全部答案</button><button id="exHideAll">隐藏全部答案</button></div>
        </div>
        ${sections}
      </div>`;
    appEl.querySelectorAll('.exam-reveal').forEach(btn => {
      btn.onclick = () => {
        const ex = document.getElementById(`exa-${btn.dataset.ex}`);
        const open = ex.classList.toggle('show');
        btn.textContent = open ? '隐藏答案' : '显示答案';
      };
    });
    document.getElementById('exRevealAll').onclick = () => {
      appEl.querySelectorAll('.explain').forEach(e => e.classList.add('show'));
      appEl.querySelectorAll('.exam-reveal').forEach(b => b.textContent = '隐藏答案');
    };
    document.getElementById('exHideAll').onclick = () => {
      appEl.querySelectorAll('.explain').forEach(e => e.classList.remove('show'));
      appEl.querySelectorAll('.exam-reveal').forEach(b => b.textContent = '显示答案');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    renderMath(appEl);
  }

  /* ---------- homeworks (作业题解) ---------- */
  const hwCache = {};
  async function getHw(id) {
    if (hwCache[id]) return hwCache[id];
    const d = await fetch(`./data/${id}.json`).then(r => r.ok ? r.json() : null);
    hwCache[id] = d;
    return d;
  }

  async function viewHomeworks() {
    const idx = await getIndex();
    const hws = idx.homeworks || [];
    const datas = await Promise.all(hws.map(h => getHw(h.id)));
    const cards = hws.map((h, i) => {
      const d = datas[i] || {};
      const n = (d.problems || []).length;
      return `<a class="card" href="#/hw/${h.id}">
        <div class="c-top"><span class="c-icon">✍️</span>
          <div><div class="c-order">作业</div><h3 class="c-title">${esc(h.title)}</h3></div></div>
        <div class="c-meta"><span>题目 <b>${n}</b></span></div>
      </a>`;
    }).join('');
    appEl.innerHTML = `
      <div class="lec-head">
        <h1>✍️ 作业题解</h1>
        <div class="en">教材课后习题精选 · 题面 + 详细解答</div>
        <div class="summary">点击各次作业查看题目与解答。建议<strong>先自己做，再点「显示解答」对照</strong>。解答为 AI 依据教材扫描整理的参考答案，请自行复核关键步骤与数值。</div>
      </div>
      <div class="grid">${cards}</div>`;
  }

  async function viewHomework(id) {
    const idx = await getIndex();
    const d = await getHw(id);
    if (!d) { appEl.innerHTML = `<div class="empty">未找到该作业。<br><a href="#/homeworks">返回作业列表</a></div>`; return; }
    const probs = d.problems || [];
    const body = probs.map((p, i) => `
      <div class="q-card" id="hw-${i}">
        <div class="q-meta"><span class="badge type">第 ${esc(p.no)} 题</span></div>
        <div class="kp-body">${mdToHtml(p.statement)}</div>
        <div class="q-actions"><button data-hw="${i}">显示解答</button></div>
        <div class="explain" id="sol-${i}"><div class="ex-head">解答</div>${mdToHtml(p.solution)}</div>
      </div>`).join('');
    appEl.innerHTML = `
      <div class="lec-head">
        <div class="crumb"><a href="#/homeworks">作业</a> / ${esc(d.title)}</div>
        <h1>✍️ ${esc(d.title)}</h1>
        <div class="en">共 ${probs.length} 题</div>
        <div class="q-actions"><button id="hwRevealAll" class="btn-primary">显示全部解答</button><button id="hwHideAll">隐藏全部解答</button></div>
      </div>
      <div class="kp-list">${body || '<div class="empty">本次作业整理中…</div>'}</div>`;
    appEl.querySelectorAll('[data-hw]').forEach(btn => {
      btn.onclick = () => {
        const s = document.getElementById(`sol-${btn.dataset.hw}`);
        const open = s.classList.toggle('show');
        btn.textContent = open ? '隐藏解答' : '显示解答';
      };
    });
    document.getElementById('hwRevealAll').onclick = () => {
      appEl.querySelectorAll('.explain').forEach(e => e.classList.add('show'));
      appEl.querySelectorAll('[data-hw]').forEach(b => b.textContent = '隐藏解答');
    };
    document.getElementById('hwHideAll').onclick = () => {
      appEl.querySelectorAll('.explain').forEach(e => e.classList.remove('show'));
      appEl.querySelectorAll('[data-hw]').forEach(b => b.textContent = '显示解答');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    renderMath(appEl);
  }

  /* ---------- search ---------- */
  async function buildSearch() {
    if (searchIndex) return searchIndex;
    const all = await getAllLectures();
    const items = [];
    all.forEach(({ meta, data }) => {
      (data.knowledgePoints || []).forEach((k, i) => {
        items.push({ kind: '知识点', lec: meta.title, title: k.title, text: (k.title + ' ' + (Array.isArray(k.content) ? k.content.join(' ') : k.content || '')).toLowerCase(), href: `#/lecture/${meta.id}` });
      });
      (data.questions || []).forEach(q => {
        items.push({ kind: '题目', lec: meta.title, title: q.stem, text: (q.stem || '').toLowerCase(), href: `#/quiz/${meta.id}` });
      });
      items.push({ kind: '章节', lec: meta.title, title: meta.title + ' ' + (meta.en||''), text: (meta.title + ' ' + (meta.en||'') + ' ' + (meta.desc||'')).toLowerCase(), href: `#/lecture/${meta.id}` });
    });
    searchIndex = items;
    return items;
  }
  async function doSearch(qstr) {
    const box = document.getElementById('searchResults');
    const q = qstr.trim().toLowerCase();
    if (!q) { box.hidden = true; return; }
    const items = await buildSearch();
    const hits = items.filter(it => it.text.includes(q)).slice(0, 30);
    box.hidden = false;
    box.innerHTML = hits.length ? hits.map(h =>
      `<a class="sr-item" href="${h.href}"><div class="sr-kind">${h.kind} · ${esc(h.lec)}</div><div class="sr-title">${esc(h.title.slice(0, 70))}</div></a>`
    ).join('') : `<div class="sr-empty">没有找到「${esc(qstr)}」</div>`;
  }

  /* ---------- router ---------- */
  async function route() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const parts = hash.split('/').filter(Boolean); // e.g. ['lecture','l2']
    document.getElementById('searchResults').hidden = true;
    setActiveNav(parts[0] || 'home');
    appEl.innerHTML = `<div class="loading">加载中…</div>`;
    try {
      if (!parts.length || parts[0] === 'home') return void await viewHome();
      if (parts[0] === 'lectures') return void await viewHome();
      if (parts[0] === 'lecture') return void await viewLecture(parts[1]);
      if (parts[0] === 'quiz') return void await viewQuiz(parts[1] || null);
      if (parts[0] === 'exams') return void await viewExams();
      if (parts[0] === 'exam') return void await viewExam(parts[1]);
      if (parts[0] === 'homeworks') return void await viewHomeworks();
      if (parts[0] === 'hw') return void await viewHomework(parts[1]);
      await viewHome();
    } catch (e) {
      appEl.innerHTML = `<div class="empty">加载出错：${esc(e.message)}<br><a href="#/">返回首页</a></div>`;
      console.error(e);
    }
    window.scrollTo(0, 0);
  }

  function setActiveNav(key) {
    const map = { '': 'home', 'home': 'home', 'lectures': 'lectures', 'lecture': 'lectures', 'quiz': 'quiz', 'exams': 'exams', 'exam': 'exams', 'homeworks': 'homeworks', 'hw': 'homeworks' };
    const active = map[key] || 'home';
    document.querySelectorAll('.topnav a').forEach(a => a.classList.toggle('active', a.dataset.nav === active));
  }

  /* ---------- theme ---------- */
  function initTheme() {
    const saved = localStorage.getItem('ml-theme');
    const t = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
    const btn = document.getElementById('themeToggle');
    btn.textContent = t === 'dark' ? '☀️' : '🌙';
    btn.onclick = () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('ml-theme', next);
      btn.textContent = next === 'dark' ? '☀️' : '🌙';
    };
  }

  function init() {
    initTheme();
    const si = document.getElementById('globalSearch');
    let t; si.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => doSearch(si.value), 150); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-box')) document.getElementById('searchResults').hidden = true;
    });
    window.addEventListener('hashchange', route);
    route();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  return {};
})();
