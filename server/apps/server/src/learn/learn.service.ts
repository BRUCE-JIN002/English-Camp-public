import { PrismaService, ResponseService } from '@libs/shared';
import { Injectable, BadRequestException } from '@nestjs/common';
import * as dayjs from 'dayjs';

@Injectable()
export class LearnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly responseService: ResponseService,
  ) {}

  async getLearnedWords(userId: string, pageInput = '1', sizeInput = '20') {
    const page = Number(pageInput);
    const pageSize = Number(sizeInput);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
        !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 40) {
      throw new BadRequestException('分页参数不正确');
    }
    const where = { userId, isMaster: true };
    const [total, records] = await this.prisma.$transaction([
      this.prisma.wordBookRecord.count({ where }),
      this.prisma.wordBookRecord.findMany({
        where, include: { word: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize, take: pageSize,
      }),
    ]);
    return this.responseService.success({ total, list: records.map(record => record.word) });
  }

  // 获取用户学习的单词列表
  async getWordList(id: string, userId: string) {
    // 先查询用户是否有课程购买记录
    const courseRecord = await this.prisma.courseRecord.findFirst({
      where: {
        courseId: id,
        userId,
        isPurchased: true,
      },
      include: {
        course: true,
      },
    });

    if (!courseRecord) {
      return this.responseService.error(null, '您没有购买该课程');
    }

    const courseType = courseRecord.course.value;
    const wordList = await this.prisma.wordBook.findMany({
      where: {
        [courseType]: true,
        // 只查询用户学习的单词
        wordBookRecords: {
          none: {
            userId,
          },
        },
      },
      skip: 0,
      take: 10,
      orderBy: {
        frq: 'desc',
      },
    });

    console.log('查询单词列表 - courseType:', courseType, 'userId:', userId);
    console.log(
      '返回单词:',
      wordList.map((w) => w.word),
    );
    return this.responseService.success(wordList);
  }

  // 保存用户学习的单词列表
  async saveWordList(wordIds: string[], userId: string) {
    // 1. 查出已经掌握的单词（去重）
    const existing = await this.prisma.wordBookRecord.findMany({
      where: {
        userId,
        wordId: { in: wordIds },
      },
      select: { wordId: true },
    });
    const existingIds = new Set(existing.map((r) => r.wordId));
    const newWordIds = wordIds.filter((id) => !existingIds.has(id));

    // 2. 写入新掌握的单词
    let actualSavedCount = 0;
    if (newWordIds.length > 0) {
      const createResult = await this.prisma.wordBookRecord.createMany({
        data: newWordIds.map((wordId) => ({
          wordId,
          userId,
          isMaster: true,
        })),
      });
      actualSavedCount = createResult.count;
    }

    // 3. 更新单词数量
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        wordNumber: { increment: actualSavedCount },
      },
    });

    // 4. 尝试打卡
    let checkedInToday = false;
    const today = dayjs().startOf('day').toDate();
    try {
      await this.prisma.checkIn.create({
        data: { userId, date: today },
      });
      checkedInToday = true;
      await this.prisma.user.update({
        where: { id: userId },
        data: { dayNumber: { increment: 1 } },
      });
    } catch {
      // 今天已经打过卡了
    }

    // 5. 查询最新统计
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { wordNumber: true, dayNumber: true },
    });

    return this.responseService.success({
      wordNumber: user!.wordNumber,
      dayNumber: user!.dayNumber,
      checkedIn: checkedInToday,
    });
  }

  // 查询今日打卡状态
  async getCheckInStatus(userId: string) {
    const today = dayjs().startOf('day').toDate();
    const record = await this.prisma.checkIn.findUnique({
      where: { userId_date: { userId, date: today } },
    });
    return this.responseService.success({ checkedIn: !!record });
  }

  // 主动打卡
  async checkIn(userId: string) {
    const today = dayjs().startOf('day').toDate();

    try {
      await this.prisma.checkIn.create({
        data: { userId, date: today },
      });
    } catch {
      return this.responseService.error(null, '今天已经打过卡了');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { dayNumber: { increment: 1 } },
    });

    return this.responseService.success({
      dayNumber: user.dayNumber,
    });
  }
}
