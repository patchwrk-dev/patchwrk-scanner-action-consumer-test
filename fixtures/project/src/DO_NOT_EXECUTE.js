require('node:fs').writeFileSync(require('node:path').join(process.env.RUNNER_TEMP || '.', 'patchwrk-EXECUTED'), 'bad');
throw Error('SYNTHETIC MUST NOT EXECUTE');
