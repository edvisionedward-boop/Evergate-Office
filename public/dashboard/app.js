import {
  clockMs, greeting, fmtUtc8, fmtScore, round2, scoreModel, taskModel, klParts, klToMs,
} from './score.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const state = {
  ready: false,
  data: null,
  usage: null,
  exams: null,
  pipeline: null,
  clock: clockMs(location.search),
  animated: false,
  errors: {},
};

const scoreBody = document.getElementById('scoreBody');
const taskBody = document.getElementById('taskBody');
const usageBody = document.getElementById('usageBody');
const examBody = document.getElementById('examBody');
const pipeBody = document.getElementById('pipeBody');

function nowMs() {
  return state.clock.frozen ? state.clock.ms : Date.now();
}

async function loadJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

function emptyBox(title, body) {
  return `<div class="empty"><p class="kicker">暂无数据</p><p>${esc(title)}</p>${body ? `<p>${esc(body)}</p>` : ''}</div>`;
}

function spark(series, key) {
  const vals = (series || []).map((p) => p[key]).filter((v) => v != null);
  if (vals.length < 2) return '';
  const w = 160;
  const h = 36;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - 3 - ((v - min) / span) * (h - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" /></svg>`;
}

function todayDelta(series, key, at) {
  if (!series?.length || series[series.length - 1][key] == null) return null;
  const p = klParts(new Date(at));
  const midnight = klToMs(p.year, p.month, p.day, 0, 0);
  let base = series[0][key];
  if (base == null) return null;
  for (const pt of series) {
    if (pt.t <= midnight && pt[key] != null) base = pt[key];
  }
  const last = series[series.length - 1][key];
  return round2(last - base);
}

function deltaText(delta) {
  if (delta == null || delta === 0) return '';
  const up = delta > 0 ? ' up' : '';
  const sign = delta > 0 ? '+' : '';
  return `<p class="today${up}">今日 ${sign}${fmtScore(delta)}</p>`;
}

function renderScore(filters = {}) {
  const data = state.data;
  if (!data) {
    scoreBody.innerHTML = emptyBox('办公室数据暂时读不到。', '有数据之后，这里显示公司总分、部门排名和员工分数。不会用估计数字填空。');
    return;
  }
  const at = nowMs();
  const model = scoreModel(data, at);
  state.score = model;
  const q = filters.q || '';
  const dept = filters.dept || '';
  const max = model.departments[0]?.total || 1;
  const rules = data.workRules || {};
  const parts = klParts(new Date(at));
  const open = (rules.workStart || '09:00').split(':').map(Number);
  const close = (rules.workEnd || '18:00').split(':').map(Number);
  const mins = parts.hour * 60 + parts.minute;
  const openM = open[0] * 60 + (open[1] || 0);
  const closeM = close[0] * 60 + (close[1] || 0);
  const live = (rules.workDays || [1, 2, 3, 4, 5]).includes(parts.dow) && mins >= openM && mins < closeM;
  const when = state.clock.frozen
    ? `以下数字按 ${fmtUtc8(at)} 计算。`
    : '以下数字随吉隆坡时间更新。';
  const history = model.historyReconciled
    ? '折线里的任务分，只在办公室动态写明达标分的时刻上升，并且已经和每个人现在的任务分对过。'
    : '任务分没有逐笔记下时间。折线只画工时分，任务分用现在的数字，不往回填。';
  const bars = model.departments.map((d, i) => {
    const pct = max > 0 ? Math.max(2, (d.total / max) * 100) : 0;
    return `<div class="bar-row"><span>${esc(d.name)}</span><span class="track"><i data-w="${pct.toFixed(1)}" style="opacity:${(1 - i * 0.08).toFixed(2)}"></i></span><b>${fmtScore(d.total)}</b></div>`;
  }).join('');
  const options = ['<option value="">全部部门</option>'].concat(model.departments.map((d) => (
    `<option value="${esc(d.id)}"${d.id === dept ? ' selected' : ''}>${esc(d.full)}</option>`
  ))).join('');
  const shown = model.rows.filter((r) => {
    if (dept && r.teamId !== dept) return false;
    if (!q) return true;
    const hay = `${r.name} ${r.chip} ${r.team} ${r.teamName}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const listMax = shown[0]?.total || model.rows[0]?.total || 1;
  const people = shown.length
    ? shown.map((r) => {
      const rank = model.rows.findIndex((x) => x.id === r.id) + 1;
      const w = listMax > 0 ? (r.total / listMax) * 100 : 0;
      return `<article class="person"><span class="rk">${rank}</span><span class="nm">${esc(r.name)}</span><span class="dept">${esc(r.teamName)}</span><span class="bit">任务分 <b>${fmtScore(r.task)}</b></span><span class="bit">工时分 <b>${fmtScore(r.hourPts)}</b></span><span class="bit">加班 <b>${fmtScore(r.overtime)}</b></span><span class="tot">${fmtScore(r.total)}</span><span class="mini"><i data-w="${w.toFixed(1)}"></i></span></article>`;
    }).join('')
    : '<p class="note">没有符合筛选的员工。</p>';
  const companyDelta = todayDelta(model.series, 'total', at);
  const hourDelta = todayDelta(model.series, 'hourPts', at);
  const taskDelta = model.historyReconciled ? todayDelta(model.series, 'task', at) : null;

  const focusId = document.activeElement?.id;
  const caret = document.activeElement?.selectionStart;
  scoreBody.innerHTML = `
    <div class="stats">
      <article class="stat"><p class="k">公司总分</p><p class="num">${fmtScore(model.company)}</p>${spark(model.series, 'total')}${deltaText(companyDelta)}</article>
      <article class="stat"><p class="k">任务分</p><p class="num">${fmtScore(model.task)}</p>${model.historyReconciled ? spark(model.series, 'task') : ''}${deltaText(taskDelta)}</article>
      <article class="stat"><p class="k">工时分</p><p class="num">${fmtScore(model.hourPts)}</p>${spark(model.series, 'hourPts')}${deltaText(hourDelta)}</article>
      <article class="stat"><p class="k">加班（不计入总分）</p><p class="num">${fmtScore(model.overtime)}</p><p class="today">只统计已经记下的加班小时</p></article>
    </div>
    <p class="note">${esc(when)} 计入 ${model.headcount} 人，每人 ${model.hours.toFixed(2)} 小时、工时分 ${fmtScore(model.hourEach)}。${live ? '现在处于计工时时段。' : '现在不在计工时时段。'} 显示分 = 任务分 − 重大失职扣分 + 工时分，与办公室头顶分数条相同。工时自 ${esc(model.trackingLabel || '起算时刻')} 起，周一至周五 09:00–18:00（吉隆坡）每小时 0.50。加班按已记录小时 × 0.80 列出，不计入总分。</p>
    <div class="split">
      <article class="card"><h3>部门排名</h3>${bars || emptyBox('暂无计入工时的部门。')}<p class="note">部门合计含每人相同的工时分，人数多的部门会更高。</p></article>
      <article class="card"><h3>分数随时间</h3><div class="chart-wrap" id="lineHost"></div><div class="legend"><span class="a"><i></i>公司总分</span><span class="b"><i></i>其中工时分</span></div><p class="note">${esc(history)}</p></article>
    </div>
    <div class="filters">
      <input id="scoreSearch" type="search" aria-label="搜索员工" placeholder="搜索员工" value="${esc(q)}" enterkeyhint="search" autocomplete="off" />
      <select id="scoreDept" aria-label="按部门筛选">${options}</select>
    </div>
    <div id="boardList">${people}</div>
    ${model.edOff ? '<div class="lock">ED · 不计工时条</div>' : ''}
    ${model.hasPrivate ? '<div class="lock">私密</div>' : ''}
  `;
  drawLine(model);
  const kick = () => {
    scoreBody.querySelectorAll('[data-w]').forEach((el) => { el.style.width = `${el.dataset.w}%`; });
  };
  if (state.animated || matchMedia('(prefers-reduced-motion: reduce)').matches) kick();
  else requestAnimationFrame(kick);
  if (focusId === 'scoreSearch' || focusId === 'scoreDept') {
    const el = document.getElementById(focusId);
    if (el) {
      el.focus();
      if (caret != null && el.setSelectionRange) el.setSelectionRange(caret, caret);
    }
  }
}

function drawLine(model) {
  const host = document.getElementById('lineHost');
  if (!host) return;
  const series = model.series || [];
  if (series.length < 2) {
    host.innerHTML = '<p class="note">还不能画出随时间变化的曲线。</p>';
    return;
  }
  const w = 640;
  const h = 260;
  const pad = { l: 48, r: 14, t: 16, b: 32 };
  const xs = series.map((p) => p.t);
  const minX = xs[0];
  const maxX = xs[xs.length - 1];
  const maxY = Math.max(...series.map((p) => p.total || 0), ...series.map((p) => p.hourPts || 0), 1);
  const yMax = Math.ceil(maxY / 20) * 20 || 20;
  const X = (t) => pad.l + ((t - minX) / (maxX - minX || 1)) * (w - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - v / yMax) * (h - pad.t - pad.b);
  const pathOf = (key) => series.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p[key] || 0).toFixed(1)}`).join('');
  const total = pathOf('total');
  const hour = pathOf('hourPts');
  const area = `${total} L${X(series.at(-1).t).toFixed(1)},${Y(0).toFixed(1)} L${X(series[0].t).toFixed(1)},${Y(0).toFixed(1)} Z`;
  const grids = [0, 0.5, 1].map((g) => {
    const y = Y(yMax * g);
    const label = fmtScore(yMax * g).replace(/\.00$/, '');
    return `<line class="grid" x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" /><text class="axis" x="4" y="${y + 4}">${label}</text>`;
  }).join('');
  const tickTimes = [minX, minX + (maxX - minX) / 2, maxX];
  const xlabels = tickTimes.map((t, i) => {
    const when = fmtUtc8(t).replace(' (UTC+8)', '').slice(5);
    const anchor = i === 0 ? 'start' : i === tickTimes.length - 1 ? 'end' : 'middle';
    const x = i === 0 ? pad.l : i === tickTimes.length - 1 ? w - pad.r : X(t);
    return `<text class="axis" x="${x}" y="${h - 8}" text-anchor="${anchor}">${esc(when)}</text>`;
  }).join('');
  host.innerHTML = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="公司总分与工时分随时间变化">
    <defs><linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ec8ff" stop-opacity=".45"/><stop offset="1" stop-color="#9ec8ff" stop-opacity="0"/></linearGradient></defs>
    ${grids}${xlabels}
    <path class="area" d="${area}" />
    <path class="line-hour" d="${hour}" />
    <path class="line-total" d="${total}" />
  </svg>
  <p class="note" id="lineRead">${esc(fmtUtc8(series.at(-1).t))} · 总分 ${fmtScore(series.at(-1).total)} · 工时分 ${fmtScore(series.at(-1).hourPts)}</p>`;
  const line = host.querySelector('.line-total');
  if (!line || state.animated || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const len = line.getTotalLength();
  line.style.strokeDasharray = `${len}`;
  line.style.strokeDashoffset = `${len}`;
  line.style.transition = 'stroke-dashoffset 1.1s ease';
  requestAnimationFrame(() => { line.style.strokeDashoffset = '0'; });
}

function renderTasks() {
  if (!state.data) {
    taskBody.innerHTML = emptyBox('任务板暂时读不到。', '有数据之后，这里按进行中、待确认、已完成计数。');
    return;
  }
  const model = taskModel(state.data);
  const item = (row, confirm) => `<article class="titem${confirm ? ' confirm' : ''}"><div class="row"><span class="pill" style="color:${esc(row.color)}">${esc(row.teamName)}</span><span>${esc(row.when)}</span></div><h3>${esc(row.title)}</h3><p class="meta">${esc(row.stars)} · 分值 ${esc(row.points)}</p></article>`;
  const done = model.done.length
    ? model.done.map((row) => item(row, false)).join('')
    : emptyBox('还没有已完成的任务。');
  const confirm = model.confirm.length
    ? model.confirm.map((row) => item(row, true)).join('')
    : emptyBox('现在没有待你确认的事项。');
  taskBody.innerHTML = `
    <div class="counts">
      <article class="stat count"><p class="k">进行中</p><p class="num">${model.count.doing}</p></article>
      <article class="stat count"><p class="k">待确认</p><p class="num">${model.count.confirm}</p></article>
      <article class="stat count"><p class="k">已完成</p><p class="num">${model.count.done}</p></article>
    </div>
    <p class="note">共 ${model.total} 项公开任务。星级和单题分值只在任务自己记下时显示；目前任务条没有这两栏，完成分记在员工的任务分里，这里不倒推。</p>
    <div class="split">
      <article class="card"><h3>最近完成</h3><div class="list">${done}</div></article>
      <article class="card"><h3>待 Edward 确认</h3><div class="list">${confirm}</div></article>
    </div>`;
}

const USAGE_COLORS = ['#60a5fa', '#38bdf8', '#22d3ee', '#2dd4bf', '#818cf8', '#93c5fd', '#67e8f9', '#a5b4fc', '#7dd3fc', '#bae6fd'];

function pctLabel(n) {
  const v = Math.round(Number(n) * 10) / 10;
  if (!Number.isFinite(v)) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function renderUsage() {
  const doc = state.usage;
  const reports = Array.isArray(doc?.reports) ? doc.reports.filter((r) => r && r.date) : [];
  if (!reports.length) {
    usageBody.innerHTML = emptyBox('用量日报尚未写入。', '会计部把新的一天追加到 data/usage.json 之后，这里才会出现额度。本页不显示未经核对的金额。');
    return;
  }
  reports.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const current = reports.find((r) => r.date === state.usageDate) || reports[reports.length - 1];
  state.usageDate = current.date;
  const pick = reports.length > 1
    ? `<select class="report-pick" id="usagePick" aria-label="选择日报">${reports.map((r) => `<option value="${esc(r.date)}"${r.date === current.date ? ' selected' : ''}>${esc(r.date)}</option>`).join('')}</select>`
    : '';
  const shares = Array.isArray(current.departmentShares) ? current.departmentShares.filter((s) => Number.isFinite(Number(s.percent))) : [];
  const slices = shares.map((s, i) => ({
    dept: s.dept,
    percent: Number(s.percent),
    note: s.dept === '私密' ? '不展开' : (s.note || ''),
    color: s.dept === '私密' ? '#94a3b8' : USAGE_COLORS[i % USAGE_COLORS.length],
  }));
  const used = Number(current.weekUsedPercent);
  const gauge = Number.isFinite(used) ? gaugeSVG(Math.max(0, Math.min(100, used)), pctLabel(used)) : '';
  usageBody.innerHTML = `
    <div class="facts">${pick}<span class="status">${esc(current.status || '')}</span><span>报告日 ${esc(current.date)}</span><span>计划 ${esc(current.plan || '—')}</span><span>重置 ${esc(current.resetNote || '')}</span></div>
    <div class="usage-grid">
      <article class="card">
        <h3>本周额度</h3>
        ${gauge || '<p class="note">日报没有额度百分比。</p>'}
        <p class="big">${Number.isFinite(used) ? `${pctLabel(used)}%` : '—'}</p>
        <p class="note">${esc(current.weekUsedNote || '')}</p>
        <p class="note">Grok Bot 占 ${esc(pctLabel(current.grokBotSharePercent))}%。${esc(current.weekNote || '')}</p>
      </article>
      <article class="card">
        <h3>部门份额</h3>
        <div class="donut-wrap">${donutSVG(slices)}<div>${slices.map((s) => `<div class="share"><i class="swatch" style="background:${s.color}"></i><span>${esc(s.dept)}<small>${esc(s.note)}</small></span><b>${pctLabel(s.percent)}%</b></div>`).join('') || '<p class="note">日报没有部门份额。</p>'}</div></div>
      </article>
    </div>
    <div class="callout">${esc(current.caveat || '11 月 5 日包含办公室建设，不能当成平常的一天。')}</div>
    <p class="note">${esc(current.trailing30d?.note || '')}</p>
    ${Array.isArray(current.scheduledTasks) && current.scheduledTasks.length ? `<article class="card"><h3>定时任务（日报已点名）</h3>${current.scheduledTasks.map((t) => `<p class="note">${esc(t.dept || '')} · ${esc(t.name || '')} · ${esc(t.shareNote || '')} · ${esc(t.cadenceNote || '')}</p>`).join('')}</article>` : ''}
    <p class="note">${esc(current.moneyNote || '没有已核对的金额，本页不显示费用。')} ${esc(current.cursorNote || '')}</p>
    <p class="note">时点 ${esc(current.asOfNote || '')} · ${esc(current.preparedBy || '')} · ${esc(current.source || '')}</p>
  `;
}

function gaugeSVG(visualPct, label) {
  const r = 52;
  const c = Math.PI * r;
  const len = c * (visualPct / 100);
  return `<svg class="gauge" viewBox="0 0 140 86" role="img" aria-label="本周额度已用 ${label}%">
    <path d="M16 70 A52 52 0 0 1 124 70" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="12" stroke-linecap="round"/>
    <path class="gauge-val" d="M16 70 A52 52 0 0 1 124 70" fill="none" stroke="#8ec2ff" stroke-width="12" stroke-linecap="round" stroke-dasharray="${len.toFixed(1)} ${(c - len).toFixed(1)}"/>
  </svg>`;
}

function donutSVG(slices) {
  if (!slices.length) return '';
  const r = 42;
  const c = 2 * Math.PI * r;
  const sum = slices.reduce((n, s) => n + s.percent, 0) || 1;
  let acc = 0;
  const arcs = slices.map((s) => {
    const len = c * (s.percent / sum);
    const gap = Math.min(1.5, len * 0.08);
    const draw = Math.max(0, len - gap);
    const rot = (acc / sum) * 360 - 90;
    acc += s.percent;
    return `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${s.color}" stroke-width="12" stroke-linecap="butt" stroke-dasharray="${draw.toFixed(2)} ${(c - draw).toFixed(2)}" transform="rotate(${rot.toFixed(2)} 60 60)" />`;
  }).join('');
  return `<svg class="donut" viewBox="0 0 120 120" role="img" aria-label="Grok Bot 用量的部门份额">${arcs}<text x="60" y="56" text-anchor="middle" font-size="11">部门份额</text><text x="60" y="74" text-anchor="middle" font-size="16">${pctLabel(sum)}%</text></svg>`;
}

