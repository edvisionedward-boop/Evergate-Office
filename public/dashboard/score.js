/**
 * Score math for the public dashboard.
 * Mirrors src/main.js (workRules, regularHoursBetween, scoreParts, workBarOff)
 * without importing the 3D office. Displayed total = workScore − extraPenalty
 * + hourPoints × weekday hours since trackingStartedAt. Overtime is reported
 * from recorded overtimeHours and is not added to that total.
 *
 * Task-score history is taken only from feed lines that state an award
 * （达标 +x or 工作条基数 x） and name the person. It is drawn only when those
 * amounts reconcile to each person's current workScore.
 */

export const TZ = 'Asia/Kuala_Lumpur';
const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function fmtScore(n) {
  return round2(n).toFixed(2);
}

export function hm(s) {
  const [h, m] = String(s || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function klParts(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    dow: DOW[parts.weekday] ?? 0,
  };
}

export function klToMs(y, m, d, h, min) {
  return Date.UTC(y, m - 1, d, h - 8, min, 0);
}

export function fmtUtc8(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = klParts(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)} (UTC+8)`;
}

export function greeting(date) {
  const { hour } = klParts(date);
  let word = '晚安';
  if (hour >= 5 && hour < 12) word = '早安';
  else if (hour >= 12 && hour < 18) word = '午安';
  return `${word}，Edward`;
}

export function clockMs(search, fallback = Date.now()) {
  const q = new URLSearchParams(search || '').get('now');
  if (!q) return { ms: fallback, frozen: false };
  const d = new Date(q);
  if (Number.isNaN(d.getTime())) return { ms: fallback, frozen: false };
  return { ms: d.getTime(), frozen: true };
}

export function regularHoursBetween(startMs, endMs, rules) {
  if (!(endMs > startMs)) return 0;
  const days = new Set(rules?.workDays || [1, 2, 3, 4, 5]);
  const openM = hm(rules?.workStart || '09:00');
  const closeM = hm(rules?.workEnd || '18:00');
  let total = 0;
  const startParts = klParts(new Date(startMs));
  let dayMs = klToMs(startParts.year, startParts.month, startParts.day, 0, 0);
  for (let i = 0; i < 800 && dayMs < endMs + 86400000; i++) {
    const p = klParts(new Date(dayMs + 12 * 3600000));
    if (days.has(p.dow)) {
      const win0 = klToMs(p.year, p.month, p.day, Math.floor(openM / 60), openM % 60);
      const win1 = klToMs(p.year, p.month, p.day, Math.floor(closeM / 60), closeM % 60);
      const a = Math.max(win0, startMs);
      const b = Math.min(win1, endMs);
      if (b > a) total += (b - a) / 3600000;
    }
    dayMs += 86400000;
  }
  return total;
}

export function workBarOff(staff, team, rules) {
  if (staff?.noWorkBar || team?.noWorkBar || team?.private) return true;
  const blocked = rules?.noWorkBarTeams || [];
  if (team?.id && blocked.includes(team.id)) return true;
  if (staff?.id && blocked.includes(staff.id)) return true;
  return false;
}

export function scoreParts(staff, rules, nowMs) {
  const task = Number(staff?.workScore) || 0;
  const extra = Number(staff?.extraPenalty) || 0;
  const otHours = Number(staff?.overtimeHours) || 0;
  const overtime = otHours * (Number(rules?.overtimePoints) || 0);
  const started = Date.parse(rules?.trackingStartedAt || '');
  const hours = Number.isFinite(started) ? regularHoursBetween(started, nowMs, rules) : 0;
  const hourPts = hours * (Number(rules?.hourPoints) || 0);
  const total = round2(task - extra + hourPts);
  return {
    task: round2(task),
    extra,
    hours,
    hourPts: round2(hourPts),
    overtime: round2(overtime),
    total,
  };
}

function rosterOf(data) {
  const out = [];
  for (const team of data?.teams || []) {
    for (const staff of team.staff || []) {
      out.push({ staff, team, private: !!team.private });
    }
  }
  return out;
}

function matchStaff(token, roster) {
  const t = String(token || '').trim().replace(/[。．.，,]+$/g, '');
  if (t.length < 2) return null;
  const hits = roster.filter((row) => {
    if (row.private) return false;
    const name = row.staff.name || '';
    const chip = row.staff.chip || '';
    if (name === t || (name.startsWith(t) && t.length >= 2)) return true;
    if (chip && chip === t) return true;
    return false;
  });
  if (!hits.length) return null;
  hits.sort((a, b) => (b.staff.name || '').length - (a.staff.name || '').length);
  return hits[0];
}

function awardOf(text) {
  const base = text.match(/工作条基数\s*([0-9]+(?:\.[0-9]+)?)/);
  if (base) return { kind: 'base', amount: Number(base[1]) };
  const re = /(?:日常达标|达标|质量加分)\s*\+\s*([0-9]+(?:\.[0-9]+)?)/g;
  let sum = 0;
  let n = 0;
  let m = re.exec(text);
  while (m) {
    sum += Number(m[1]);
    n += 1;
    m = re.exec(text);
  }
  if (!n) return null;
  return { kind: 'add', amount: round2(sum) };
}

function tokenOf(text) {
  const arrow = text.match(/→\s*([^\s→]+)/);
  if (arrow) return arrow[1];
  const lead = text.match(/^(.+?)记入/);
  return lead ? lead[1].trim() : '';
}

export function buildTaskTimelines(data) {
  const rules = data?.workRules || {};
  const roster = rosterOf(data);
  const privateTeams = new Set((data?.teams || []).filter((t) => t.private).map((t) => t.id));
  const buckets = new Map();
  const unmatched = [];
  (data?.feed || []).forEach((item, index) => {
    if (privateTeams.has(item.team)) return;
    const text = String(item?.text || '');
    const award = awardOf(text);
    if (!award) return;
    const row = matchStaff(tokenOf(text), roster);
    if (row && (row.private || workBarOff(row.staff, row.team, rules))) return;
    if (!row) {
      unmatched.push(text);
      return;
    }
    const t = Date.parse(item.time);
    if (!Number.isFinite(t)) {
      unmatched.push(text);
      return;
    }
    const list = buckets.get(row.staff.id) || [];
    list.push({ t, index, kind: award.kind, amount: award.amount });
    buckets.set(row.staff.id, list);
  });

  const byId = {};
  let allReconciled = unmatched.length === 0;
  for (const row of roster) {
    if (row.private || workBarOff(row.staff, row.team, rules)) continue;
    const events = (buckets.get(row.staff.id) || []).slice().sort((a, b) => (
      a.t - b.t || (a.kind === 'base' ? 0 : 1) - (b.kind === 'base' ? 0 : 1) || b.index - a.index
    ));
    let score = 0;
    const points = [];
    for (const ev of events) {
      score = ev.kind === 'base' ? ev.amount : round2(score + ev.amount);
      points.push({ t: ev.t, score: round2(score) });
    }
    const stored = round2(row.staff.workScore || 0);
    const finalScore = points.length ? points[points.length - 1].score : 0;
    const reconciled = Math.abs(finalScore - stored) < 0.001;
    if (!reconciled) allReconciled = false;
    byId[row.staff.id] = { points, reconciled, stored };
  }
  return { byId, allReconciled, unmatched: unmatched.length };
}

function taskAt(points, t) {
  let score = 0;
  for (const p of points || []) {
    if (p.t <= t) score = p.score;
    else break;
  }
  return score;
}

function sampleTimes(start, end, rules, extra) {
  const times = new Set([start, end, ...extra]);
  const days = new Set(rules?.workDays || [1, 2, 3, 4, 5]);
  const openM = hm(rules?.workStart || '09:00');
  const closeM = hm(rules?.workEnd || '18:00');
  const startParts = klParts(new Date(start));
  let dayMs = klToMs(startParts.year, startParts.month, startParts.day, 0, 0);
  for (let i = 0; i < 800 && dayMs < end + 86400000; i++) {
    const p = klParts(new Date(dayMs + 12 * 3600000));
    if (days.has(p.dow)) {
      const win0 = klToMs(p.year, p.month, p.day, Math.floor(openM / 60), openM % 60);
      const win1 = klToMs(p.year, p.month, p.day, Math.floor(closeM / 60), closeM % 60);
      for (let t = win0; t <= win1; t += 30 * 60 * 1000) {
        if (t >= start && t <= end) times.add(t);
      }
      if (win1 >= start && win1 <= end) times.add(win1);
    }
    dayMs += 86400000;
  }
  return [...times].filter((t) => t >= start && t <= end).sort((a, b) => a - b);
}

export function peopleRows(data, nowMs) {
  const rules = data?.workRules || {};
  const rows = [];
  for (const team of data?.teams || []) {
    for (const staff of team.staff || []) {
      if (team.private || workBarOff(staff, team, rules)) continue;
      const parts = scoreParts(staff, rules, nowMs);
      rows.push({
        id: staff.id,
        name: staff.name,
        chip: staff.chip || '',
        teamId: team.id,
        team: team.short || team.name,
        teamName: team.name,
        color: team.color || '#7eb6ff',
        ...parts,
      });
    }
  }
  rows.sort((a, b) => b.total - a.total || b.task - a.task || a.name.localeCompare(b.name, 'zh'));
  return rows;
}

export function scoreModel(data, nowMs) {
  const rules = data?.workRules || {};
  const rows = peopleRows(data, nowMs);
  const timelines = buildTaskTimelines(data);
  const sum = (key) => round2(rows.reduce((n, r) => n + r[key], 0));
  const company = sum('total');
  const task = sum('task');
  const hourPts = sum('hourPts');
  const overtime = sum('overtime');
  const hours = rows[0]?.hours || 0;
  const hourEach = rows[0]?.hourPts || 0;
  const start = Date.parse(rules.trackingStartedAt || '');
  const depts = new Map();
  for (const row of rows) {
    const cur = depts.get(row.teamId) || {
      id: row.teamId, name: row.team, full: row.teamName, color: row.color,
      total: 0, task: 0, hourPts: 0, overtime: 0, people: 0,
    };
    cur.total = round2(cur.total + row.total);
    cur.task = round2(cur.task + row.task);
    cur.hourPts = round2(cur.hourPts + row.hourPts);
    cur.overtime = round2(cur.overtime + row.overtime);
    cur.people += 1;
    depts.set(row.teamId, cur);
  }
  const departments = [...depts.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'zh'));

  let series = [];
  if (Number.isFinite(start) && rows.length && timelines.allReconciled) {
    const extras = [];
    for (const row of rows) {
      for (const p of timelines.byId[row.id]?.points || []) extras.push(p.t);
    }
    const times = sampleTimes(start, nowMs, rules, extras);
    series = times.map((t) => {
      const hoursT = regularHoursBetween(start, t, rules);
      const hourRaw = hoursT * (Number(rules.hourPoints) || 0);
      let taskSum = 0;
      let hourSum = 0;
      let totalSum = 0;
      for (const row of rows) {
        const taskP = taskAt(timelines.byId[row.id]?.points, t);
        const totalP = round2(taskP - (Number(row.extra) || 0) + hourRaw);
        taskSum += taskP;
        hourSum += round2(hourRaw);
        totalSum += totalP;
      }
      return { t, task: round2(taskSum), hourPts: round2(hourSum), total: round2(totalSum) };
    });
  } else if (Number.isFinite(start) && rows.length) {
    const times = sampleTimes(start, nowMs, rules, []);
    series = times.map((t) => {
      const hoursT = regularHoursBetween(start, t, rules);
      const hourRaw = hoursT * (Number(rules.hourPoints) || 0);
      const hourSum = round2(rows.length * round2(hourRaw));
      return { t, task: null, hourPts: hourSum, total: hourSum, hoursOnly: true };
    });
  }

  const privateTeam = (data?.teams || []).find((t) => t.private);
  const edOff = (data?.teams || []).some((t) => t.id === 'ed' && (t.noWorkBar || (rules.noWorkBarTeams || []).includes('ed')));
  return {
    rows,
    departments,
    series,
    historyReconciled: timelines.allReconciled,
    company,
    task,
    hourPts,
    overtime,
    hours,
    hourEach,
    headcount: rows.length,
    trackingLabel: Number.isFinite(start) ? fmtUtc8(rules.trackingStartedAt) : '',
    hasPrivate: !!privateTeam,
    edOff,
  };
}

export function taskModel(data) {
  const teams = data?.teams || [];
  const privateIds = new Set(teams.filter((t) => t.private).map((t) => t.id));
  const byId = Object.fromEntries(teams.map((t) => [t.id, t]));
  const tasks = (data?.tasks || []).filter((t) => !privateIds.has(t.team));
  const count = { doing: 0, confirm: 0, done: 0 };
  for (const task of tasks) {
    if (count[task.status] != null) count[task.status] += 1;
  }
  const decorate = (task) => {
    const team = byId[task.team];
    let stars = '未标星';
    if (Number(task.stars) >= 1) stars = `${'★'.repeat(Math.min(5, Number(task.stars)))} ${Number(task.stars)}`;
    else if (task.kind === 'routine') stars = '日常';
    else if (task.kind === 'special') stars = '特殊 · 未标星';
    let points = '未单列';
    if (task.points != null && task.points !== '' && Number.isFinite(Number(task.points))) points = fmtScore(task.points);
    else if (task.award != null && Number.isFinite(Number(task.award))) points = fmtScore(task.award);
    return {
      id: task.id,
      title: task.title || '',
      status: task.status,
      team: team?.private ? '私密' : (team?.short || team?.name || task.team),
      teamName: team?.private ? '私密' : (team?.name || task.team),
      color: team?.color || '#7eb6ff',
      when: fmtUtc8(task.updatedAt),
      stars,
      points,
    };
  };
  const byTime = (a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0);
  return {
    count,
    total: tasks.length,
    done: tasks.filter((t) => t.status === 'done').sort(byTime).map(decorate),
    confirm: tasks.filter((t) => t.status === 'confirm').sort(byTime).map(decorate),
  };
}
