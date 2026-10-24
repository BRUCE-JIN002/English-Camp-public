import { serverApi, type Response } from "..";
import type { CreatePayDto, ResultPay } from "@en/common/pay";

export const createPay = (data: CreatePayDto) =>
  serverApi.post("/pay/create", data) as Promise<Response<ResultPay>>;

export const getPayStatus = (courseId: string) =>
  serverApi.get('/pay/status', { params: { courseId } }) as Promise<Response<{ paid: boolean }>>;