const EXAM_LINE = '首次全员考核 2026-11-16（周一），当天成绩为基准线，之后定期复测对比成长';

function renderExams() {
  const doc = state.exams;
  if (!doc) {
    examBody.innerHTML = emptyBox(EXAM_LINE, '考核档案暂时读不到。读到空档案时也会保持这句话，不会填上分数。');
    return;
  }
  const names = new Map();
  for (const team of state.data?.teams || []) {
    if (team.private) continue;
    for (const staff of team.staff || []) names.set(staff.id, { name: staff.name, team: team.short || team.name });
  }
  const groups = new Map();
  for (const rec of doc.records || []) {
    if (!rec || !names.has(rec.employeeId)) continue;
    const score = Number(rec.score);
    const date = String(rec.date || '');
    if (!Number.isFinite(score) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const list = groups.get(rec.employeeId) || [];
    list.push({ date, score });
    groups.set(rec.employeeId, list);
  }
  if (!groups.size) {
    examBody.innerHTML = emptyBox(EXAM_LINE);
    return;
  }
  const colors = ['#d6e8ff', '#7eb6ff', '#6eebc0', '#f3d48a', '#c4b5fd'];
  let i = 0;
  const legend = [];
  const series = [];
  for (const [id, points] of groups) {
    points.sort((a, b) => a.date.localeCompare(b.date));
    const who = names.get(id);
    const color = colors[i % colors.length];
    i += 1;
    legend.push(`<span><i style="background:${color}"></i>${esc(who.team)} ${esc(who.name)}</span>`);
    series.push({ color, points });
  }
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const scores = series.flatMap((s) => s.points.map((p) => p.score));
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const y0 = Math.min(min, 0);
  const y1 = Math.max(max, min + 1);
  const w = 640;
  const h = 240;
  const pad = { l: 36, r: 12, t: 16, b: 28 };
  const X = (date) => pad.l + (dates.indexOf(date) / Math.max(1, dates.length - 1)) * (w - pad.l - pad.r);
  const Y = (score) => pad.t + (1 - (score - y0) / (y1 - y0)) * (h - pad.t - pad.b);
  const paths = series.map((s) => {
    const d = s.points.map((p, idx) => `${idx ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(p.score).toFixed(1)}`).join('');
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" />`;
  }).join('');
  examBody.innerHTML = `<article class="card"><h3>复测对比</h3><svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="考核成绩">${paths}</svg><div class="legend">${legend.join('')}</div><p class="note">基准日 2026-11-16。${esc(EXAM_LINE)}</p></article>`;
}

const PIPE_STAGES = ['候选', '已验证需求', '已接触', '洽谈中', '签约'];

function renderPipeline() {
  const doc = state.pipeline;
  const principle = doc?.principle || '少而对的客户';
  const stages = Array.isArray(doc?.stages) && doc.stages.length ? doc.stages.map(String) : PIPE_STAGES;
  const records = Array.isArray(doc?.records) ? doc.records : [];
  const privacy = '客户名称和联系细节只保存在内部。这个公开页面只按阶段计数，不显示客户是谁。';
  if (!doc) {
    pipeBody.innerHTML = emptyBox('客户进度暂时读不到。', `${privacy} 原则是${principle}。`);
    return;
  }
  const flow = stages.map((s) => `<span>${esc(s)}</span>`).join('<i>→</i>');
  if (!records.length) {
    pipeBody.innerHTML = `${emptyBox('客户开发还没有录入。', `阶段是下面这条路。原则：${principle}。${privacy}`)}<div class="flow">${flow}</div>`;
    return;
  }
  const counts = new Map(stages.map((s) => [s, 0]));
  let other = 0;
  for (const rec of records) {
    const stage = rec && rec.stage;
    if (counts.has(stage)) counts.set(stage, counts.get(stage) + 1);
    else other += 1;
  }
  const chips = [...counts.entries()].map(([stage, n]) => `<span>${esc(stage)} ${n}</span>`).join('<i>→</i>');
  pipeBody.innerHTML = `<article class="card"><h3>各阶段数量</h3><div class="flow">${chips}</div>${other ? `<p class="note">其他阶段 ${other}</p>` : ''}<p class="note">原则：${esc(principle)}。${esc(privacy)}</p></article>`;
}

function paintHeader() {
  const at = nowMs();
  document.getElementById('hello').textContent = greeting(new Date(at));
  const label = state.data?.updatedAt ? fmtUtc8(state.data.updatedAt) : '— (UTC+8)';
  document.getElementById('updated').textContent = `数据更新 ${label}`;
}

function renderAll() {
  const filters = {
    q: document.getElementById('scoreSearch')?.value || '',
    dept: document.getElementById('scoreDept')?.value || '',
  };
  const focusId = document.activeElement?.id;
  const caret = document.activeElement?.selectionStart;
  paintHeader();
  renderScore(filters);
  renderTasks();
  renderUsage();
  renderExams();
  renderPipeline();
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) {
      el.focus();
      if (caret != null && el.setSelectionRange) el.setSelectionRange(caret, caret);
    }
  }
  state.animated = true;
  state.ready = true;
}

