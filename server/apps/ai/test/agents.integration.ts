/** Run against the local AI service: pnpm exec tsx apps/ai/test/agents.integration.ts */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { PrismaClient } from '../../../libs/shared/src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { JwtService } from '@nestjs/jwt';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const jwt = new JwtService({ secret: process.env.SECRET_KEY });
const base = process.env.AGENT_TEST_API || 'http://127.0.0.1:3001/ai/v1';
const ids: string[] = [];
async function main() {
  const users = await Promise.all([0, 1].map(async n => {
    const user = await prisma.user.create({ data: { name: 'Agent integration test', phone: `test-${randomUUID()}`, password: createHash('md5').update(randomUUID()).digest('hex') } });
    ids.push(user.id);
    return { id: user.id, token: jwt.sign({ userId: user.id, tokenType: 'access' }, { expiresIn: '5m' }) };
  }));
  async function request(path: string, method = 'GET', body?: unknown, user = users[0], expected = 200) {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    assert.equal(response.status, expected, `${method} ${path}`);
    return (await response.json()).data;
  }
  assert.equal((await fetch(base + '/prompt/list')).status, 401);
  const defaults = await request('/prompt/list');
  assert.equal(defaults.length, 8);
  assert.ok(defaults.every(agent => agent.accentColor === '#50d8f5'));
  await request('/prompt', 'POST', { name: 'test', icon: '🎓', prompt: 'test', accentColor: '#000000' }, users[0], 400);
  await request('/prompt', 'POST', { name: ' ', icon: '🎓', prompt: 'test' }, users[0], 400);
  await request('/prompt', 'POST', { name: 'test', icon: '🎓', prompt: 'x'.repeat(6001) }, users[0], 400);
  const input = { name: 'Test tutor', icon: '🎓', prompt: 'Reply briefly in English.', accentColor: '#ff79b0' };
  const created = await request('/prompt', 'POST', input, users[0], 201);
  assert.equal(created.prompt, input.prompt);
  assert.equal(created.accentColor, input.accentColor);
  const legacyUpdate = await request(`/prompt/${created.role}`, 'PATCH', { name: input.name, icon: input.icon, prompt: input.prompt });
  assert.equal(legacyUpdate.accentColor, input.accentColor);
  assert.equal((await request('/prompt/list')).length, 9);
  assert.equal((await request('/prompt/list', 'GET', undefined, users[1])).length, 8);
  await request(`/prompt/${created.role}`, 'PATCH', input, users[1], 404);
  await request(`/prompt/${created.role}`, 'DELETE', undefined, users[1], 404);
  await request(`/chat/history?role=${created.role}&userId=${users[0].id}`, 'GET', undefined, users[1], 404);
  const updated = await request(`/prompt/${created.role}`, 'PATCH', { ...input, name: 'Edited tutor', prompt: 'Only respond with AGENT_TEST_OK.' });
  assert.equal(updated.role, created.role);
  assert.equal(updated.prompt, 'Only respond with AGENT_TEST_OK.');
  const normal = await request('/prompt/normal', 'PATCH', { ...input, name: 'My default' });
  assert.equal(normal.isDefault, true);
  assert.equal(normal.accentColor, input.accentColor);
  assert.equal((await request('/prompt/list', 'GET', undefined, users[1]))[0].name, '智能助手');
  await request('/prompt/normal', 'DELETE');
  assert.ok(!(await request('/prompt/list')).some(a => a.role === 'normal'));
  await request('/chat', 'POST', { role: 'normal', userId: users[1].id, content: 'test' }, users[0], 404);
  assert.deepEqual(await request(`/chat/history?role=${created.role}`), []);
  for (const agent of await request('/prompt/list')) await request(`/prompt/${agent.role}`, 'DELETE');
  assert.deepEqual(await request('/prompt/list'), []);
  const replacement = await request('/prompt', 'POST', input, users[0], 201);
  assert.ok(replacement.role !== created.role);
  console.log('PASS: CRUD, default edits/deletion, persistent tombstones, validation, account isolation, history access, deleted-role chat rejection, empty list and recreation');
}
main().finally(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
}).catch(error => { console.error(error); process.exitCode = 1; });
