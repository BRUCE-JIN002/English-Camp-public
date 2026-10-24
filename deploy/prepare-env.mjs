import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('./', import.meta.url));
const composeEnv = `${directory}.env`;
const runtimeEnv = `${directory}runtime.env`;
if (!existsSync(composeEnv)) {
  writeFileSync(composeEnv, `POSTGRES_PASSWORD=${randomBytes(24).toString('hex')}\nMINIO_ROOT_PASSWORD=${randomBytes(24).toString('hex')}\nPUBLIC_BASE_URL=http://localhost:18082\n`, { mode: 0o600 });
}
if (!existsSync(runtimeEnv)) {
  const source = fileURLToPath(new URL('../server/.env', import.meta.url));
  if (!existsSync(source)) throw new Error('Provide server/.env or deploy/runtime.env with model, mail and payment configuration.');
  writeFileSync(runtimeEnv, readFileSync(source), { mode: 0o600 });
}
console.log('Deployment environment files ready; existing files preserved.');
