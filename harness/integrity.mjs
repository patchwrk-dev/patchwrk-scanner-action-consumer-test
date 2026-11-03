/* global process, console, URL */
import assert from 'node:assert/strict';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const base=path.join(process.env.GITHUB_WORKSPACE,'trusted/action');
const expected=JSON.parse(await readFile(new URL('./expected-inventory.json',import.meta.url),'utf8'));
async function walk(dir){const result=[];for(const entry of await readdir(dir)){if(entry==='.git')continue;const p=path.join(dir,entry),s=await lstat(p);assert.ok(!s.isSymbolicLink());if(s.isDirectory())result.push(...await walk(p));else{assert.ok(s.isFile()&&s.nlink===1);result.push(path.relative(base,p));}}return result;}
assert.deepEqual((await walk(base)).sort(),expected.files.map(f=>f.path).sort());
for(const f of expected.files){const data=await readFile(path.join(base,f.path));assert.equal(data.length,f.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),f.sha256);}
assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.versions.node.split('.')[0],'24');
console.log(JSON.stringify({distributionIntegrity:'PASS',commit:expected.commit,files:expected.files.length,node:process.versions.node}));
