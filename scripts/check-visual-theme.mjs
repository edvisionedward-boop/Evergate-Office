import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const brand = require('../public/brand-theme.js');
const data = require('../public/data.json');

assert.equal(brand.teamColor({ id: 'privfin', private: true }), '#AEB7C2');
assert.equal(brand.teamColor({ id: 'it', private: false, color: '#7eb6d6' }), '#D0B993');
assert.equal(brand.areaColor('showroom', false), '#D0B993');
assert.equal(brand.areaColor('privfin', false), '#AEB7C2');
assert.equal(brand.GOLD, '#D0B993');
assert.equal(brand.PRIVATE, '#AEB7C2');

const colors = Object.fromEntries(data.teams.map((t) => [t.id, t.color]));
assert.equal(colors.privfin, '#AEB7C2');
for (const id of ['ed', 'market', 'design', 'info', 'it', 'legal', 'invest', 'corpfin', 'logistics', 'review']) {
  assert.equal(colors[id], '#D0B993', id);
}

const base = JSON.parse(execSync('git show origin/main:public/data.json', { encoding: 'utf8' }));
function ledgerView(doc) {
  return {
    workRules: doc.workRules,
    teams: (doc.teams || []).map((t) => ({
      id: t.id,
      score: t.score,
      gradeNote: t.gradeNote,
      gradedAt: t.gradedAt,
      staff: (t.staff || []).map((s) => ({
        id: s.id,
        score: s.score,
        gradeNote: s.gradeNote,
        gradedAt: s.gradedAt,
        tasksDone: s.tasksDone,
        mistakes: s.mistakes,
        workScore: s.workScore,
        extraPenalty: s.extraPenalty,
        overtimeHours: s.overtimeHours,
        consecutiveFailures: s.consecutiveFailures,
      })),
    })),
  };
}
assert.deepEqual(ledgerView(data), ledgerView(base));
assert.equal(data.teams.find((t) => t.id === 'it').statusNote, '内部项目方案修订中');
assert.equal(data.teams.find((t) => t.id === 'market').currentTask, '11-16 周报已审结');
assert.equal(data.directory.statusGroups.find((g) => g.status === 'idle').label, '空闲');
assert.equal(data.statusLabels.idle, '空闲');
assert.equal(Object.keys(data.archive).some((key) => key.toLowerCase().endsWith('url')), false);
assert.match(data.archive.confidential.retrievalRule, /私密/);
assert.equal(data.archive.confidential.retrievalRule.includes('助'), false);
assert.deepEqual(data.archive.confidential.categories.map((c) => c.name), ['法务报告', '商业机密文件', '财务报表']);
for (const cat of data.archive.confidential.categories) assert.deepEqual(cat.items, []);

const scene = fs.readFileSync(new URL('../src/scene.js', import.meta.url), 'utf8');
const priv = scene.match(/privfin:\s*\{[^}]+\}/);
assert.ok(priv, 'privfin layout');
assert.match(priv[0], /x:\s*13\.5/);
assert.match(priv[0], /z:\s*12/);
assert.match(priv[0], /w:\s*10/);
assert.match(priv[0], /d:\s*8\.5/);
assert.doesNotMatch(scene, /私人助理/);

const sw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
assert.match(sw, /evergate-office-v74/);
assert.match(sw, /brand-theme\.js/);
assert.doesNotMatch(fs.readFileSync(new URL('../public/dashboard-model.js', import.meta.url), 'utf8'), /EvergateBrand/);

const modelDiff = execSync('git diff origin/main -- public/dashboard-model.js', { encoding: 'utf8' });
assert.equal(modelDiff, '');

console.log(JSON.stringify({ ok: true, cache: 'evergate-office-v74', private: colors.privfin }));
