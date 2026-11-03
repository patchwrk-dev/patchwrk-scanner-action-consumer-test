/* global process, Buffer, console */
import assert from 'node:assert/strict';
import { lstat, open, readdir, realpath, readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const engine = '8fa08313e65b4d313460936e606d2f3f92979c16';
const files = ['.env','package.json','src/DO_NOT_EXECUTE.js','src/index.ts'];
export async function snapshot(root) {
  assert.equal(await realpath(root), path.resolve(root));
  const dir=await lstat(root);assert.ok(dir.isDirectory() && !dir.isSymbolicLink());
  assert.deepEqual((await readdir(root)).sort(),['.env','package.json','src']);
  const src=await lstat(path.join(root,'src'));assert.ok(src.isDirectory() && !src.isSymbolicLink());
  assert.deepEqual((await readdir(path.join(root,'src'))).sort(),['DO_NOT_EXECUTE.js','index.ts']);
  const hashes={};
  for(const name of files){
    const filename=path.join(root,name),before=await lstat(filename);
    assert.ok(before.isFile() && !before.isSymbolicLink() && before.nlink===1 && before.size<=32768);
    const fd=await open(filename,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    try{
      const info=await fd.stat();assert.ok(info.isFile() && info.nlink===1 && info.ino===before.ino && info.dev===before.dev && info.size===before.size);
      const buffer=Buffer.alloc(32769),read=await fd.read(buffer,0,buffer.length,0),after=await fd.stat();
      assert.equal(read.bytesRead,info.size);assert.equal(after.size,info.size);assert.equal(after.mtimeMs,info.mtimeMs);
      hashes[name]=createHash('sha256').update(buffer.subarray(0,read.bytesRead)).digest('hex');
    } finally{await fd.close();}
  }
  return hashes;
}
export function checkResult(text,status,forbidden=[]) {
  assert.ok(typeof text==='string' && text.length<=100000);assert.equal(status,'complete');
  for(const marker of ['SYNTHETIC_CONSUMER_SENTINEL','DO_NOT_EXECUTE','src/index.ts','::error::',...forbidden])assert.ok(!text.includes(marker));
  const r=JSON.parse(text);assert.deepEqual(Object.keys(r).sort(),['schemaVersion','engineCommit','catalogVersion','status','discoveries','counts','findings','filesScanned','catalogRecords','coverage','limitations'].sort());
  assert.equal(r.schemaVersion,1);assert.equal(r.engineCommit,engine);assert.equal(r.status,'complete');assert.equal(r.catalogRecords,4);
  assert.deepEqual(r.discoveries,{stripe:1,openai:1,anthropic:1,shopify:1,twilio:1});
  assert.deepEqual(r.coverage,{discovery:true,analysis:true,compatibility:true,truncated:false});
  assert.deepEqual(r.counts,{affected:0,'potentially-affected':2,'not-affected-by-this-change':0,unknown:2});
  return r;
}
async function main(){
  assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.versions.node.split('.')[0],'24');
  const phase=process.argv[2];assert.ok(['before','after'].includes(phase));
  const base=await realpath(process.env.GITHUB_WORKSPACE),temp=await realpath(process.env.RUNNER_TEMP),root=path.join(base,'target/fixtures/project');
  assert.ok(temp!==base && !temp.startsWith(base+path.sep));
  for(const folder of [base,temp,root])await assert.rejects(access(path.join(folder,'patchwrk-consumer-EXECUTED')));
  const hashes=await snapshot(root),state=path.join(temp,'patchwrk-consumer-state.json');
  if(phase==='before'){await writeFile(state,JSON.stringify(hashes),{flag:'wx',mode:0o600});console.log('PASS bounded inert fixture snapshot');return;}
  assert.deepEqual(hashes,JSON.parse(await readFile(state,'utf8')));
  const r=checkResult(process.env.CONSUMER_RESULT,process.env.CONSUMER_STATUS,[base]);
  const event=process.env.CONSUMER_EVENT;assert.ok(['push','workflow_dispatch','pull_request'].includes(event));
  for(const sha of [process.env.CONSUMER_TARGET_SHA,process.env.CONSUMER_BASE_SHA])assert.match(sha,/^[a-f0-9]{40}$/);
  if(event==='pull_request')assert.ok(['true','false'].includes(process.env.CONSUMER_FORK));
  console.log(JSON.stringify({consumer:'PASS',actionCommit:'4f7aa523e0bd9038f0d1a6144cbda50b571f25e3',actionRepository:'patchwrk-dev/patchwrk-action',engineCommit:engine,node:process.versions.node,platform:process.platform,arch:process.arch,event,fork:process.env.CONSUMER_FORK==='true',targetCommit:process.env.CONSUMER_TARGET_SHA,trustedBaseCommit:process.env.CONSUMER_BASE_SHA,status:r.status,discoveries:r.discoveries,counts:r.counts,sourceUnchanged:true,canaryNotExecuted:true}));
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){main().catch(()=>{console.error('Consumer verification failed; sensitive fixture/result details withheld.');process.exitCode=1;});}
