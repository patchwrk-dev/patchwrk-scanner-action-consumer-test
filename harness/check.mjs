import assert from 'node:assert/strict';
import { lstat, readdir, realpath, open, readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const here = import.meta.dirname;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export async function snapshot(root) {
  assert.equal(await realpath(root), root);
  const result = {};
  const allowed = JSON.parse(await readFile(path.join(here, 'repository-files.json'), 'utf8'));
  let total = 0;
  async function visit(dir, depth) {
    assert.ok(depth <= 8);
    const names = (await readdir(dir)).sort();
    assert.ok(names.length <= 100);
    for (const name of names) {
      if (dir === root && name === '.git') continue;
      const file = path.join(dir, name), relative = path.relative(root, file);
      const before = await lstat(file);
      assert.ok(!before.isSymbolicLink());
      if (before.isDirectory()) { assert.ok(allowed.some(p=>p.startsWith(relative+path.sep))); await visit(file, depth + 1); continue; }
      assert.ok(allowed.includes(relative));
      assert.ok(before.isFile() && before.nlink === 1 && before.size <= 20000000);
      assert.ok(Object.keys(result).length < 100 && (total += before.size) <= 30000000);
      const fd = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const info = await fd.stat();
        assert.ok(info.size <= 20000000 && info.size === before.size);
        assert.ok(info.isFile() && info.nlink === 1 && info.ino === before.ino && info.dev === before.dev);
        const bytes = Buffer.alloc(info.size + 1), read = await fd.read(bytes, 0, bytes.length, 0);
        const after = await fd.stat(), current = await lstat(file);
        assert.equal(read.bytesRead, info.size);
        for (const value of [after, current]) {
          for (const key of ['ino', 'dev', 'size', 'mtimeMs', 'ctimeMs', 'nlink']) assert.equal(value[key], info[key]);
        }
        result[relative] = sha(bytes.subarray(0, read.bytesRead));
      } finally { await fd.close(); }
    }
  }
  await visit(root, 0);
  assert.deepEqual(Object.keys(result).sort(), allowed);
  const expected = {}; // Producer hashes are checked separately against the reviewed manifest.
  for (const [file, hash] of Object.entries(expected)) assert.equal(result[file], hash);
  return result;
}
export async function checkResult(text, status, summary, forbidden = []) {
  assert.equal(status, 'complete');
  assert.ok(typeof text === 'string' && Buffer.byteLength(text) < 100000);
  const result = JSON.parse(text);
  const expected = JSON.parse(await readFile(path.join(here, 'expected-result.json'), 'utf8'));
  assert.deepEqual(result, expected);
  if (summary !== undefined) {
  assert.ok(summary.includes('Status: **complete**') && summary.includes('no production-health guarantee'));
  const blocks = [...summary.matchAll(/```json\n([^]*?)\n```/g)];
  assert.equal(blocks.length, 1);
  assert.deepEqual(JSON.parse(blocks[0][1]), expected);
  }
  for (const marker of ['SYNTHETIC_QUALIFICATION_SENTINEL', 'SYNTHETIC_ONLY', 'DO_NOT_EXECUTE', 'quoted.cjs', 'src/index.ts', '::error::', ...forbidden]) {
    assert.ok(!(text + (summary ?? '')).includes(marker));
  }
  return result;
}
export async function verifyProducer(root) {
  const expected = JSON.parse(await readFile(path.join(here,'producer-files.json'),'utf8'));
  const found = {}; let total=0;
  async function walk(dir) {
    const entries=await readdir(dir,{withFileTypes:true}); assert.ok(entries.length<=100);
    for (const entry of entries) {
      if (dir === root && entry.name === '.git') continue;
      const file=path.join(dir,entry.name), rel=path.relative(root,file);
      const info=await lstat(file);
      assert.ok(!info.isSymbolicLink());
      if (info.isDirectory()) { assert.ok(rel.split(path.sep).length <= 4 && Object.keys(expected).some(p=>p.startsWith(rel+path.sep))); await walk(file); }
      else {
        assert.ok(info.isFile() && info.nlink===1 && Object.hasOwn(expected,rel));
        assert.ok(info.size<=20000000 && Object.keys(found).length<100 && (total+=info.size)<=30000000);
        const fd=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
        try {
          const opened=await fd.stat();
          assert.equal(opened.ino,info.ino); assert.equal(opened.dev,info.dev);
          assert.equal(opened.nlink,1); assert.equal(opened.size,info.size);
          const buffer=Buffer.alloc(opened.size+1);
          const read=await fd.read(buffer,0,buffer.length,0); assert.equal(read.bytesRead,opened.size);
          const bytes=buffer.subarray(0,read.bytesRead);
          const after=await fd.stat(),current=await lstat(file);
          for(const value of [after,current]) for(const key of ['ino','dev','size','mtimeMs','ctimeMs','nlink']) assert.equal(value[key],opened[key]);
          found[rel]=sha(bytes);
        } finally { await fd.close(); }
      }
    }
  }
  await walk(root); assert.deepEqual(found,expected); return found;
}
function git(root,...args) {
  const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',timeout:10000,maxBuffer:100000});
  if(args[0]==='config' && r.status===1 && r.stdout==='') return '';
  assert.equal(r.status,0); return r.stdout.trim();
}
export function verifyGit(root,commit) {
  assert.match(commit,/^[a-f0-9]{40}$/);
  assert.equal(git(root,'rev-parse','HEAD'),commit);
  assert.equal(git(root,'status','--porcelain=v1','--untracked-files=all','--ignored'),'');
  // Inspect names only: never print credential values or configuration contents.
  assert.equal(git(root,'config','--local','--name-only','--get-regexp','http\\..*extraheader|credential\\..*|core\\.sshCommand') || '', '');
}
async function main() {
  assert.equal(process.platform,'linux'); assert.equal(process.arch,'x64');
  assert.equal(process.versions.node.split('.')[0],'24');
  const phase=process.argv[2]; assert.ok(['before','after'].includes(phase));
  const workspace=await realpath(process.env.GITHUB_WORKSPACE);
  const root=await realpath(path.join(workspace,'target'));
  const producer=await realpath(path.join(workspace,'producer'));
  const temp=await realpath(process.env.RUNNER_TEMP);
  assert.equal(root,path.join(workspace,'target')); assert.equal(producer,path.join(workspace,'producer'));
  assert.ok(temp!==workspace && !temp.startsWith(workspace+path.sep));
  verifyGit(root,process.env.CONSUMER_COMMIT); verifyGit(producer,process.env.PRODUCER_COMMIT);
  assert.equal(process.env.CONSUMER_COMMIT,process.env.GITHUB_SHA);
  const current=await snapshot(root); await verifyProducer(producer);
  for(const dir of [root,temp,workspace,path.join(root,'fixtures/project')]) await assert.rejects(access(path.join(dir,'patchwrk-EXECUTED')));
  const state=path.join(temp,'patchwrk-consumer-snapshot.json');
  if(phase==='before') {
    await writeFile(state,JSON.stringify(current),{flag:'wx',mode:0o600});
  } else {
    assert.deepEqual(current,JSON.parse(await readFile(state,'utf8')));
    await checkResult(process.env.QUALIFICATION_RESULT,process.env.QUALIFICATION_STATUS,undefined,[root,temp,workspace,producer]);
  }
  console.log(JSON.stringify({phase,automatedChecks:'PASS',checkoutUnchanged:phase==='after',producerCommit:process.env.PRODUCER_COMMIT,consumerCommit:process.env.CONSUMER_COMMIT,node:process.versions.node,summaryAndLogs:'REQUIRE_FOUNDER_REVIEW'}));
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(()=>{console.error('Qualification verification failed; details withheld.');process.exitCode=1;});
}
