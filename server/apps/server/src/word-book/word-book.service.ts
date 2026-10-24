import { WordQuery } from '@en/common/word';
import { PrismaService, ResponseService } from '@libs/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@libs/shared/generated/prisma/client';

@Injectable()
export class WordBookService {
  constructor(
    private readonly responseService: ResponseService,
    private readonly prismaService: PrismaService,
  ) {}

  private toBoolean(str: string | boolean): boolean | undefined {
    return str === 'true' ? true : undefined;
  }

  async findAll(query: WordQuery) {
    const { page = 1, pageSize = 12, word, ...rest } = query;
    const tags = Object.fromEntries(
      Object.entries(rest).map(([key, value]) => [key, this.toBoolean(value)]),
    );

    const where: Prisma.WordBookWhereInput = {
      word: word
        ? {
            contains: word, // 包含 word 字符串,模糊查询
          }
        : undefined,
      ...tags,
    };

    const [total, list] = await Promise.all([
      this.prismaService.wordBook.count({
        where,
      }),
      this.prismaService.wordBook.findMany({
        where,
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: [{ frq: 'desc' }, { id: 'asc' }],
      }),
    ]);

    return this.responseService.success({
      total,
      list,
    });
  }
}
