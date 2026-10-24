import { Injectable } from '@nestjs/common';
import { PrismaService } from '@libs/shared';
import { ResponseService } from '@libs/shared';
import { updateUserSelect, userSelect } from './user.select';
import { Config } from '@en/config';
import {
  RefreshTokenPayload,
  Token,
  UserLogin,
  UserRegister,
  UserUpdate,
} from '@en/common/user';
import type { Prisma } from '@libs/shared/generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { MinioService } from '@libs/shared/minio/minio.service';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class UserService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly responseService: ResponseService,
    private readonly authService: AuthService,
    private readonly minioService: MinioService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async login(createUserDto: UserLogin) {
    //phone password
    //1. 检查是手机号是否存在
    const user = await this.prismaService.user.findUnique({
      where: {
        phone: createUserDto.phone, //查询手机号
      },
    });
    if (!user) {
      return this.responseService.error(null, '手机号不存在');
    }
    //2. 检查密码是否正确
    if (user.password !== createUserDto.password) {
      return this.responseService.error(null, '密码不正确');
    }
    //3. 查询用户信息 更新最后登录时间
    const updateUser = await this.prismaService.user.update({
      where: {
        id: user.id, //查询用户ID
      },
      data: {
        lastLoginAt: new Date(), //最后登录时间
      },
      select: userSelect,
    });

    //4. 生成token
    const token = this.authService.generateToken({
      userId: updateUser.id,
      name: updateUser.name,
      email: updateUser.email,
    });

    return this.responseService.success({
      ...updateUser,
      token,
    });
  }

  async register(userRegisterInfo: UserRegister) {
    // name emial phone password
    const data: Prisma.UserCreateInput = {
      name: userRegisterInfo.name,

      phone: userRegisterInfo.phone,
      password: userRegisterInfo.password,
      lastLoginAt: new Date(), // 最后登录时间
    };
    // 1.手机号存在则返回错误 findUnique 返回单个数据, 使用prisma服务查user表
    const user = await this.prismaService.user.findUnique({
      where: {
        phone: userRegisterInfo.phone,
      },
    });
    if (user) {
      return this.responseService.error(null, '手机号已存在');
    }

    // 2.邮箱存在则返回错误，说明重复了
    if (userRegisterInfo.email) {
      const userEmail = await this.prismaService.user.findUnique({
        where: {
          email: userRegisterInfo.email,
        },
      });
      if (userEmail) {
        return this.responseService.error(null, '邮箱已存在');
      }
      // 3.邮箱不存在则添加邮箱
      data.email = userRegisterInfo.email;
    }

    // 4.创建用户 默认会返回所有的值, 包含密码， 所以要排除密码
    const newUser = await this.prismaService.user.create({
      data,
      select: userSelect,
    });

    const token = this.authService.generateToken({
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
    });

    return this.responseService.success({
      ...newUser,
      token,
    });
  }

  async refreshToken(payload: Omit<Token, 'accessToken'>) {
    //1. 验证refreshToken是否有效 verify检查token是否有效 并且返回解码后的数据 sign生成token
    try {
      const decoded = this.jwtService.verify<RefreshTokenPayload>(
        payload.refreshToken,
      );
      //2.为什么增加这么一个判断 accessToken 冒充refreshToken 进行攻击
      if (decoded.tokenType !== 'refresh') {
        return this.responseService.error(null, 'refreshToken已过期或无效');
      }
      const user = await this.prismaService.user.findUnique({
        where: {
          id: decoded.userId, //查询用户ID
        },
      });
      //3.如果查不出来说明userId是伪造的
      if (!user) {
        return this.responseService.error(null, '用户不存在');
      }
      const token = this.authService.generateToken({
        userId: user.id,
        name: user.name,
        email: user.email,
      });
      return this.responseService.success(token);
    } catch (error) {
      return this.responseService.error(error, 'refreshToken已过期或无效');
    }
  }

  //上传头像
  async uploadAvatar(file: Express.Multer.File) {
    if (!file) {
      return this.responseService.error(null, '文件不存在');
    }
    if (file.size > 1024 * 1024 * 5) {
      return this.responseService.error(null, '文件大小不能超过5MB');
    }
    //获取minio客户端
    const client = this.minioService.getClient();
    //获取bucket桶名
    const bucket = await this.minioService.getBucket();
    //资源的名称
    const fileName = `${Date.now()}-${file.originalname}`;
    //上传资源到minio
    await client.putObject(bucket, fileName, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });
    //返回文件url
    const isHttps = !!Number(this.configService.get('MINIO_USE_SSL')); //是否启用SSL
    const baseUrl = isHttps ? 'https' : 'http'; //前缀http
    const port = this.configService.get<string>('MINIO_PORT')!; //端口9000
    const databaseUrl = `/${bucket}/${fileName}`; //数据库url /avatar/1234567890-xiaomansdas.jpg
    const previewUrl = `${baseUrl}://${this.configService.get('MINIO_ENDPOINT')}:${port}${databaseUrl}`;
    // previewUrl may be an absolute storage URL; persist the object path only.
    //databaseUrl->/avatar/1772880108903-default-avatar.jpg
    return this.responseService.success({
      previewUrl,
      databaseUrl,
    });
  }
  // 更新用户信息
  async updateUser(userUpdate: UserUpdate, user: Request['user']) {
    // 修改前查出旧的时间配置
    const oldUser = await this.prismaService.user.findUnique({
      where: { id: user.userId },
      select: { isTimingTask: true, timingTaskTime: true, email: true },
    });

    const timingEnabled = userUpdate.isTimingTask ?? oldUser?.isTimingTask;
    const email = userUpdate.email === undefined ? oldUser?.email : userUpdate.email;
    const time = userUpdate.timingTaskTime === undefined ? oldUser?.timingTaskTime : userUpdate.timingTaskTime;
    if (timingEnabled && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')
      || !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time || ''))) {
      return this.responseService.error(null, '请先填写有效邮箱并选择提醒时间');
    }

    const updatedUser = await this.prismaService.user.update({
      where: {
        id: user.userId,
      },
      data: {
        name: userUpdate.name,
        email: userUpdate.email,
        address: userUpdate.address,
        avatar: userUpdate.avatar,
        bio: userUpdate.bio,
        isTimingTask: userUpdate.isTimingTask,
        timingTaskTime: userUpdate.timingTaskTime,
      },
      select: updateUserSelect,
    });

    // 定时任务时间或开关变了 → 通知 AI 应用重新调度
    const timeChanged = oldUser?.timingTaskTime !== userUpdate.timingTaskTime;
    const switchChanged = oldUser?.isTimingTask !== userUpdate.isTimingTask;
    if (timeChanged || switchChanged) {
      const aiPort = Config.ports.ai;
      const aiBase = this.configService.get<string>('AI_INTERNAL_URL') || `http://localhost:${aiPort}`;
      fetch(`${aiBase.replace(/\/$/, '')}/ai/v1/digest/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          timingTaskTime: userUpdate.timingTaskTime || '',
          isTimingTask: !!userUpdate.isTimingTask,
        }),
      }).catch(() => {});
    }

    return this.responseService.success(updatedUser);
  }

  // 获取当前用户统计信息（页面刷新时同步）
  async getMe(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (!user) {
      return this.responseService.error(null, '用户不存在');
    }
    return this.responseService.success(user);
  }
}
