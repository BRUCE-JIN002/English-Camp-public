import { Injectable, OnModuleInit } from '@nestjs/common';
import { AlipaySdk } from 'alipay-sdk';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PayService implements OnModuleInit {
  public alipaySdk: AlipaySdk;
  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const gateway = this.configService.get<string>('ALIPAY_GATEWAY') || 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';
    if (new URL(gateway).origin !== 'https://openapi-sandbox.dl.alipaydev.com') {
      throw new Error('This project only supports Alipay sandbox payments');
    }
    this.alipaySdk = new AlipaySdk({
      appId: this.configService.get<string>('ALIPAY_APP_ID')!,
      privateKey: this.configService.get<string>('ALIPAY_PRIVATE_KEY')!,
      alipayPublicKey: this.configService.get<string>('ALIPAY_PUBLIC_KEY')!,
      gateway,
    });
  }

  getAlipaySdk() {
    return this.alipaySdk;
  }
}
