import type { Request, Response } from 'express';
import { PronunciationService } from './pronunciation.service';
import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { WordBookService } from './word-book.service';
import type { WordQuery } from '@en/common/word';

@Controller('word-book')
export class WordBookController {
  constructor(
    private readonly wordBookService: WordBookService,
    private readonly pronunciation: PronunciationService,
  ) {}

  @Get('pronunciation')
  async audio(@Query('word') word: unknown, @Req() req: Request, @Res() res: Response) {
    const audio = await this.pronunciation.audio(word, req.ip || 'unknown');
    res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=86400', 'Accept-Ranges': 'bytes' });
    // Safari can probe an audio URL with a byte-range request.
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      let start = match?.[1] ? Number(match[1]) : 0;
      let end = match?.[2] ? Number(match[2]) : audio.length - 1;
      if (match && !match[1] && match[2]) { start = Math.max(0, audio.length - Number(match[2])); end = audio.length - 1; }
      if (!match || (!match[1] && !match[2]) || start > end || start >= audio.length || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
        res.status(416).set('Content-Range', `bytes */${audio.length}`).end();
        return;
      }
      end = Math.min(end, audio.length - 1);
      res.status(206).set('Content-Range', `bytes ${start}-${end}/${audio.length}`).send(audio.subarray(start, end + 1));
      return;
    }
    res.send(audio);
  }

  @Get()
  findAll(@Query() query: WordQuery) {
    return this.wordBookService.findAll(query);
  }
}
