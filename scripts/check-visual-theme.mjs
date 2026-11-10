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
const strip = (doc) => JSON.parse(JSON.stringify(doc, (k, v) => (k === 'color' ? undefined : v)));
assert.deepEqual(strip(data), strip(base));

const scene = fs.readFileSync(new URL('../src/scene.js', import.meta.url), 'utf8');
const priv = scene.match(/privfin:\s*\{[^}]+\}/);
assert.ok(priv, 'privfin layout');
assert.match(priv[0], /x:\s*13\.5/);
assert.match(priv[0], /z:\s*12/);
assert.match(priv[0], /w:\s*10/);
assert.match(priv[0], /d:\s*8\.5/);
assert.doesNotMatch(scene, /私人助理/);

const sw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
assert.match(sw, /evergate-office-v73/);
assert.match(sw, /brand-theme\.js/);
assert.doesNotMatch(fs.readFileSync(new URL('../public/dashboard-model.js', import.meta.url), 'utf8'), /EvergateBrand/);

const modelDiff = execSync('git diff origin/main -- public/dashboard-model.js', { encoding: 'utf8' });
assert.equal(modelDiff, '');

console.log(JSON.stringify({ ok: true, cache: 'evergate-office-v73', private: colors.privfin }));
