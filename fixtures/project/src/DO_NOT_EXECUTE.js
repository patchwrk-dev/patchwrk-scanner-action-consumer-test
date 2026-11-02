import { writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
writeFileSync(path.join(process.env.RUNNER_TEMP || '.', 'patchwrk-consumer-EXECUTED'), 'bad');
throw Error('INERT SYNTHETIC TARGET MUST NOT EXECUTE');
