import { serverApi, type Response } from "..";
import type { ReaultLearn } from "@en/common/learn";
import type { Word } from "@en/common/word";

export const getWordList = (courseId: string) =>
  serverApi.get(`/learn/word/${courseId}`) as Promise<Response<Word[]>>;

export const saveWordsMaster = (wordIds: string[]) =>
  serverApi.post(`/learn/word/master`, { wordIds }) as Promise<
    Response<ReaultLearn>
  >;

export const getCheckInStatus = () =>
  serverApi.get('/learn/checkin/status') as Promise<
    Response<{ checkedIn: boolean }>
  >;

export const doCheckIn = () =>
  serverApi.post('/learn/checkin') as Promise<
    Response<{ dayNumber: number }>
  >;

export const getLearnedWords = (page = 1, pageSize = 20) =>
  serverApi.get('/learn/learned', { params: { page, pageSize } }) as Promise<Response<{ list: Word[]; total: number }>>;
