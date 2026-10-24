import type {
  ResultUser,
  UserRegister,
  UserLogin,
  WebResultUser,
  UserUpdate,
  AvatarResult,
} from "@en/common/user";
import { serverApi, type Response } from "..";

export const register = async (
  data: UserRegister,
): Promise<Response<WebResultUser>> => {
  return serverApi.post("/user/register", data) as Promise<
    Response<WebResultUser>
  >;
};

export const login = async (
  data: UserLogin,
): Promise<Response<WebResultUser>> => {
  return serverApi.post("/user/login", data) as Promise<
    Response<WebResultUser>
  >;
};

//上传头像
export const uploadAvatar = (file: FormData) =>
  serverApi.post("/user/upload-avatar", file) as Promise<
    Response<AvatarResult>
  >;
//更新用户信息
export const updateUser = (data: UserUpdate) =>
  serverApi.post("/user/update-user", data) as Promise<Response<UserUpdate>>;

//同步当前账号资料和学习统计
export const syncUserStats = () =>
  serverApi.get("/user/me") as Promise<
    Response<ResultUser>
  >;

// Only the authenticated account can be deleted.
export const deleteOwnAccount = (confirmation: string) =>
  serverApi.delete("/user/me", { data: { confirmation } }) as Promise<Response<null>>;
