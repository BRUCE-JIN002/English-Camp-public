import { io, type Socket } from "socket.io-client";
import { socketUrl } from "@/apis";
import { useUserStore } from "@/stores/user";

let socket: Socket | null = null;

export const useSocket = () => {
  const userStore = useUserStore();

  // 连接 socket 服务器
  const connect = () => {
    const userId = userStore.user?.id;
    if (!userId) return; // 未登录，直接返回
    if (socket) return; // 已连接，直接返回
    socket = io(socketUrl, {
      transports: ["websocket", "polling"], // 优先使用 websocket，失败回退到 polling
      autoConnect: true, // 自动连接
      reconnection: true, // 开启重连
      reconnectionAttempts: 5, // 最大重连次数
      reconnectionDelay: 1000, // 重连延迟时间
      reconnectionDelayMax: 5000, // 最大重连延迟时间
      timeout: 20000, // 连接超时时间
      query: {
        userId,
      },
    });

    // 热更新时，将 socket 实例存储到 hot.data 中，避免重复连接
    // 为了tree-shaking，避免在生产环境中重复连接
    if (import.meta.hot) {
      import.meta.hot.data.socket = socket;
    }
    socket.on("connect", () => {
      console.log("[socket] connected", socket?.id);
    });
    socket.on("connect_error", (err) => {
      console.error("[socket] connect_error", err?.message, err);
    });
    socket.on("error", (err) => {
      console.error("[socket] error", err);
    });
    socket.on("disconnect", (reason) => {
      console.log("[socket] disconnected", reason);
    });
  };

  // 断开连接
  const disconnect = () => {
    if (socket) {
      socket.disconnect(); // 断开连接
      socket.removeAllListeners(); // 移除所有事件监听器
      socket = null; // 清空 socket 实例
      if (import.meta.hot) {
        import.meta.hot.data.socket = null;
      }
    }
  };

  // 获取 socket 实例
  const getSocket = (): Socket | null => {
    if (socket) return socket;
    if (import.meta.hot) {
      socket = import.meta.hot.data.socket;
    }
    return null;
  };

  return {
    connect,
    disconnect,
    getSocket,
  };
};
