import { AccountLockService } from './account/account-lock.service';
import { Global, Module } from '@nestjs/common';
import { SharedService } from './shared.service';
import { PrismaModule } from './prisma/prisma.module';
import { ResponseModule } from './response/response.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MinioModule } from './minio/minio.module';
import { PayModule } from './pay/pay.module';
import { MailModule } from './mail/mail.module';
import { BullModule } from '@nestjs/bullmq';

@Global()
@Module({
  providers: [SharedService, AccountLockService],
  exports: [
    AccountLockService,
    SharedService,
    PrismaModule,
    ResponseModule,
    JwtModule,
    ConfigModule,
    MinioModule,
    PayModule,
    MailModule,
  ],
  imports: [
    PrismaModule,
    ResponseModule,
    MinioModule,
    PayModule,
    MailModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.tts.local', '.env'],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
        },
      }),
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('SECRET_KEY'), // 密钥
        signOptions: { expiresIn: '7d' }, // 过期时间
      }),
    }),
  ],
})
export class SharedModule {}
