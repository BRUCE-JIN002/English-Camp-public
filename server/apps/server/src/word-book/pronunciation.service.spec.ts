import { Readable } from 'node:stream';
import { PronunciationService } from './pronunciation.service';
import { WordBookController } from './word-book.controller';

const synthesize = jest.fn();
jest.mock('tencentcloud-sdk-nodejs-tts', () => ({ tts: { v20190823: { Client: jest.fn().mockImplementation(() => ({ TextToVoice: synthesize })) } } }));
jest.mock('@libs/shared', () => ({ PrismaService: class {} }));

function fixture() {
  const values = { TENCENT_TTS_SECRET_ID: 'test', TENCENT_TTS_SECRET_KEY: 'test' };
  const config = { get: key => values[key] };
  const prisma = { wordBook: { findFirst: jest.fn().mockResolvedValue({ id: '1' }) } };
  const storage = { getObject: jest.fn().mockRejectedValue({ code: 'NoSuchKey' }), putObject: jest.fn().mockResolvedValue(undefined) };
  const minio = { getBucket: async () => 'test', getClient: () => storage };
  return { service: new PronunciationService(config as any, prisma as any, minio as any), prisma, storage };
}

beforeEach(() => { synthesize.mockReset(); synthesize.mockResolvedValue({ Audio: Buffer.from('mp3-audio').toString('base64') }); });
it('serves cached audio without a paid synthesis', async () => {
  const { service, storage } = fixture();
  storage.getObject.mockResolvedValue(Readable.from([Buffer.from('cached')]));
  expect((await service.audio('hello', 'ip')).toString()).toBe('cached');
  expect(synthesize).not.toHaveBeenCalled();
});
it('coalesces requests and stores the English MP3', async () => {
  const { service, storage } = fixture();
  const result = await Promise.all([service.audio('hello', 'ip'), service.audio('hello', 'ip')]);
  expect(result[0]).toEqual(result[1]);
  expect(synthesize).toHaveBeenCalledTimes(1);
  expect(synthesize).toHaveBeenCalledWith(expect.objectContaining({ Text: 'hello', VoiceType: 501009, Codec: 'mp3' }));
  expect(storage.putObject).toHaveBeenCalledTimes(1);
});
it('rejects arbitrary text and invalid queries before synthesis', async () => {
  const { service, prisma } = fixture();
  await expect(service.audio(['hello'], 'ip')).rejects.toMatchObject({ status: 400 });
  prisma.wordBook.findFirst.mockResolvedValue(null);
  await expect(service.audio('not in dictionary', 'ip')).rejects.toMatchObject({ status: 404 });
  expect(synthesize).not.toHaveBeenCalled();
});
it('does not generate paid audio when storage is unavailable', async () => {
  const { service, storage } = fixture();
  storage.getObject.mockRejectedValue({ code: 'ECONNREFUSED' });
  await expect(service.audio('hello', 'ip')).rejects.toMatchObject({ status: 503 });
  expect(synthesize).not.toHaveBeenCalled();
});
it('cleans up failed generation so retry can succeed', async () => {
  const { service } = fixture();
  synthesize.mockRejectedValueOnce({ code: 'Unavailable' });
  await expect(service.audio('hello', 'ip')).rejects.toMatchObject({ status: 503 });
  expect((await service.audio('hello', 'ip')).toString()).toBe('mp3-audio');
});
it('limits uncached synthesis per client', async () => {
  const { service } = fixture();
  for (let i = 0; i < 30; i++) await service.audio(`word${i}`, 'ip');
  await expect(service.audio('another', 'ip')).rejects.toMatchObject({ status: 429 });
  expect(synthesize).toHaveBeenCalledTimes(30);
});
it.each([
  ['bytes=0-1', 206, '01', 'bytes 0-1/6'],
  ['bytes=3-', 206, '345', 'bytes 3-5/6'],
  ['bytes=-2', 206, '45', 'bytes 4-5/6'],
  ['bytes=10-20', 416, undefined, 'bytes */6'],
])('handles Safari range %s', async (range, status, body, contentRange) => {
  const controller = new WordBookController({} as any, { audio: async () => Buffer.from('012345') } as any);
  const res = { set: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis(), send: jest.fn(), end: jest.fn() };
  await controller.audio('hello', { ip: 'ip', headers: { range } } as any, res as any);
  expect(res.status).toHaveBeenCalledWith(status);
  expect(res.set).toHaveBeenCalledWith('Content-Range', contentRange);
  if (body) expect(res.send).toHaveBeenCalledWith(Buffer.from(body));
  else expect(res.end).toHaveBeenCalled();
});