scoreBody.addEventListener('input', (e) => {
  if (e.target.id !== 'scoreSearch' && e.target.id !== 'scoreDept') return;
  renderScore({ q: document.getElementById('scoreSearch').value, dept: document.getElementById('scoreDept').value });
});
usageBody.addEventListener('change', (e) => {
  if (e.target.id !== 'usagePick') return;
  state.usageDate = e.target.value;
  renderUsage();
});

const sections = [...document.querySelectorAll('main section')];
const links = [...document.querySelectorAll('.pills a, .side a')];
const spy = new IntersectionObserver((entries) => {
  const visible = entries.filter((en) => en.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  const id = visible.target.id;
  for (const link of links) {
    link.setAttribute('aria-current', link.getAttribute('href') === `#${id}` ? 'true' : 'false');
  }
}, { rootMargin: '-30% 0px -55% 0px', threshold: [0.15, 0.4] });
sections.forEach((section) => spy.observe(section));

async function refresh() {
  const jobs = [
    ['data', new URL('../data.json', import.meta.url)],
    ['usage', new URL('../data/usage.json', import.meta.url)],
    ['exams', new URL('../data/exams.json', import.meta.url)],
    ['pipeline', new URL('../data/pipeline.json', import.meta.url)],
  ];
  await Promise.all(jobs.map(async ([key, url]) => {
    try {
      state[key] = await loadJson(url);
      state.errors[key] = null;
    } catch (err) {
      state.errors[key] = err;
      if (key !== 'data') state[key] = state[key] || null;
    }
  }));
  renderAll();
}

refresh();
setInterval(() => {
  if (!state.clock.frozen) renderScore({
    q: document.getElementById('scoreSearch')?.value || '',
    dept: document.getElementById('scoreDept')?.value || '',
  });
  paintHeader();
}, 30000);
setInterval(refresh, 60000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(() => {});
}

window.__dash = {
  get ready() { return state.ready; },
  get company() { return state.score?.company ?? null; },
  get hourEach() { return state.score?.hourEach ?? null; },
  get headcount() { return state.score?.headcount ?? null; },
  get reconciled() { return state.score?.historyReconciled ?? null; },
  get greeting() { return document.getElementById('hello')?.textContent || ''; },
  get updated() { return document.getElementById('updated')?.textContent || ''; },
  get errors() { return state.errors; },
};
