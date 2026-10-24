import { Injectable } from '@nestjs/common';
import { PrismaService, ResponseService } from '@libs/shared';
import {
  UvDto,
  PerformanceDto,
  PvDto,
  EventDto,
  ErrorDto,
  UpdateUvDto,
} from '@en/common/tracker';

@Injectable()
export class TrackerService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly responseService: ResponseService,
  ) {}

  private async record(visitorId: string, write: () => Promise<unknown>) {
    const exists = () => this.prismaService.visitor.findUnique({ where: { id: visitorId }, select: { id: true } });
    if (!visitorId || !await exists()) return this.responseService.success(false);
    try {
      await write();
    } catch (error) {
      // Account deletion can commit after the existence check.
      if (error?.code === 'P2003' && !await exists()) return this.responseService.success(false);
      throw error;
    }
    return this.responseService.success(true);
  }

  async uv(body: UvDto) {
    if (!body.userId || !await this.prismaService.user.findUnique({ where: { id: body.userId }, select: { id: true } })) {
      return this.responseService.success(null);
    }
    try {
    const visitor = await this.prismaService.visitor.upsert({
      where: { anonymousId: body.anonymousId },
      create: {
        anonymousId: body.anonymousId,
        userId: body.userId || null,
        browser: body.browser,
        os: body.os,
        device: body.device,
      },
      update: {
        userId: body.userId || null,
        browser: body.browser,
        os: body.os,
        device: body.device,
      },
      select: {
        id: true,
      },
    });
    return this.responseService.success(visitor.id);
    } catch (error) {
      if (error?.code === 'P2003' && body.userId && !await this.prismaService.user.findUnique({ where: { id: body.userId }, select: { id: true } })) {
        return this.responseService.success(null);
      }
      throw error;
    }
  }

  async updateUv(body: UpdateUvDto) {
    return this.record(body.visitorId, () => this.prismaService.visitor.updateMany({
      where: { id: body.visitorId },
      data: {
        userId: body.userId || null,
      },
    }));
  }

  async performance(body: PerformanceDto) {
    return this.record(body.visitorId, () => this.prismaService.performanceEntry.create({
      data: {
        visitorId: body.visitorId,
        fp: body.fp,
        fcp: body.fcp,
        lcp: body.lcp,
        inp: body.inp,
        cls: body.cls,
      },
    }));
  }

  async pv(body: PvDto) {
    return this.record(body.visitorId, () => this.prismaService.pageView.create({
      data: {
        visitorId: body.visitorId,
        url: body.url,
        referrer: body.referrer,
        path: body.path,
      },
    }));
  }

  async event(body: EventDto) {
    return this.record(body.visitorId, () => this.prismaService.trackEvent.create({
      data: {
        visitorId: body.visitorId,
        event: body.event,
        payload: body.payload,
        url: body.url,
      },
    }));
  }

  async error(body: ErrorDto) {
    return this.record(body.visitorId, () => this.prismaService.errorEntry.create({
      data: {
        visitorId: body.visitorId,
        error: body.error,
        message: body.message,
        stack: body.stack,
        url: body.url,
        line: body.line,
        column: body.column,
      },
    }));
  }
}
