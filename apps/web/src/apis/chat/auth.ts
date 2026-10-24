import { useUserStore } from '@/stores/user';
import { refreshTokenApi } from '@/apis/auth';

let pendingRefresh: Promise<string> | null = null;
// AI requests use the same session as the business API, including token renewal.
export async function getChatAccessToken(): Promise<string> {
  const store = useUserStore();
  const token = store.getAccessToken;
  if (!token) throw new Error('请先登录');
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp * 1000 > Date.now() + 30000) return token;
  } catch { /* Let the refresh endpoint validate the session. */ }
  if (!pendingRefresh) {
    const refreshToken = store.getRefreshToken;
    pendingRefresh = refreshTokenApi({ refreshToken }).then(res => {
      if (res.code !== 200 || !res.data?.accessToken || store.getRefreshToken !== refreshToken) throw new Error('登录已过期，请重新登录');
      store.updateToken(res.data);
      return res.data.accessToken;
    }).finally(() => { pendingRefresh = null; });
  }
  return pendingRefresh;
}
