import { MailService } from './mail.service';
import * as mailer from 'nodemailer';
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('SMTP delivery result', () => {
  const sendMail = jest.fn();
  let service: MailService;
  beforeEach(() => {
    sendMail.mockReset();
    (mailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    service = new MailService({ get: () => undefined } as any);
    service.onModuleInit();
  });
  it('propagates TLS connection failures to the job worker', async () => {
    const failure = Object.assign(new Error('TLS handshake disconnected'), { code: 'ESOCKET' });
    sendMail.mockRejectedValue(failure);
    await expect(service.sendEmail('test@example.invalid', 'test', 'test')).rejects.toBe(failure);
  });
  it('returns success only after the transport accepts the message', async () => {
    sendMail.mockResolvedValue({ accepted: ['test@example.invalid'] });
    await expect(service.sendEmail('test@example.invalid', 'test', 'test')).resolves.toBe(true);
  });
});
