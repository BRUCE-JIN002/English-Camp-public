import { serverApi, type Response } from "..";
import type { WordQuery, WordList } from "@en/common/word";

export const getWordBookList = (
  params: WordQuery,
  signal?: AbortSignal,
): Promise<Response<WordList>> => {
  return serverApi.get("/word-book", { params, signal }) as Promise<Response<WordList>>;
};
