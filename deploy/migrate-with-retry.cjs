const { createRequire } = require('node:module');
const { join } = require('node:path');
const serverRequire = createRequire(join(__dirname, '../server/package.json'));
const { Client } = serverRequire('pg');
const { spawnSync } = require('node:child_process');

const transientCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', '57P03', '53300']);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function probeDatabase(name, connectionString) {
  if (!connectionString) throw Object.assign(new Error('Missing database configuration'), { code: 'CONFIG' });
  const client = new Client({ connectionString, connectionTimeoutMillis: 15000, query_timeout: 15000 });
  try {
    await client.connect();
    await client.query('SELECT 1');
    console.log(`${name}: authenticated connection and SELECT 1 succeeded`);
  } finally {
    await client.end().catch(() => {});
  }
}

function retryableConnection(error) {
  return transientCodes.has(error.code) || /timeout|timed out/i.test(error.message || '');
}

async function run({ probe = probeDatabase, wait = sleep, migrate = () => spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { encoding: 'utf8', timeout: 120000 }), env = process.env } = {}) {
  for (let migrationAttempt = 1; migrationAttempt <= 3; migrationAttempt++) {
    for (let attempt = 1; ; attempt++) {
      try {
        await probe('Business database', env.DATABASE_URL);
        await probe('Chat database', env.AI_DATABASE_URL);
        break;
      } catch (error) {
        // Do not print connection strings, passwords or arbitrary driver messages.
        console.error(`Database preflight ${attempt}/6 failed (${error.code || 'connection timeout'})`);
        if (!retryableConnection(error) || attempt >= 6) return 1;
        await wait(5000);
      }
    }
    console.log(`Prisma migration attempt ${migrationAttempt}/3`);
    const result = migrate();
    const output = (result.stdout || '') + (result.stderr || '');
    process.stdout.write(output);
    if (!result.error && result.status === 0) return 0;
    // A killed/hung migration has an uncertain outcome; never retry it blindly.
    if (result.error || result.signal) {
      console.error('Migration process failed or exceeded 120 seconds; stopping without retry.');
      return 1;
    }
    const codes = [...output.matchAll(/\bP\d{4}\b/g)].map(match => match[0]);
    if (!codes.length || codes.some(code => !['P1001', 'P1002'].includes(code)) || migrationAttempt >= 3) return 1;
    console.error('Database connection unavailable during migration; retrying after 10 seconds.');
    await wait(10000);
  }
  return 1;
}

module.exports = { run, retryableConnection };
if (require.main === module) run().then(code => { process.exitCode = code; }).catch(() => {
  console.error('Unexpected migration runner failure');
  process.exitCode = 1;
});
