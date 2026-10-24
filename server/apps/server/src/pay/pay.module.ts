import { Module } from '@nestjs/common';
import { PayService } from './pay.service';
import { PayController } from './pay.controller';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [SocketModule],
  providers: [PayService],
  controllers: [PayController],
})
export class PayModule {}
