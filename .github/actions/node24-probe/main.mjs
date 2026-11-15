import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';
assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
assert.equal(process.versions.node.split('.')[0], '24');
assert.doesNotMatch(process.execPath, /[\r\n]/);
await appendFile(process.env.GITHUB_OUTPUT, `node=${process.execPath}\n`);
console.log(JSON.stringify({platform:process.platform,arch:process.arch,node:process.versions.node}));
