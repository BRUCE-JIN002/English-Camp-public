import { BadRequestException, HttpException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@libs/shared';
import { MinioService } from '@libs/shared/minio/minio.service';
import { createHash, randomUUID } from 'node:crypto';
import { tts } from 'tencentcloud-sdk-nodejs-tts';

@Injectable()
export class PronunciationService {
  private readonly logger = new Logger(PronunciationService.name);
  private readonly pending = new Map<string, Promise<Buffer>>();
  private readonly requests = new Map<string, { count: number; until: number }>();
  private readonly client: InstanceType<typeof tts.v20190823.Client> | null;
  private readonly voice: number;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {
    this.voice = Number(config.get('TENCENT_TTS_VOICE_TYPE') || 501009);
    const secretId = config.get<string>('TENCENT_TTS_SECRET_ID');
    const secretKey = config.get<string>('TENCENT_TTS_SECRET_KEY');
    this.client = secretId && secretKey ? new tts.v20190823.Client({
      credential: { secretId, secretKey },
      region: config.get<string>('TENCENT_TTS_REGION') || 'ap-beijing',
      profile: { httpProfile: { endpoint: 'tts.tencentcloudapi.com', reqTimeout: 15 } },
    }) : null;
  }

  private limit(key: string, maximum: number) {
    const now = Date.now();
    for (const [ip, value] of this.requests) if (value.until <= now) this.requests.delete(ip);
    const window = this.requests.get(key) ?? { count: 0, until: now + 60_000 };
    if (window.count >= maximum) throw new HttpException('发音请求较多，请稍后再试', 429);
    window.count++;
    this.requests.set(key, window);
  }

  async audio(input: unknown, ip: string): Promise<Buffer> {
    if (typeof input !== 'string' || !input.trim() || input.length > 120) {
      throw new BadRequestException('请提供有效的单词');
    }
    const word = input.trim();
    // Validate against the dictionary: this public endpoint cannot synthesize arbitrary text.
    const exists = await this.prisma.wordBook.findFirst({ where: { word }, select: { id: true } });
    if (!exists) throw new NotFoundException('未找到该单词');
    const key = `pronunciation/${createHash('sha256').update(JSON.stringify({ word, voice: this.voice, speed: 0, codec: 'mp3', version: 1 })).digest('hex')}.mp3`;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const task = this.loadOrSynthesize(word, key, ip);
    this.pending.set(key, task);
    try { return await task; }
    finally { this.pending.delete(key); }
  }

  private async loadOrSynthesize(word: string, key: string, ip: string): Promise<Buffer> {
    const bucket = await this.minio.getBucket();
    const storage = this.minio.getClient();
    try {
      const stream = await storage.getObject(bucket, key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks);
    } catch (error) {
      if (!['NoSuchKey', 'NotFound'].includes(error?.code)) {
        throw new ServiceUnavailableException('发音缓存暂不可用，请稍后重试');
      }
    }
    if (!this.client) throw new ServiceUnavailableException('发音服务尚未配置');
    if (this.pending.size > 4) throw new HttpException('发音服务繁忙，请稍后重试', 429);
    this.limit(`ip:${ip}`, 30);
    this.limit('global', 120);
    try {
      const result = await this.client.TextToVoice({
        Text: word, SessionId: randomUUID(), VoiceType: this.voice,
        Codec: 'mp3', SampleRate: 16000, Speed: 0,
      });
      const audio = Buffer.from(result.Audio || '', 'base64');
      if (!audio.length) throw new Error('EmptyAudio');
      await storage.putObject(bucket, key, audio, audio.length, { 'Content-Type': 'audio/mpeg' });
      return audio;
    } catch (error) {
      // Do not log provider request bodies, credentials, or signatures.
      this.logger.warn(`TTS unavailable (${error?.code || 'SynthesisOrCacheFailure'})`);
      throw new ServiceUnavailableException('发音生成失败，请稍后重试');
    }
  }
}
