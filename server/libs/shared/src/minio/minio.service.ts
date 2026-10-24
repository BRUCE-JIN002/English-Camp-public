import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly minioClient: Minio.Client;

  constructor(private readonly configService: ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT')!, //minio地址
      port: Number(this.configService.get('MINIO_PORT')), //minio端口
      useSSL: !!Number(this.configService.get<string>('MINIO_USE_SSL')), //是否使用SSL
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY')!, //minio访问密钥
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY')!, //minio密钥
    });
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  //Nestjs的生命周期 也就是模块初始化时执行
  async onModuleInit() {
    const bucket = this.configService.get<string>('MINIO_BUCKET')!;
    let attempt = 0;
    const maxAttempts = 8;
    let delay = 1000;
    while (attempt < maxAttempts) {
      try {
        const exists = await this.minioClient.bucketExists(bucket);
        if (!exists) {
          await this.minioClient.makeBucket(bucket);
          await this.minioClient.setBucketPolicy(
            bucket,
            JSON.stringify({
              Version: '2012-10-17',
              Statement: [
                {
                  Sid: 'PublicReadObjects',
                  Effect: 'Allow',
                  Principal: '*',
                  Action: ['s3:GetObject'],
                  Resource: [`arn:aws:s3:::${bucket}/*`],
                },
              ],
            }),
          );
        }
        return;
      } catch {
        attempt += 1;
        await this.sleep(Math.min(delay, 30000));
        delay *= 2;
      }
    }
  }
  // 获取客户端
  getClient() {
    return this.minioClient;
  }
  // 获取 minio的桶名 bucket
  async getBucket() {
    return this.configService.get<string>('MINIO_BUCKET')!;
  }
}
