import { AccountDeletionService } from './account-deletion.service';
import {
  Controller,
  Delete,
  Post,
  Get,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserService } from './user.service';
import type {
  Token,
  UserLogin,
  UserRegister,
  UserUpdate,
} from '@en/common/user';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@libs/shared/auth/auth.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService, private readonly accountDeletion: AccountDeletionService) {}

  @UseGuards(AuthGuard)
  @Delete('me')
  deleteAccount(@Req() req: Request, @Body() body: { confirmation?: string }) {
    return this.accountDeletion.deleteAccount(req.user.userId, body?.confirmation);
  }

  @Post('login')
  async login(@Body() userLogin: UserLogin) {
    return this.userService.login(userLogin);
  }

  @Post('register')
  async register(@Body() userRegister: UserRegister) {
    return this.userService.register(userRegister);
  }

  @Post('refresh-token')
  async refreshToken(@Body() payload: Omit<Token, 'accessToken'>) {
    return this.userService.refreshToken(payload);
  }
  @Post('upload-avatar')
  @UseInterceptors(FileInterceptor('file')) // file 是前端表单中文件的字段名
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    return this.userService.uploadAvatar(file);
  }

  // 更新用户信息
  @UseGuards(AuthGuard)
  @Post('update-user')
  updateUser(@Body() userUpdate: UserUpdate, @Req() req: Request) {
    const user = req.user;
    return this.userService.updateUser(userUpdate, user);
  }

  // 获取当前用户统计信息（同步 dayNumber/wordNumber）
  @UseGuards(AuthGuard)
  @Get('me')
  getMe(@Req() req: Request) {
    const userId = req.user.userId;
    return this.userService.getMe(userId);
  }
}
