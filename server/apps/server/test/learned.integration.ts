/** Run against a local server with DATABASE_URL set to its project database. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../../libs/shared/src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { JwtService } from '@nestjs/jwt';
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const jwt = new JwtService({ secret: process.env.SECRET_KEY });
const base = process.env.LEARNED_TEST_API || 'http://127.0.0.1:3000/api/v1/learn/learned';
const ids: string[] = [];
async function main() {
  const users = [];
  for (let i = 0; i < 2; i++) {
    const user = await db.user.create({ data: { phone: `test-${randomUUID()}`, name: 'Review test', password: randomUUID() } });
    ids.push(user.id); users.push(user);
  }
  const words = await db.wordBook.findMany({ take: 24, orderBy: { id: 'asc' }, select: { id: true } });
  assert.equal(words.length, 24);
  await db.wordBookRecord.createMany({ data: words.map((word, i) => ({ userId: users[0].id, wordId: word.id, isMaster: i < 23 })) });
  const token = (id: string) => jwt.sign({ userId: id, tokenType: 'access' }, { expiresIn: '5m' });
  async function request(query: string, user = users[0]) {
    const res = await fetch(base + query, { headers: { Authorization: `Bearer ${token(user.id)}` } });
    assert.equal(res.status, 200); return (await res.json()).data;
  }
  assert.equal((await fetch(base)).status, 401);
  const pages = await Promise.all([1, 2, 3].map(page => request(`?page=${page}&pageSize=10`)));
  assert.deepEqual(pages.map(p => p.list.length), [10, 10, 3]);
  assert.ok(pages.every(p => p.total === 23));
  assert.equal(new Set(pages.flatMap(p => p.list.map(w => w.id))).size, 23);
  assert.equal((await request('?page=4&pageSize=10')).list.length, 0);
  assert.equal((await request(`?userId=${users[0].id}`, users[1])).total, 0);
  assert.deepEqual((await request('?page=1&pageSize=10')).list, pages[0].list);
  for (const query of ['?page=0', '?pageSize=100', '?page=abc', '?pageSize=1.5']) {
    assert.equal((await fetch(base + query, { headers: { Authorization: `Bearer ${token(users[0].id)}` } })).status, 400);
  }
  const after = await db.user.findUniqueOrThrow({ where: { id: users[0].id } });
  assert.equal(after.wordNumber, users[0].wordNumber);
  assert.equal(await db.wordBookRecord.count({ where: { userId: users[0].id } }), 24);
  console.log('PASS: auth, user isolation, learned-only selection, 10/10/3 groups, stable ordering, pagination validation, unchanged learning totals');
}
main().finally(async () => {
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
}).catch(error => { console.error(error); process.exitCode = 1; });
