/* Company command centre. Numbers come from JSON; empty sections stay empty. */
(function () {
  'use strict';
  const M = window.EvergateDash;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FONT = '"PingFang SC","Hiragino Sans GB","WenQuanYi Micro Hei","Droid Sans Fallback",sans-serif';
  const GOLD_SERIES = ['#D0B993', '#E6D8C3', '#A98B5E', '#8A7049', '#C7B596', '#F4EFE6'];
  const MARKS = {
    ed: { shape: 'circle', fill: true }, ED: { shape: 'circle', fill: true },
    corpfin: { shape: 'circle', fill: false }, '会计部': { shape: 'circle', fill: false },
    invest: { shape: 'rect', fill: true }, '投资部': { shape: 'rect', fill: true },
    '规划部(已并入投资部)': { shape: 'rect', fill: false },
    legal: { shape: 'triangle', fill: true }, '法务部': { shape: 'triangle', fill: true },
    market: { shape: 'triangle', fill: false }, '市场部': { shape: 'triangle', fill: false },
    info: { shape: 'rectRot', fill: true }, '信息部': { shape: 'rectRot', fill: true },
    privfin: { shape: 'rectRot', fill: false }, '私密': { shape: 'rectRot', fill: false },
    logistics: { shape: 'star', fill: true }, '物流部': { shape: 'star', fill: true },
    design: { shape: 'star', fill: false }, '设计部': { shape: 'star', fill: false },
    review: { shape: 'cross', fill: true }, '审查部': { shape: 'cross', fill: true },
    it: { shape: 'cross', fill: false }, '科技部': { shape: 'cross', fill: false },
    '已用': { shape: 'circle', fill: true }, '按百分比剩下的部分': { shape: 'circle', fill: false },
  };
  function markFor(id) {
    if (MARKS[id]) return MARKS[id];
    const shapes = ['circle', 'rect', 'triangle', 'rectRot', 'star', 'cross'];
    let hash = 0;
    const key = String(id || '');
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return { shape: shapes[hash % shapes.length], fill: hash % 2 === 0 };
  }
  function shapeFor(id) { return markFor(id, 0).shape; }
  function tone(i) { return GOLD_SERIES[i % GOLD_SERIES.length]; }
  function drawMark(ctx, shape, x, y, r, color, fill) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = fill ? 1.6 : 1.5;
    ctx.beginPath();
    if (shape === 'rect') ctx.rect(-r, -r, r * 2, r * 2);
    else if (shape === 'rectRot') {
      ctx.moveTo(0, -r * 1.3); ctx.lineTo(r * 1.3, 0); ctx.lineTo(0, r * 1.3); ctx.lineTo(-r * 1.3, 0); ctx.closePath();
    } else if (shape === 'triangle') {
      ctx.moveTo(0, -r); ctx.lineTo(r, r * 0.9); ctx.lineTo(-r, r * 0.9); ctx.closePath();
    } else if (shape === 'cross') {
      ctx.lineWidth = fill ? 3 : 1.4;
      ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r);
    } else if (shape === 'star') {
      let rot = -Math.PI / 2;
      const step = Math.PI / 5;
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.42;
        const px = Math.cos(rot) * rad;
        const py = Math.sin(rot) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        rot += step;
      }
      ctx.closePath();
    } else ctx.arc(0, 0, r, 0, Math.PI * 2);
    if (shape === 'cross' || !fill) ctx.stroke();
    else ctx.fill();
    ctx.restore();
  }
  function markSvg(id, index) {
    const mark = markFor(id, index);
    const ink = '#1a140c';
    const fill = mark.fill ? ink : 'none';
    let body = '';
    if (mark.shape === 'rect') body = `<rect x="3" y="3" width="10" height="10" fill="${fill}" stroke="${ink}" stroke-width="1.6"/>`;
    else if (mark.shape === 'rectRot') body = `<path d="M8 1.6 L14.4 8 L8 14.4 L1.6 8 Z" fill="${fill}" stroke="${ink}" stroke-width="1.6"/>`;
    else if (mark.shape === 'triangle') body = `<path d="M8 2.2 L14 13.6 L2 13.6 Z" fill="${fill}" stroke="${ink}" stroke-width="1.6"/>`;
    else if (mark.shape === 'star') body = `<path d="M8 1.4 L9.8 6.1 L14.8 6.2 L10.8 9.2 L12.2 14.1 L8 11.4 L3.8 14.1 L5.2 9.2 L1.2 6.2 L6.2 6.1 Z" fill="${fill}" stroke="${ink}" stroke-width="1.2"/>`;
    else if (mark.shape === 'cross') body = `<path d="M3 8 H13 M8 3 V13" fill="none" stroke="${ink}" stroke-width="${mark.fill ? 3 : 1.4}" stroke-linecap="round"/>`;
    else body = `<circle cx="8" cy="8" r="5" fill="${fill}" stroke="${ink}" stroke-width="1.6"/>`;
    return `<svg class="mk" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${body}</svg>`;
  }
  function sliceLegend(items) {
    return `<ul class="slice-legend">${items.map((item, i) => `<li>${markSvg(item.id, i)}<span>${esc(item.name)} ${esc(item.pct)}%</span></li>`).join('')}</ul>`;
  }
  function drawSpreadLabels(chart, ctx) {
    const labels = chart.$sliceLabels || [];
    if (!labels.length) return;
    ctx.save();
    ctx.font = '12px ' + FONT;
    ctx.fillStyle = '#F4EFE6';
    ctx.strokeStyle = '#E6D8C3';
    ctx.lineWidth = 1;
    const placed = [];
    const left = [];
    const right = [];
    for (const src of labels) {
      const item = { ...src, w: ctx.measureText(src.text).width };
      (Math.cos(src.mid) >= 0 || item.w > 140 ? right : left).push(item);
    }
    const stack = (arr, side) => {
      arr.sort((a, b) => Math.sin(a.mid) - Math.sin(b.mid));
      const room = Math.max(16, chart.height - 32);
      const gap = Math.max(18, Math.min(26, room / Math.max(arr.length, 1)));
      let y = 16 + gap / 2;
      for (const item of arr) {
        item.y = Math.max(16, Math.min(chart.height - 16, y));
        y += gap;
        item.side = side;
        const inset = item.w + 8;
        item.x = side > 0 ? Math.max(inset, chart.width - 8 - item.w) : Math.min(chart.width - inset, inset);
        placed.push(item);
      }
    };
    stack(left, -1);
    stack(right, 1);
    for (const lab of placed) {
      const rimX = lab.cx + Math.cos(lab.mid) * lab.outer;
      const rimY = lab.cy + Math.sin(lab.mid) * lab.outer;
      const bendX = lab.cx + Math.cos(lab.mid) * (lab.outer + 14);
      const bendY = lab.cy + Math.sin(lab.mid) * (lab.outer + 14);
      ctx.beginPath();
      ctx.moveTo(rimX, rimY);
      ctx.lineTo(bendX, bendY);
      ctx.lineTo(lab.x, lab.y);
      ctx.stroke();
      ctx.textAlign = lab.side > 0 ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      const textX = lab.side > 0
        ? Math.min(chart.width - lab.w - 4, lab.x + 4)
        : Math.max(lab.w + 4, lab.x - 4);
      ctx.fillText(lab.text, textX, lab.y);
    }
    ctx.restore();
  }
  function drawSliceMark(ctx, mark, x, y) {
    ctx.save();
    ctx.fillStyle = '#F4EFE6';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawMark(ctx, mark.shape, x, y, 4.5, '#1a140c', mark.fill);
  }
  function drawPhoneMarks(chart, ctx) {
    const marks = chart.$phoneMarks || [];
    for (let pass = 0; pass < 10; pass++) {
      for (let i = 0; i < marks.length; i++) {
        for (let j = i + 1; j < marks.length; j++) {
          const a = marks[i];
          const b = marks[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist >= 18) continue;
          const push = (18 - dist) / 2;
          a.x -= (dx / dist) * push;
          a.y -= (dy / dist) * push;
          b.x += (dx / dist) * push;
          b.y += (dy / dist) * push;
        }
      }
    }
    for (const mark of marks) {
      mark.x = Math.max(10, Math.min(chart.width - 10, mark.x));
      mark.y = Math.max(10, Math.min(chart.height - 10, mark.y));
      drawSliceMark(ctx, mark.mark, mark.x, mark.y);
    }
  }
  const PHASE = { done: '已完成', upcoming: '即将到来', today: '今天', overdue: '已到期，结果尚未回写' };
  const COLS = [['todo', '待开始'], ['doing', '进行中'], ['done', '已完成']];
  const charts = {};
  const state = { dept: 'all', showAll: false };
  const phoneQuery = '(max-width: 800px)';
  function isPhone() { return matchMedia(phoneQuery).matches; }

  if (window.Chart) {
    Chart.defaults.font.family = FONT;
    Chart.defaults.color = 'rgba(248,251,255,.86)';
    Chart.defaults.animation.duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 800;
    if (!Chart.registry.plugins.get('brandShapes')) {
      Chart.register({
        id: 'brandShapes',
        afterDatasetsDraw(chart) {
          const type = chart.config.type;
          const ctx = chart.ctx;
          chart.$sliceLabels = [];
          chart.$phoneMarks = [];
          if (type === 'line') {
            ctx.save();
            ctx.font = '12px ' + FONT;
            ctx.textBaseline = 'middle';
            chart.data.datasets.forEach((ds, di) => {
              const meta = chart.getDatasetMeta(di);
              if (!meta || meta.hidden) return;
              const last = [...meta.data].reverse().find((pt) => pt && !pt.skip);
              if (!last) return;
              const p = last.getProps(['x', 'y'], true);
              ctx.fillStyle = ds.borderColor || '#D0B993';
              ctx.fillText(ds.label || '', p.x + 8, p.y);
            });
            ctx.restore();
            return;
          }
          chart.data.datasets.forEach((ds, di) => {
            const meta = chart.getDatasetMeta(di);
            if (!meta || meta.hidden) return;
            meta.data.forEach((el, i) => {
              const id = ds.shapeIds?.[i] || chart.data.shapeIds?.[i] || chart.data.labels?.[i] || ds.label;
              if (type === 'doughnut' || type === 'pie') {
                const mid = ((el.startAngle || 0) + (el.endAngle || 0)) / 2;
                const rad = ((el.outerRadius || 0) + (el.innerRadius || 0)) / 2;
                const mx = el.x + Math.cos(mid) * rad;
                const my = el.y + Math.sin(mid) * rad;
                const mark = markFor(id, i);
                const outerR = el.outerRadius || rad;
                const span = Math.abs((el.endAngle || 0) - (el.startAngle || 0));
                const outside = isPhone() && span * outerR < 22;
                const markDist = outside ? outerR + 15 : rad;
                const markX = el.x + Math.cos(mid) * markDist;
                const markY = el.y + Math.sin(mid) * markDist;
                if (isPhone()) {
                  if (!chart.$phoneMarks) chart.$phoneMarks = [];
                  chart.$phoneMarks.push({ mark, x: markX, y: markY, cx: el.x, cy: el.y });
                } else {
                  drawSliceMark(ctx, mark, mx, my);
                }
                if (!chart.$sliceLabels) chart.$sliceLabels = [];
                if (!isPhone()) {
                  const values = (ds.data || []).map((n) => Number(n) || 0);
                  const total = values.reduce((sum, n) => sum + n, 0);
                  const raw = values[i] || 0;
                  const pct = total ? Math.round((raw / total) * 1000) / 10 : 0;
                  const pctText = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
                  const name = String(chart.data.labels?.[i] || '');
                  chart.$sliceLabels.push({
                    text: `${name} ${pctText}%`,
                    mid, cx: el.x, cy: el.y, outer: el.outerRadius || rad,
                  });
                }
              } else {
                const p = el.getProps(['x', 'y'], true);
                const mark = markFor(id, i);
                drawMark(ctx, mark.shape, p.x, p.y, 5, '#1a140c', mark.fill);
              }
            });
          });
          if (chart.$sliceLabels && chart.$sliceLabels.length > 2) drawSpreadLabels(chart, ctx);
          if (chart.$phoneMarks && chart.$phoneMarks.length) drawPhoneMarks(chart, ctx);
        },
      });
    }
  }

  function readClock() {
    const q = new URLSearchParams(location.search).get('now');
    if (q) {
      const date = new Date(q);
      if (!Number.isNaN(date.getTime())) return { date, preview: true, nowMs: date.getTime() };
    }
    const date = new Date();
    return { date, preview: false, nowMs: date.getTime() };
  }
  async function loadJson(url) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } catch (err) {
      return { __error: true, url, message: String(err && err.message || err) };
    }
  }
  function monthDay(iso) {
    const [y, m, d] = String(iso || '').split('-').map(Number);
    if (!y || !m || !d) return '';
    return `${m}月${d}日`;
  }
  function whenText(iso) {
    const ms = Date.parse(iso || '');
    return Number.isFinite(ms) ? M.fmtKL(ms) : '';
  }
  function teamById(id) {
    return (state.data?.teams || []).find((t) => t.id === id) || null;
  }
  function publicTeamName(team) {
    if (!team) return '未知部门';
    return team.private ? '私密' : team.name;
  }
  function publicTitle(task, team) {
    if (team?.private) return '私密';
    return task?.title || '';
  }
  function emptyBlock(title, detail) {
    return `<div class="empty"><p class="empty-k">${esc(title)}</p>${detail ? `<p>${esc(detail)}</p>` : ''}</div>`;
  }
  function infoTip(text) {
    return `<span class="tip"><button type="button" class="info" aria-label="说明" aria-expanded="false">ⓘ</button><span class="tipbox" hidden>${esc(text)}</span></span>`;
  }
  function fillPct(total, rules) {
    const s = Number(total) || 0;
    if (s <= 0) return 0;
    const k = Number(rules?.asymptote) || 8;
    return Math.max(0, Math.min(100, Math.round((100 * s) / (s + k))));
  }
  function axis() {
    return {
      grid: { color: 'rgba(255,255,255,.14)' },
      ticks: { color: 'rgba(248,251,255,.82)', font: { family: FONT, size: 11 } },
      border: { display: false },
    };
  }
  function upsert(id, build) {
    const canvas = document.getElementById(id);
    if (!canvas || !window.Chart) return null;
    if (!charts[id]) charts[id] = new Chart(canvas, build());
    return charts[id];
  }
  function setSeries(id, labels, data) {
    const chart = charts[id];
    if (!chart) return;
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  }

  function paintChrome() {
    const { date, preview } = readClock();
    const hour = preview ? M.hourOf(date, M.TZ) : M.hourOf(date);
    $('#hello').textContent = `${M.greetingWord(hour)}，Edward`;
    const kl = M.fmtKL(date.getTime());
    $('#clock').textContent = preview
      ? `预览时钟 ${kl}（UTC+8）· 状态与工时按这个时间`
      : `状态与工时按吉隆坡时间 ${M.fmtKL(Date.now())}（UTC+8）`;
    const iso = state.data?.updatedAt;
    const ms = Date.parse(iso || '');
    $('#updated').textContent = Number.isFinite(ms) ? `数据更新 ${M.fmtKL(ms)}（UTC+8）` : '数据更新 暂无';
    const meta = $('#metaLine');
    if (meta) {
      const short = (s) => String(s).slice(5);
      const upd = Number.isFinite(ms) ? short(M.fmtKL(ms)) : '暂无';
      meta.textContent = `${preview ? '预览' : '吉隆坡'} ${short(kl)} · 数据更新 ${upd}`;
    }
    return { date, preview, nowMs: date.getTime() };
  }

  function renderOverview() {
    const clock = paintChrome();
    const rules = state.data.workRules || {};
    const counts = M.taskCounts(state.data.tasks);
    const live = M.companyTotalLive(state.data.teams, rules, clock.nowMs);
    const usage = latestUsage();
    const token = usage ? `${usage.weekUsedPct}%` : '暂无数据';
    const meter = usage ? Math.max(0, Math.min(100, Number(usage.weekUsedPct) || 0)) : 0;
    $('#overviewBody').innerHTML = `
      <div class="stats">
        <article class="glass stat">
          <p class="k"><span class="k-long">公司总分</span><span class="k-short">总分</span></p>
          <p class="v" id="statScore">${esc(M.fmtScore(live.total))}</p>
          <div class="spark"><canvas id="sparkScore"></canvas></div>
          <p class="sub">计分 ${live.people} 人 · 不含 ED / 私密</p>
        </article>
        <article class="glass stat">
          <p class="k"><span class="k-long">在册人数</span><span class="k-short">在册</span></p>
          <p class="v" id="statStaff">${M.staffCount(state.data.teams)}</p>
          <p class="sub">当前在册</p>
        </article>
        <article class="glass stat">
          <p class="k">任务</p>
          <p class="v"><span id="statDone">${counts.done}</span><span class="slash">/</span><span id="statDoing">${counts.doing}</span></p>
          <div class="spark"><canvas id="sparkDone"></canvas></div>
          <p class="sub">已完成 / 进行中</p>
        </article>
        <article class="glass stat">
          <p class="k"><span class="k-long">等 Edward</span><span class="k-short">待确认</span></p>
          <p class="v" id="statWait">${counts.confirm}</p>
          <p class="sub">等你确认</p>
        </article>
        <article class="glass stat">
          <p class="k"><span class="k-long">本周 Token 额度</span><span class="k-short">本周额度</span></p>
          <p class="v" id="statToken">${esc(token)}</p>
          <div class="meter" role="img" aria-label="本周已用 ${esc(token)}"><i id="tokenMeter" style="width:${meter}%"></i></div>
          <p class="sub">${usage ? '与其他应用共用' : '用量还没有写入'}</p>
        </article>
      </div>
      ${infoTip('人数、任务和分数来自办公室记录。本周额度与套餐里其他应用共用。没有逐日记录的卡片不画趋势。')}`;
    paintCharts(clock);
  }

  function doneSeries() {
    return (state.data.tasks || [])
      .filter((task) => task.status === 'done' && task.updatedAt)
      .slice()
      .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
  }

  function paintCharts(clock) {
    const rules = state.data.workRules || {};
    const events = state.events || [];
    const mismatches = state.mismatches || [];
    const trend = mismatches.length ? [] : M.trendPoints(state.data.teams, rules, events, clock.nowMs);
    const labels = trend.map((p) => M.fmtKL(p.t));
    const values = trend.map((p) => p.total);
    if (document.getElementById('sparkScore') && values.length) {
      upsert('sparkScore', () => sparkConfig(labels, values));
      setSeries('sparkScore', labels, values);
    }
    const done = doneSeries();
    if (document.getElementById('sparkDone') && done.length) {
      const dLabels = done.map((task) => M.fmtKL(Date.parse(task.updatedAt)));
      const dValues = done.map((_, i) => i + 1);
      upsert('sparkDone', () => sparkConfig(dLabels, dValues, '#D0B993', '完成'));
      setSeries('sparkDone', dLabels, dValues);
    }
    const ranks = M.departmentRanks(state.data.teams, rules, clock.nowMs);
    if (document.getElementById('rankChart')) paintRank(ranks);
    if (document.getElementById('trendChart')) {
      const card = $('#trendCard');
      const box = $('#trendChart').parentElement;
      const caption = $('#trendCaption');
      if (mismatches.length) {
        if (card) card.classList.add('nocurve');
        box.hidden = true;
        if (caption) caption.hidden = false;
      } else if (values.length) {
        if (card) card.classList.remove('nocurve');
        box.hidden = false;
        if (caption) caption.hidden = false;
        upsert('trendChart', () => ({
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: '公司总分',
              data: values,
              tension: 0,
              borderColor: '#D0B993',
              backgroundColor: 'rgba(208,185,147,.22)',
              fill: true,
              pointRadius: 2,
              pointBackgroundColor: '#fff',
              borderWidth: 2,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 72 } },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => M.fmtScore(c.raw) } } },
            scales: {
              x: { ...axis(), ticks: { ...axis().ticks, maxTicksLimit: 6, callback(v) { return String(this.getLabelForValue(v)).slice(5); } } },
              y: axis(),
            },
          },
        }));
        setSeries('trendChart', labels, values);
      }
    }
    paintPeopleNumbers(clock);
  }

  function paintRank(ranks) {
    const narrow = isPhone();
    const labels = ranks.map((r) => (narrow ? r.name : `${r.name} · ${r.n}人`));
    const data = ranks.map((r) => r.total);
    const maxVal = data.reduce((m, n) => Math.max(m, Number(n) || 0), 0);
    const colors = ranks.map((_, i) => tone(i));
    const x = { ...axis(), beginAtZero: true, ticks: { ...axis().ticks, maxTicksLimit: narrow ? 4 : 8 } };
    if (narrow) {
      x.grace = '18%';
      x.suggestedMax = Math.ceil((maxVal || 1) * 1.2);
    }
    const scales = {
      x,
      y: { ...axis(), grid: { display: false }, ticks: { ...axis().ticks, font: { family: FONT, size: narrow ? 14 : 11 }, autoSkip: false } },
    };
    const layout = { padding: { right: narrow ? 12 : 0, left: 0, top: 4, bottom: 0 } };
    const barStyle = { borderRadius: narrow ? 4 : 8, borderSkipped: narrow ? 'start' : false, maxBarThickness: narrow ? 14 : 18 };
    if (!charts.rankChart) {
      charts.rankChart = new Chart(document.getElementById('rankChart'), {
        type: 'bar',
        data: { labels, shapeIds: ranks.map((r) => r.id || r.name), datasets: [{ data, backgroundColor: colors, ...barStyle }] },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          layout,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => M.fmtScore(c.raw) } } },
          scales,
        },
      });
    } else {
      charts.rankChart.data.labels = labels;
      charts.rankChart.data.datasets[0].data = data;
      Object.assign(charts.rankChart.data.datasets[0], barStyle);
      charts.rankChart.options.scales = scales;
      charts.rankChart.options.layout = layout;
      charts.rankChart.update();
    }
    requestAnimationFrame(() => charts.rankChart && charts.rankChart.resize());
  }

  function sparkConfig(labels, data, color, name) {
    const line = color || '#D0B993';
    return {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: name || '总分',
          data,
          tension: 0.25,
          borderColor: line,
          backgroundColor: 'rgba(208,185,147,.18)',
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 4,
          pointBackgroundColor: line,
          pointBorderColor: '#1a140c',
          pointBorderWidth: 1,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: Chart.defaults.animation.duration },
        layout: { padding: { right: 36 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
      },
    };
  }

  function renderProgress() {
    const doc = state.progress;
    if (!doc || doc.__error || !Array.isArray(doc.milestones) || !doc.milestones.length) {
      $('#progressBody').innerHTML = `<div class="glass pad">${emptyBlock('暂无数据', '公司里程碑还没有写入。')}</div>`;
      return;
    }
    const { date } = readClock();
    const items = doc.milestones.map((item) => {
      const phase = M.milestonePhase(item, date);
      return `<li class="${esc(phase)}"><i></i><div><p class="when">${esc(monthDay(item.date))} · ${esc(PHASE[phase] || phase)}</p><p class="what">${esc(item.title)}</p></div></li>`;
    }).join('');
    $('#progressBody').innerHTML = `<div class="glass pad"><ol class="tl">${items}</ol>${infoTip('日期为马来西亚时间。计划过了日期还没回写，会标成已到期。')}</div>`;
  }

  function renderPeople() {
    const rules = state.data.workRules || {};
    const started = whenText(rules.trackingStartedAt);
    const teams = state.data.teams || [];
    const chips = [`<button type="button" data-dept="all" class="on">全部</button>`].concat(teams.map((team) => {
      const label = team.private ? '私密' : (team.short || team.name);
      return `<button type="button" data-dept="${esc(team.id)}">${esc(label)}</button>`;
    })).join('');
    const rows = [];
    for (const team of teams) {
      if (team.private) continue;
      for (const staff of team.staff || []) rows.push({ team, staff });
    }
    rows.sort((a, b) => {
      const ap = !!a.team.private;
      const bp = !!b.team.private;
      if (ap !== bp) return ap ? 1 : -1;
      const ao = M.workBarOff(a.staff, a.team, rules);
      const bo = M.workBarOff(b.staff, b.team, rules);
      if (ao !== bo) return ao ? 1 : -1;
      const as = ao ? -Infinity : M.scoreParts(a.staff, rules, readClock().nowMs).total;
      const bs = bo ? -Infinity : M.scoreParts(b.staff, rules, readClock().nowMs).total;
      return bs - as || String(a.staff.name || '').localeCompare(String(b.staff.name || ''), 'zh');
    });
    const head = `<div class="person head" aria-hidden="true"><span>姓名</span><span>部门</span><span>职责</span><span>状态</span><span>任务分</span><span>工时分</span><span>加班</span><span>合计</span></div>`;
    const body = rows.map(({ team, staff }) => personRow(team, staff, rules)).join('');
    const clockNote = '状态用办公室同一套时钟：周一至周五 09:00–18:00（吉隆坡）为忙碌；例会时段为开会中；其余时间为下班。喝咖啡、休息、汇报中、交接任务只在 3D 办公室的实时走动里出现，此页不编造。合计 = 任务分 − 额外扣分 + 工时分。ED 不计工时，私密不计入。';
    const mismatch = (state.mismatches || []).length
      ? '已记下的分值和当前分数对不齐，这里先不画曲线。'
      : `曲线按已记下的分值，加上自 ${started || '开始计分'} 起的工时。周末不计工时。`;
    $('#peopleBody').innerHTML = `
      <p class="note desk-note">${esc(clockNote)}</p>
      <details class="explain"><summary>说明</summary><p>${esc(clockNote)}</p></details>
      <div class="charts-2">
        <div class="glass pad"><h3 class="block" style="margin-top:0">部门总分</h3><div class="chartbox"><canvas id="rankChart"></canvas></div></div>
        <div class="glass pad trend-card" id="trendCard"><h3 class="block" style="margin-top:0">分数趋势</h3><div class="chartbox" id="trendBox"><canvas id="trendChart"></canvas></div><p class="src" id="trendCaption">${esc(mismatch)}</p></div>
      </div>
      <div class="glass pad">
        <div class="filters">
          <input id="q" type="search" placeholder="搜索姓名或职责" aria-label="搜索姓名或职责">
          <div class="chip-fade"><div class="chips" id="chips">${chips}</div></div>
        </div>
        <p class="sub" id="peopleCount"></p>
        <div class="people" id="peopleList">${head}${body}</div>
        <button type="button" id="showAll" hidden>显示全部</button>
        <p class="miss" id="peopleMiss" hidden>没有匹配的人员</p>
        ${infoTip('分数按办公室记分。工时按工作日时钟累加。ED 不计工时，私密不计入。')}
      </div>`;
    $('#q').addEventListener('input', () => { state.showAll = false; applyPeopleFilter(); });
    $('#showAll').addEventListener('click', () => { state.showAll = !state.showAll; applyPeopleFilter(); });
    $('#chips').addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      state.showAll = false;
      state.dept = button.dataset.dept || 'all';
      $('#chips').querySelectorAll('button').forEach((el) => el.classList.toggle('on', el === button));
      applyPeopleFilter();
    });
    applyPeopleFilter();
    paintCharts(readClock());
  }

  function personRow(team, staff, rules) {
    const priv = !!team.private;
    const name = priv ? '私密' : (staff.name || '');
    const dept = publicTeamName(team);
    const chip = priv ? '私密' : (team.short || team.name);
    const role = priv ? '' : (staff.role || '');
    const q = `${name} ${dept} ${chip} ${role}`.toLowerCase();
    if (priv) {
      return `<article class="person slim" data-dept="${esc(team.id)}" data-q="${esc(q)}"><div class="who"><b>私密</b></div><div class="mrow mstatic"><span class="mwho"><b>私密</b></span></div></article>`;
    }
    const off = M.workBarOff(staff, team, rules);
    const parts = off ? null : M.scoreParts(staff, rules, readClock().nowMs);
    const key = M.activityKey(readClock().date, state.data.meetings);
    const badge = `<span class="badge st-${esc(key)}" data-badge="${esc(staff.id)}">${esc(M.ACT[key] || key)}</span>`;
    const scores = off
      ? `<div class="na" data-label="分数">不计工时</div>`
      : `<div class="num" data-label="任务分" data-k="task" data-staff="${esc(staff.id)}">${M.fmtScore(parts.task)}</div>
         <div class="num" data-label="工时分" data-k="hour" data-staff="${esc(staff.id)}">${M.fmtScore(parts.hourPts)}</div>
         <div class="num" data-label="加班" data-k="ot" data-staff="${esc(staff.id)}">${M.fmtScore(parts.overtime)}</div>
         <div class="num sum" data-label="合计" data-k="total" data-staff="${esc(staff.id)}">${M.fmtScore(parts.total)}</div>`;
    const totalText = off ? '不计工时' : M.fmtScore(parts.total);
    const bar = off ? '' : `<span class="mtrack" aria-hidden="true"><i class="mfill" data-staff="${esc(staff.id)}" style="width:${fillPct(parts.total, rules)}%"></i></span>`;
    const detailScores = off
      ? `<p><span>分数</span><b>不计工时</b></p>`
      : `<p><span>任务分</span><b data-k="task" data-staff="${esc(staff.id)}">${M.fmtScore(parts.task)}</b></p>
         <p><span>工时分</span><b data-k="hour" data-staff="${esc(staff.id)}">${M.fmtScore(parts.hourPts)}</b></p>
         <p><span>加班</span><b data-k="ot" data-staff="${esc(staff.id)}">${M.fmtScore(parts.overtime)}</b></p>`;
    return `<article class="person" data-dept="${esc(team.id)}" data-q="${esc(q)}">
      <div class="who" data-label="姓名"><b>${esc(name)}</b></div>
      <div data-label="部门">${esc(dept)}</div>
      <div class="role" data-label="职责">${esc(role)}</div>
      <div data-label="状态">${badge}</div>
      ${scores}
      <button type="button" class="mrow" aria-expanded="false">
        <span class="mwho"><b>${esc(name)}</b><span class="dchip">${esc(chip)}</span></span>
        ${badge}
        <span class="mscore">${bar}<b class="${off ? '' : 'num'}" ${off ? '' : `data-k="total" data-staff="${esc(staff.id)}"`}>${esc(totalText)}</b></span>
      </button>
      <div class="mdetail" hidden>
        <p><span>职责</span><b>${esc(role || '—')}</b></p>
        ${detailScores}
      </div>
    </article>`;
  }

  function paintPeopleNumbers(clock) {
    const rules = state.data.workRules || {};
    const index = new Map();
    for (const team of state.data?.teams || []) {
      for (const staff of team.staff || []) index.set(staff.id, { team, staff });
    }
    document.querySelectorAll('[data-staff][data-k]').forEach((el) => {
      const hit = index.get(el.dataset.staff);
      if (!hit || M.workBarOff(hit.staff, hit.team, rules)) return;
      const parts = M.scoreParts(hit.staff, rules, clock.nowMs);
      const map = { task: parts.task, hour: parts.hourPts, ot: parts.overtime, total: parts.total };
      el.textContent = M.fmtScore(map[el.dataset.k]);
    });
    const key = M.activityKey(clock.date, state.data.meetings);
    document.querySelectorAll('[data-badge]').forEach((el) => {
      el.className = `badge st-${key}`;
      el.textContent = M.ACT[key] || key;
    });
    document.querySelectorAll('.mfill[data-staff]').forEach((el) => {
      const hit = index.get(el.dataset.staff);
      if (!hit || M.workBarOff(hit.staff, hit.team, rules)) return;
      el.style.width = `${fillPct(M.scoreParts(hit.staff, rules, clock.nowMs).total, rules)}%`;
    });
    const live = M.companyTotalLive(state.data.teams, rules, clock.nowMs);
    const score = $('#statScore');
    if (score) score.textContent = M.fmtScore(live.total);
  }

  function applyPeopleFilter() {
    const q = ($('#q')?.value || '').trim().toLowerCase();
    const phone = isPhone();
    const matches = [];
    document.querySelectorAll('#peopleList .person[data-dept]').forEach((el) => {
      const ok = (state.dept === 'all' || el.dataset.dept === state.dept) && (!q || (el.dataset.q || '').includes(q));
      el.classList.toggle('nomatch', !ok);
      if (ok) matches.push(el);
      else el.hidden = true;
    });
    const cap = phone && !state.showAll;
    matches.forEach((el, i) => { el.hidden = cap && i >= 10; });
    const shown = matches.filter((el) => !el.hidden).length;
    const miss = $('#peopleMiss');
    if (miss) miss.hidden = matches.length !== 0;
    const count = $('#peopleCount');
    if (count) count.textContent = cap && matches.length > 10 ? `前 10 人，共 ${matches.length} 人` : `显示 ${shown} 人`;
    const more = $('#showAll');
    if (more) {
      const extra = phone && matches.length > 10;
      more.hidden = !extra;
      more.textContent = state.showAll ? '只看前 10 人' : `显示全部 ${matches.length} 人`;
    }
  }

  function renderDev() {
    const tasks = state.progress?.devTasks;
    if (!state.progress || state.progress.__error || !Array.isArray(tasks)) {
      $('#devBody').innerHTML = `<div class="glass pad">${emptyBlock('暂无数据', '开发任务还没有写入。')}</div>`;
      return;
    }
    const known = new Set(COLS.map(([id]) => id));
    const extra = tasks.filter((task) => !known.has(task.status));
    const column = (id, label, list) => {
      const cards = list.map((task) => {
        const bits = [];
        if (task.owner) bits.push(`负责 ${esc(task.owner)}`);
        if (task.due) bits.push(`到期 ${esc(monthDay(task.due))}`);
        if (task.doneOn) bits.push(`完成 ${esc(monthDay(task.doneOn))}`);
        if (task.pr) bits.push(`<a href="https://github.com/edvisionedward-boop/Evergate-Office/pull/${Number(task.pr)}">PR #${esc(task.pr)}</a>`);
        if (task.note) bits.push(esc(task.note));
        return `<article class="kcard"><h4>${esc(task.title)}</h4><p class="kmeta">${bits.join(' · ') || '未写负责人或日期'}</p></article>`;
      }).join('') || `<p class="kmeta">暂无</p>`;
      return `<section class="glass col"><h3>${esc(label)} <span>${list.length}</span></h3><div class="kstack">${cards}</div></section>`;
    };
    const html = COLS.map(([id, label]) => column(id, label, tasks.filter((task) => task.status === id))).join('')
      + (extra.length ? column('other', '其他', extra) : '');
    $('#devBody').innerHTML = `<div class="kanban">${html}</div>${infoTip('开发任务按待开始、进行中、已完成排列。')}`;
  }

  function renderTasks() {
    const tasks = state.data.tasks || [];
    const counts = M.taskCounts(tasks);
    const teams = state.data.teams || [];
    const done = tasks.filter((task) => task.status === 'done').slice().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    const waiting = tasks.filter((task) => task.status === 'confirm').slice().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    const taskItem = (task) => {
      const team = teamById(task.team);
      const kind = task.kind === 'special' ? '特殊' : task.kind === 'routine' ? '日常' : (task.kind || '未标类型');
      return `<article class="item"><p>${esc(publicTitle(task, team))}</p><p class="meta">${esc(publicTeamName(team))} · ${esc(kind)} · ${esc(whenText(task.updatedAt))} · 星级 未记录 · 分值 未记录</p></article>`;
    };
    const reports = (state.events || []).slice().sort((a, b) => Date.parse(b.time) - Date.parse(a.time)).map((event) => {
      const star = event.stars ? `${event.stars}☆` : event.daily ? '日常' : '未标星';
      const points = event.mode === 'set' ? `基数 ${M.fmtScore(event.points)}` : `+${M.fmtScore(event.points)}`;
      return `<article class="item"><p>${esc(event.text)}</p><p class="meta">${esc(event.dept)} · ${esc(event.name)} · ${esc(star)} · ${esc(points)} · ${esc(whenText(event.time))}</p></article>`;
    }).join('') || emptyBlock('暂无数据', '动态里还没有写明星级或分值的完成报告。');
    $('#tasksBody').innerHTML = `
      <div class="glass pad">
        <div class="counts">
          <div class="count"><b>${counts.doing}</b><span>进行中</span></div>
          <div class="count"><b>${counts.confirm}</b><span>等你确认</span></div>
          <div class="count"><b>${counts.done}</b><span>已完成</span></div>
        </div>
        <div class="taskbar"><canvas id="taskChart"></canvas></div>
        <div class="split">
          <div><h3 class="block">最近完成</h3><div class="list">${done.map(taskItem).join('') || emptyBlock('暂无数据', '任务板上还没有已完成项。')}</div></div>
          <div><h3 class="block">等 Edward 确认</h3><div class="list">${waiting.map(taskItem).join('') || emptyBlock('暂无数据', '现在没有等 Edward 确认的事项。')}</div></div>
        </div>
        <h3 class="block">完成报告</h3>
        <p class="note">星级和分值只列在已经写明的完成报告里，其余标成未记录。</p>
        <div class="list">${reports}</div>
        ${infoTip('上面是任务板的状态和标题。完成报告只保留写明了星级或分值的记录。')}
      </div>`;
    if (window.Chart && document.getElementById('taskChart')) {
      charts.taskChart = new Chart(document.getElementById('taskChart'), {
        type: 'bar',
        data: {
          labels: ['进行中', '等你确认', '已完成'],
          datasets: [{ data: [counts.doing, counts.confirm, counts.done], backgroundColor: ['#A98B5E', '#D0B993', '#E6D8C3'], borderRadius: 10, maxBarThickness: 48 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { ...axis(), grid: { display: false } }, y: { ...axis(), ticks: { ...axis().ticks, precision: 0 } } },
        },
      });
    }
  }

  function latestUsage() {
    const doc = state.usage;
    if (!Array.isArray(doc) || !doc.length) return null;
    return doc.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  }

  function renderUsage() {
    const report = latestUsage();
    if (!report) {
      $('#usageBody').innerHTML = `<div class="glass pad">${emptyBlock('暂无数据', '用量日报还没有写入。本页不记录金额。')}</div>`;
      return;
    }
    const depts = Array.isArray(report.departments) ? report.departments : [];
    const sum = Math.round(depts.reduce((n, row) => n + (Number(row.pct) || 0), 0) * 10) / 10;
    const rows = depts.map((row, i) => `<tr><td>${markSvg(row.name, i)}${esc(row.name)}</td><td>${esc(row.pct)}%</td><td>${esc(row.note || '')}</td></tr>`).join('');
    const sumNote = sum === 100 ? '' : `<p class="note">部门份额合计 ${sum}%，与 100% 不一致。页面没有改这些数字。</p>`;
    const used = Number(report.weekUsedPct);
    const rest = Number.isFinite(used) ? Number((100 - used).toFixed(1)) : null;
    $('#usageBody').innerHTML = `
      <div class="glass pad">
        <div class="facts">
          <span>计划 ${esc(report.plan || '未写')}</span>
          <span>Grok Bot 占用量 ${esc(report.grokBotSharePct)}%</span>
          <span>重置 ${esc(whenText(report.resetAt))}（UTC+8）</span>
        </div>
        <div class="usage-grid">
          <div>
            <div class="gauge-wrap">
              <canvas id="gauge"></canvas>
              <div class="gauge-label"><b>${esc(report.weekUsedPct)}%</b><span>本周已用</span></div>
            </div>
            ${sliceLegend([{ id: '已用', name: '已用', pct: used }, { id: '按百分比剩下的部分', name: '按百分比剩下的部分', pct: rest }]).replace('slice-legend', 'slice-legend always')}
          </div>
          <div>
            <p class="note">${esc(report.weekUsedNote || '')}</p>
            <div class="chartbox" style="height:280px"><canvas id="donut"></canvas></div>
            ${sliceLegend(depts.map((row) => ({ id: row.name, name: row.name, pct: row.pct })))}
          </div>
        </div>
        <table class="share">${rows}</table>
        ${sumNote}
        <div class="callout"><p style="margin:0">${esc(report.caveat || '')}</p><p class="src" style="margin-bottom:0">${esc(report.source || '')} ${esc(report.asOfNote || '')}</p></div>
        ${infoTip('本页不写金额，也不按已用比例推算哪天用完。')}
      </div>`;
    if (!window.Chart) return;
    charts.gauge = new Chart(document.getElementById('gauge'), {
      type: 'doughnut',
      data: {
        labels: ['已用', '按百分比剩下的部分'],
        datasets: [{ data: [used, rest], backgroundColor: ['#D0B993', 'rgba(255,255,255,.16)'], borderWidth: 0 }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '74%', layout: { padding: isPhone() ? 8 : 18 }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.label} ${c.raw}%` } } } },
    });
    charts.donut = new Chart(document.getElementById('donut'), {
      type: 'doughnut',
      data: {
        labels: depts.map((row) => row.name),
        shapeIds: depts.map((row) => row.name),
        datasets: [{ data: depts.map((row) => row.pct), backgroundColor: depts.map((_, i) => tone(i)), borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        layout: { padding: isPhone() ? 28 : { top: 24, right: 200, bottom: 24, left: 132 } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.label} ${c.raw}%` } } },
      },
    });
  }

  function renderExams(doc) {
    destroyChart('examBar');
    destroyChart('examLine');
    const payload = doc || state.exams;
    const sentence = payload?.empty || '首次全员考核 2026-11-16（周一），当天成绩为基准线，之后定期复测对比成长';
    const records = Array.isArray(payload?.records) ? payload.records : [];
    const byId = new Map();
    for (const team of state.data?.teams || []) {
      for (const staff of team.staff || []) byId.set(staff.id, { team, staff });
    }
    const rows = [];
    for (const record of records) {
      const score = Number(record?.score);
      if (!record?.employee || !record?.date || !Number.isFinite(score)) continue;
      const hit = byId.get(record.employee);
      if (hit?.team?.private) continue;
      rows.push({
        employee: record.employee,
        date: record.date,
        score,
        name: hit?.staff?.name || record.employee,
        dept: hit?.team?.name || '',
      });
    }
    if (!rows.length) {
      $('#examsBody').innerHTML = `<div class="glass pad">${emptyBlock('暂无数据', sentence)}</div>`;
      return;
    }
    const latest = new Map();
    for (const row of rows) {
      const prev = latest.get(row.employee);
      if (!prev || row.date > prev.date) latest.set(row.employee, row);
    }
    const bars = [...latest.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh'));
    const dates = [...new Set(rows.map((row) => row.date))].sort();
    const multi = [...latest.keys()].filter((id) => rows.filter((row) => row.employee === id).length > 1);
    $('#examsBody').innerHTML = `
      <div class="glass pad">
        <div class="charts-2">
          <div><h3 class="block" style="margin-top:0">最近一次成绩</h3><div class="chartbox"><canvas id="examBar"></canvas></div></div>
          <div><h3 class="block" style="margin-top:0">复测对比</h3><div class="chartbox" id="examLineBox"><canvas id="examLine"></canvas></div><p class="chart-miss" id="examLineNote"${multi.length ? ' hidden' : ''}>尚无第二次成绩，成长曲线会在复测后出现。</p></div>
        </div>
        ${infoTip(sentence)}
      </div>`;
    if (!window.Chart) return;
    charts.examBar = new Chart(document.getElementById('examBar'), {
      type: 'bar',
      data: {
        labels: bars.map((row) => row.name),
        datasets: [{ data: bars.map((row) => row.score), backgroundColor: '#D0B993', borderRadius: 8, maxBarThickness: 28 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ...axis(), grid: { display: false } }, y: axis() } },
    });
    if (multi.length) {
      const people = multi.map((id) => bars.find((row) => row.employee === id) || rows.find((row) => row.employee === id));
      charts.examLine = new Chart(document.getElementById('examLine'), {
        type: 'line',
        data: {
          labels: dates,
          datasets: people.map((person, i) => ({
            label: person.name,
            data: dates.map((date) => {
              const hit = rows.find((row) => row.employee === person.employee && row.date === date);
              return hit ? hit.score : null;
            }),
            borderColor: tone(i),
            backgroundColor: tone(i),
            pointStyle: shapeFor(person.employee || person.name),
            pointRadius: 4,
            pointHoverRadius: 6,
            spanGaps: false,
            tension: 0,
          })),
        },
        options: { responsive: true, maintainAspectRatio: false, layout: { padding: { right: 72 } }, scales: { x: axis(), y: axis() } },
      });
    } else {
      const canvas = document.getElementById('examLine');
      if (canvas) canvas.parentElement.hidden = true;
    }
  }

  function destroyChart(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  function skillDeptLabel(team) {
    return team.id === 'ed' ? 'ED' : team.name;
  }
  function skillDepartments() {
    return (state.data?.teams || []).filter((team) => !team.private);
  }
  function skillApplies(skill, label) {
    const depts = skill.depts || [];
    return depts.includes('全公司') || depts.includes(label);
  }
  function renderSkills() {
    const doc = state.skills;
    const body = $('#skillsBody');
    if (!doc || doc.__error || !Array.isArray(doc.skills) || !Array.isArray(doc.packs)) {
      body.innerHTML = `<div class="glass pad">${emptyBlock('暂无数据', '技能清单还没有写入。')}</div>`;
      return;
    }
    const packs = doc.packs;
    const skills = doc.skills;
    const packById = Object.fromEntries(packs.map((pack) => [pack.id, pack]));
    const departments = skillDepartments();
    const labels = departments.map(skillDeptLabel);
    const ms = Date.parse(doc.updated || '');
    const updated = Number.isFinite(ms) ? `清单更新 ${M.fmtKL(ms)}（UTC+8）` : '清单更新 暂无';
    const cards = departments.map((team) => {
      const label = skillDeptLabel(team);
      const owned = skills.filter((skill) => skillApplies(skill, label));
      const chips = owned.map((skill) => `<button type="button" class="skill-chip" data-skill="${esc(skill.id)}" data-dept="${esc(label)}" aria-expanded="false">${esc(skill.name)}</button>`).join('');
      return `<article class="skill-card glass"><div class="skill-head"><h3>${esc(label)}</h3><b>${owned.length} 项</b></div><div class="skill-chips">${chips || '<p class="note">暂无技能</p>'}</div><div class="skill-pop" hidden></div></article>`;
    }).join('');
    const packRows = packs.map((pack) => {
      const count = skills.filter((skill) => skill.pack === pack.id).length;
      const repo = String(pack.repo || '');
      const link = repo.startsWith('https://')
        ? `<a href="${esc(repo)}" target="_blank" rel="noopener noreferrer">${esc(repo.replace(/^https:\/\//, ''))}</a>`
        : '<span>无公开仓库</span>';
      return `<article class="skill-row glass"><div class="skill-head"><b>${esc(pack.name)}</b><span>${count} 项</span></div><p>${esc(pack.license || '')}</p>${link}</article>`;
    }).join('');
    const reviewed = (doc.reviewed_not_installed || []).map((item) => `<article class="skill-row glass"><div class="skill-head"><b>${esc(item.name)}</b><time datetime="${esc(item.date || '')}">${esc(item.date || '')}</time></div><p>${esc(item.reason || '')}</p></article>`).join('');
    const tools = (doc.tools_pending || []).map((item) => `<article class="skill-row glass"><div class="skill-head"><b>${esc(item.name)}</b></div><p>${esc(item.status || '')}</p></article>`).join('');
    const watch = (doc.watchlist || []).map((item) => `<article class="skill-row glass"><div class="skill-head"><b>${esc(item.name)}</b><time datetime="${esc(item.date || '')}">${esc(item.date || '')}</time></div><p>用于 ${esc(item.for || '')}</p><p>${esc(item.why || '')}</p></article>`).join('');
    const reserved = (doc.reserved || []).map((item) => `<article class="skill-row glass"><div class="skill-head"><b>${esc(item.name)}</b><time datetime="${esc(item.date || '')}">${esc(item.date || '')}</time></div><p>用于 ${esc(item.for || '')}</p><p>${esc(item.note || '')}</p></article>`).join('');
    body.innerHTML = `<p class="note skill-updated">${esc(updated)}</p><h3 class="block">各部门技能</h3><div class="skill-grid">${cards}</div><h3 class="block">资源包</h3><div class="skill-list">${packRows}</div><h3 class="block">待评估</h3><div class="skill-list">${watch || emptyBlock('暂无', '')}</div><h3 class="block">预留备用</h3><div class="skill-list">${reserved || emptyBlock('暂无', '')}</div><h3 class="block">看过但未安装</h3><div class="skill-list">${reviewed || emptyBlock('暂无', '')}</div><h3 class="block">待批准工具</h3><div class="skill-list">${tools || emptyBlock('暂无', '')}</div>`;
    body.dataset.labels = labels.join('\u0001');
  }
  function skillDetail(skill, current) {
    const pack = (state.skills.packs || []).find((item) => item.id === skill.pack) || {};
    const labels = ($('#skillsBody').dataset.labels || '').split('\u0001').filter(Boolean);
    const others = labels.filter((label) => label !== current && skillApplies(skill, label));
    const share = others.length ? others.join('、') : '仅本部门';
    const company = (skill.depts || []).includes('全公司') ? '<p>全公司技能，每个部门都可使用。</p>' : '';
    const note = skill.note ? `<p>${esc(skill.note)}</p>` : '';
    const batch = Number.isFinite(Number(skill.batch)) ? `第 ${skill.batch} 批` : '批次未记录';
    return `<p class="skill-pop-name">${esc(skill.name)}</p><p>来源 ${esc(pack.name || '未记录')}</p><p>许可 ${esc(pack.license || '未记录')} · ${esc(batch)}</p>${company}<p>同时用于：${esc(share)}</p>${note}`;
  }
  function renderClients() {
    const doc = state.pipeline;
    if (!doc || doc.__error || !Array.isArray(doc.stages)) {
      $('#clientsBody').innerHTML = `<div class="glass pad">${emptyBlock('暂无数据', '客户明细只保存在内部。这里只记各阶段数量。')}</div>`;
      return;
    }
    const stages = doc.stages;
    const allZero = stages.every((stage) => Number(stage.count) === 0);
    const pipe = stages.map((stage, i) => {
      const count = Number(stage.count);
      const shown = Number.isFinite(count) ? String(count) : '—';
      const arrow = i < stages.length - 1 ? '<li class="arrow" aria-hidden="true">→</li>' : '';
      return `<li class="stage"><b>${esc(shown)}</b><span>${esc(stage.name)}</span></li>${arrow}`;
    }).join('');
    const head = allZero
      ? `<div class="empty"><p class="empty-k">暂无数据</p><p class="principle">${esc(doc.principle || '少而对的客户')}</p><p>${esc(doc.note || '客户明细只保存在内部，此页只记各阶段数量。')}</p></div>`
      : `<p class="principle">${esc(doc.principle || '')}</p><p class="note">${esc(doc.note || '')}</p>`;
    $('#clientsBody').innerHTML = `<div class="glass pad">${head}<ol class="pipe">${pipe}</ol>${infoTip('只显示各阶段数量，不显示客户姓名。')}</div>`;
  }

  function bindNav() {
    const links = [...document.querySelectorAll('[data-sec]')];
    const setActive = (id) => {
      links.forEach((link) => {
        const on = link.dataset.sec === id;
        link.classList.toggle('on', on);
        if (on) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    };
    const sections = [...document.querySelectorAll('section.sec')];
    const spy = () => {
      const nav = document.querySelector('.pills-wrap');
      const line = (nav?.getBoundingClientRect().bottom || 72) + 24;
      let current = sections[0]?.id || 'overview';
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) current = section.id;
      }
      setActive(current);
    };
    links.forEach((link) => link.addEventListener('click', () => setActive(link.dataset.sec)));
    document.addEventListener('scroll', spy, { passive: true, capture: true });
    window.addEventListener('scroll', spy, { passive: true });
    window.addEventListener('resize', spy);
    setActive((location.hash || '#overview').slice(1));
    requestAnimationFrame(spy);
  }

  function tick() {
    const clock = paintChrome();
    paintCharts(clock);
  }

  async function main() {
    if (!M) {
      document.querySelectorAll('.wait').forEach((el) => { el.textContent = '页面脚本不完整，暂时不能计算。'; });
      return;
    }
    const [data, progress, usage, exams, pipeline, skills] = await Promise.all([
      loadJson('./data.json'),
      loadJson('./data/progress.json'),
      loadJson('./data/usage.json'),
      loadJson('./data/exams.json'),
      loadJson('./data/pipeline.json'),
      loadJson('./data/skills.json'),
    ]);
    if (!data || data.__error || !Array.isArray(data.teams)) {
      document.querySelectorAll('.wait').forEach((el) => { el.textContent = '暂时读不到公司数据。'; });
      paintChrome();
      return;
    }
    state.data = data;
    state.progress = progress;
    state.usage = usage;
    state.exams = exams;
    state.pipeline = pipeline;
    state.skills = skills;
    state.events = M.parseScoreEvents(data.feed, data.teams);
    state.mismatches = M.replayMismatches(data.teams, state.events, data.workRules || {});
    renderOverview();
    renderProgress();
    renderPeople();
    renderDev();
    renderTasks();
    renderUsage();
    renderExams(exams);
    renderClients();
    renderSkills();
    bindNav();
    const syncSticky = () => {
      const nav = document.querySelector('.pills-wrap');
      if (nav) document.documentElement.style.setProperty('--sticky-h', `${nav.offsetHeight}px`);
    };
    syncSticky();
    window.addEventListener('resize', syncSticky);
    document.addEventListener('click', (event) => {
      const row = event.target.closest('.mrow');
      if (row && !row.classList.contains('mstatic')) {
        const art = row.closest('.person');
        const open = !art.classList.contains('open');
        art.classList.toggle('open', open);
        row.setAttribute('aria-expanded', open ? 'true' : 'false');
        const detail = art.querySelector('.mdetail');
        if (detail) detail.hidden = !open;
        return;
      }
      const chip = event.target.closest('.skill-chip');
      if (chip) {
        const card = chip.closest('.skill-card');
        const pop = card.querySelector('.skill-pop');
        const willOpen = chip.getAttribute('aria-expanded') !== 'true';
        document.querySelectorAll('.skill-chip').forEach((el) => el.setAttribute('aria-expanded', 'false'));
        document.querySelectorAll('.skill-chip').forEach((el) => el.classList.remove('on'));
        document.querySelectorAll('.skill-pop').forEach((el) => { el.hidden = true; el.innerHTML = ''; });
        if (willOpen) {
          const skill = (state.skills?.skills || []).find((item) => item.id === chip.dataset.skill);
          if (skill && pop) {
            pop.innerHTML = skillDetail(skill, chip.dataset.dept || '');
            pop.hidden = false;
            chip.setAttribute('aria-expanded', 'true');
            chip.classList.add('on');
          }
        }
        return;
      }
      const info = event.target.closest('.info');
      if (info) {
        const box = info.parentElement.querySelector('.tipbox');
        const willOpen = box.hidden;
        document.querySelectorAll('.tipbox').forEach((el) => { el.hidden = true; });
        document.querySelectorAll('.info').forEach((el) => el.setAttribute('aria-expanded', 'false'));
        if (willOpen) {
          box.hidden = false;
          info.setAttribute('aria-expanded', 'true');
        }
        return;
      }
      if (!event.target.closest('.tip')) {
        document.querySelectorAll('.tipbox').forEach((el) => { el.hidden = true; });
        document.querySelectorAll('.info').forEach((el) => el.setAttribute('aria-expanded', 'false'));
      }
    });
    const toTop = $('#toTop');
    if (toTop) {
      const syncTop = () => { toTop.hidden = !(isPhone() && window.scrollY > 480); };
      window.addEventListener('scroll', syncTop, { passive: true });
      toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
      syncTop();
    }
    matchMedia(phoneQuery).addEventListener('change', () => {
      applyPeopleFilter();
      paintCharts(readClock());
    });
    window.__dash = { renderExams, readClock, state };
    setInterval(tick, 60000);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  main();
})();
