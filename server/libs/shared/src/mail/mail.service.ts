import { Injectable, OnModuleInit } from '@nestjs/common';
import * as mailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService implements OnModuleInit {
  private transporter: mailer.Transporter | null = null;
  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.transporter = mailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: Number(this.configService.get<string>('EMAIL_PORT')),
      secure: !!Number(this.configService.get<string>('EMAIL_USE_SSL')),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });
  }

  /**
   * @param to  接收人邮箱
   * @param subject  邮件主题
   * @param text  邮件内容
   * @returns
   */
  async sendEmail(to: string, subject: string, text: string) {
    // Let BullMQ mark SMTP failures as failed instead of silently completing.
    await this.transporter.sendMail({
      from: this.configService.get<string>('EMAIL_USER'),
      to,
      subject,
      html: text,
    });
    return true;
  }
}
