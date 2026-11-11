/* Shared clock, score, and feed rules for the company dashboard.
   Hour math mirrors src/main.js (regularHoursBetween / scoreParts).
   Do not drift from that file: total = workScore - extraPenalty + hourPoints.
   Overtime is shown separately and is not added again. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EvergateDash = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TZ = 'Asia/Kuala_Lumpur';
  const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const ACT = {
    desk: '忙碌',
    meeting: '开会中',
    report: '汇报中',
    errand: '交接任务',
    coffee: '喝咖啡',
    rest: '休息',
    off: '下班',
  };

  function hm(s) {
    const [h, m] = String(s || '0:0').split(':').map(Number);
    return h * 60 + m;
  }
  function klParts(date) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
    }).formatToParts(date).map((p) => [p.type, p.value]));
    return {
      year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
      hour: Number(parts.hour), minute: Number(parts.minute),
      dow: DOW[parts.weekday] ?? 0,
    };
  }
  function klToMs(y, m, d, h, min) {
    return Date.UTC(y, m - 1, d, h - 8, min, 0);
  }
  function fmtScore(n) {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    return v.toFixed(2);
  }
  function fmtKL(ms) {
    const p = klParts(new Date(ms));
    const pad = (n) => String(n).padStart(2, '0');
    return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
  }
  function regularHoursBetween(startMs, endMs, rules) {
    if (!(endMs > startMs)) return 0;
    const days = new Set(rules.workDays || [1, 2, 3, 4, 5]);
    const openM = hm(rules.workStart || '09:00');
    const closeM = hm(rules.workEnd || '18:00');
    let total = 0;
    let dayMs = klToMs(klParts(new Date(startMs)).year, klParts(new Date(startMs)).month, klParts(new Date(startMs)).day, 0, 0);
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
  function scoreParts(staff, rules, nowMs) {
    const task = Number(staff?.workScore) || 0;
    const extra = Number(staff?.extraPenalty) || 0;
    const otHours = Number(staff?.overtimeHours) || 0;
    const overtime = otHours * (Number(rules.overtimePoints) || 0);
    const started = Date.parse(rules.trackingStartedAt || '');
    const hours = Number.isFinite(started) ? regularHoursBetween(started, nowMs, rules) : 0;
    const hourPts = hours * (Number(rules.hourPoints) || 0);
    const total = Math.round((task - extra + hourPts) * 100) / 100;
    return {
      task: Math.round(task * 100) / 100,
      extra,
      hours,
      hourPts: Math.round(hourPts * 100) / 100,
      overtime: Math.round(overtime * 100) / 100,
      total,
    };
  }
  function workBarOff(staff, team, rules) {
    if (staff?.noWorkBar || team?.noWorkBar || team?.private) return true;
    const blocked = rules?.noWorkBarTeams || [];
    if (team?.id && blocked.includes(team.id)) return true;
    if (staff?.id && blocked.includes(staff.id)) return true;
    return false;
  }
  function isWorkingHours(date) {
    const p = klParts(date);
    const mins = p.hour * 60 + p.minute;
    return p.dow >= 1 && p.dow <= 5 && mins >= 9 * 60 && mins < 18 * 60;
  }
  function meetingActive(meeting, date) {
    if (!meeting) return false;
    const p = klParts(date);
    const minutes = p.hour * 60 + p.minute;
    if (meeting.weekday != null && p.dow !== meeting.weekday) return false;
    if (meeting.monthday != null && p.day !== meeting.monthday) return false;
    return minutes >= hm(meeting.start) && minutes < hm(meeting.end);
  }
  function activityKey(date, meetings) {
    if (!isWorkingHours(date)) return 'off';
    if ((meetings || []).some((m) => meetingActive(m, date))) return 'meeting';
    return 'desk';
  }
  function greetingWord(hour) {
    if (hour < 5 || hour >= 18) return '晚安';
    if (hour >= 12) return '午安';
    return '早安';
  }
  function hourOf(date, timeZone) {
    const opt = { hour: '2-digit', hourCycle: 'h23' };
    if (timeZone) opt.timeZone = timeZone;
    const part = new Intl.DateTimeFormat('en-US', opt).formatToParts(date).find((p) => p.type === 'hour');
    return Number(part?.value);
  }
  function findStaff(teams, label) {
    let best = null;
    for (const team of teams || []) {
      if (team.private) continue;
      for (const staff of team.staff || []) {
        const name = staff.name || '';
        if (!(name === label || name.startsWith(label) || label.startsWith(name))) continue;
        if (!best || name.length > best.staff.name.length) best = { team, staff };
      }
    }
    return best;
  }
  function parseScoreEvents(feed, teams) {
    const events = [];
    for (const item of feed || []) {
      const text = String(item.text || '');
      const starMatch = text.match(/([1-5])\s*☆/);
      const stars = starMatch ? Number(starMatch[1]) : null;
      const daily = /日常/.test(text);
      let mode = null;
      let points = null;
      let label = null;
      const base = text.match(/工作条基数\s*([0-9]+(?:\.[0-9]+)?)/);
      if (base) {
        mode = 'set';
        points = Number(base[1]);
        const name = text.match(/^(.+?)记入/);
        label = name ? name[1].trim() : null;
      } else {
        const arrow = text.match(/→\s*(.+?)\s*$/);
        const plus = text.match(/[+＋]\s*([0-9]+(?:\.[0-9]+)?)/);
        if (arrow && plus) {
          mode = 'add';
          points = Number(plus[1]);
          label = arrow[1].trim();
        }
      }
      if (!mode || !label || !Number.isFinite(points)) continue;
      const found = findStaff(teams, label);
      if (!found) continue;
      events.push({
        time: item.time,
        teamId: found.team.id,
        staffId: found.staff.id,
        name: found.staff.name,
        dept: found.team.name,
        mode,
        points,
        stars,
        daily,
        text,
      });
    }
    events.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    return events;
  }
  function taskScoreAt(events, staffId, timeMs) {
    let value = 0;
    for (const event of events) {
      if (event.staffId !== staffId) continue;
      const t = Date.parse(event.time);
      if (!Number.isFinite(t) || t > timeMs) continue;
      value = event.mode === 'set' ? event.points : Math.round((value + event.points) * 100) / 100;
    }
    return Math.round(value * 100) / 100;
  }
  function replayMismatches(teams, events, rules) {
    const far = Date.now() + 86400000 * 3650;
    const rows = [];
    for (const team of teams || []) {
      for (const staff of team.staff || []) {
        if (workBarOff(staff, team, rules)) continue;
        const expected = Math.round((Number(staff.workScore) || 0) * 100) / 100;
        const got = taskScoreAt(events, staff.id, far);
        if (Math.abs(got - expected) > 0.001) rows.push({ id: staff.id, name: staff.name, expected, got });
      }
    }
    return rows;
  }
  function companyTotalAt(teams, rules, events, timeMs) {
    const started = Date.parse(rules.trackingStartedAt || '');
    const hours = Number.isFinite(started) ? regularHoursBetween(started, timeMs, rules) : 0;
    const hourPtsRaw = hours * (Number(rules.hourPoints) || 0);
    let sum = 0;
    for (const team of teams || []) {
      for (const staff of team.staff || []) {
        if (workBarOff(staff, team, rules)) continue;
        const task = taskScoreAt(events, staff.id, timeMs);
        const extra = Number(staff.extraPenalty) || 0;
        sum += Math.round((task - extra + hourPtsRaw) * 100) / 100;
      }
    }
    return Math.round(sum * 100) / 100;
  }
  function companyTotalLive(teams, rules, nowMs) {
    let sum = 0;
    let people = 0;
    for (const team of teams || []) {
      for (const staff of team.staff || []) {
        if (workBarOff(staff, team, rules)) continue;
        people += 1;
        sum += scoreParts(staff, rules, nowMs).total;
      }
    }
    return { total: Math.round(sum * 100) / 100, people };
  }
  function trendPoints(teams, rules, events, nowMs) {
    const start = Date.parse(rules.trackingStartedAt || '');
    if (!Number.isFinite(start) || !(nowMs >= start)) return [];
    const times = new Set([start, nowMs]);
    for (const event of events) {
      const t = Date.parse(event.time);
      if (t >= start && t <= nowMs) times.add(t);
    }
    const openM = hm(rules.workStart || '09:00');
    const closeM = hm(rules.workEnd || '18:00');
    let dayMs = klToMs(klParts(new Date(start)).year, klParts(new Date(start)).month, klParts(new Date(start)).day, 0, 0);
    for (let i = 0; i < 800 && dayMs < nowMs + 86400000; i++) {
      const p = klParts(new Date(dayMs + 12 * 3600000));
      const win0 = klToMs(p.year, p.month, p.day, Math.floor(openM / 60), openM % 60);
      const win1 = klToMs(p.year, p.month, p.day, Math.floor(closeM / 60), closeM % 60);
      if (win0 > start && win0 < nowMs) times.add(win0);
      if (win1 > start && win1 < nowMs) times.add(win1);
      dayMs += 86400000;
    }
    return [...times].sort((a, b) => a - b).map((t) => ({ t, total: companyTotalAt(teams, rules, events, t) }));
  }
  function departmentRanks(teams, rules, nowMs) {
    const rows = [];
    for (const team of teams || []) {
      if (team.private) continue;
      const people = (team.staff || []).filter((s) => !workBarOff(s, team, rules));
      if (!people.length) continue;
      let sum = 0;
      for (const staff of people) sum += scoreParts(staff, rules, nowMs).total;
      rows.push({
        id: team.id,
        name: team.name,
        n: people.length,
        total: Math.round(sum * 100) / 100,
      });
    }
    rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'zh'));
    return rows;
  }
  function milestonePhase(item, now) {
    if (item.status === 'done') return 'done';
    const p = klParts(now);
    const today = p.year * 10000 + p.month * 100 + p.day;
    const [y, m, d] = String(item.date || '').split('-').map(Number);
    const stamp = y * 10000 + m * 100 + d;
    if (!y || !m || !d) return 'upcoming';
    if (stamp > today) return 'upcoming';
    if (stamp === today) return 'today';
    return 'overdue';
  }
  function staffCount(teams) {
    return (teams || []).reduce((n, team) => n + (team.staff || []).length, 0);
  }
  function taskCounts(tasks) {
    const counts = { doing: 0, confirm: 0, done: 0, other: 0 };
    for (const task of tasks || []) {
      if (counts[task.status] != null) counts[task.status] += 1;
      else counts.other += 1;
    }
    return counts;
  }

  return {
    TZ, ACT, hm, klParts, klToMs, fmtScore, fmtKL,
    regularHoursBetween, scoreParts, workBarOff, isWorkingHours, meetingActive, activityKey,
    greetingWord, hourOf, parseScoreEvents, taskScoreAt, replayMismatches,
    companyTotalAt, companyTotalLive, trendPoints, departmentRanks, milestonePhase,
    staffCount, taskCounts,
  };
});
