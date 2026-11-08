import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../public/dashboard-model.js');
const data = require('../public/data.json');
const rules = data.workRules;
const start = Date.parse(rules.trackingStartedAt);
const friEnd = Date.parse('2026-11-06T18:00:00+08:00');
const monday = Date.parse('2026-11-09T10:30:00+08:00');
const sunday = Date.parse('2026-11-08T21:00:00+08:00');
const meet = Date.parse('2026-11-09T09:15:00+08:00');

const fridayHours = M.regularHoursBetween(start, friEnd, rules);
assert.ok(Math.abs(fridayHours - (8 + 4 / 60)) < 1e-9, fridayHours);
const mondayHours = M.regularHoursBetween(start, monday, rules);
assert.ok(Math.abs(mondayHours - (8 + 4 / 60 + 1.5)) < 1e-9, mondayHours);

const idle = data.teams.find((t) => t.id === 'market').staff.find((s) => s.id === 'market-2');
const parts = M.scoreParts(idle, rules, monday);
assert.equal(parts.hourPts, 4.78);
assert.equal(parts.total, 4.78);
assert.equal(parts.overtime, 0);
assert.equal(M.scoreParts(idle, rules, sunday).hourPts, 4.03);

assert.equal(M.activityKey(new Date(monday), data.meetings), 'desk');
assert.equal(M.activityKey(new Date(meet), data.meetings), 'meeting');
assert.equal(M.activityKey(new Date(sunday), data.meetings), 'off');
assert.equal(M.activityKey(new Date('2026-11-09T18:00:00+08:00'), data.meetings), 'off');

assert.equal(M.greetingWord(10), '早安');
assert.equal(M.greetingWord(12), '午安');
assert.equal(M.greetingWord(18), '晚安');
assert.equal(M.greetingWord(4), '晚安');

const events = M.parseScoreEvents(data.feed, data.teams);
const bad = M.replayMismatches(data.teams, events, rules);
assert.deepEqual(bad, []);
assert.equal(M.staffCount(data.teams), 49);
const counts = M.taskCounts(data.tasks);
assert.deepEqual(counts, { doing: 19, confirm: 3, done: 9, other: 0 });

const live = M.companyTotalLive(data.teams, rules, monday);
const trend = M.trendPoints(data.teams, rules, events, monday);
assert.equal(trend.at(-1).total, live.total);
assert.equal(live.people, 47);
assert.equal(M.milestonePhase({ date: '2026-11-09', status: 'planned' }, new Date(monday)), 'today');
assert.equal(M.milestonePhase({ date: '2026-11-16', status: 'planned' }, new Date(monday)), 'upcoming');
assert.equal(M.milestonePhase({ date: '2026-11-08', status: 'done' }, new Date(monday)), 'done');

const ed = data.teams.find((t) => t.id === 'ed');
assert.equal(M.workBarOff(ed.staff[0], ed, rules), true);
const priv = data.teams.find((t) => t.id === 'privfin');
assert.equal(M.workBarOff(priv.staff[0], priv, rules), true);

console.log(JSON.stringify({
  live: live.total,
  hourPts: parts.hourPts,
  events: events.length,
  ranks: M.departmentRanks(data.teams, rules, monday),
}, null, 2));
