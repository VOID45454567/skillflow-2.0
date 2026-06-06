import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto';
import { CurrentUser } from '../common/decorators/current.user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { Express } from 'express'


@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Get('me')
  async getProfile(@CurrentUser('id') userId: number) {
    return this.userService.getProfile(userId);
  }

  @Public()
  @Get(':id')
  async getPublicProfile(@Param('id', ParseIntPipe) userId: number) {
    return this.userService.getPublicProfile(userId);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser('id') userId: number,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(userId, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @CurrentUser('id') userId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.userService.updateAvatar(userId, file);
  }

  @Delete('me/avatar')
  @HttpCode(HttpStatus.OK)
  async deleteAvatar(@CurrentUser('id') userId: number) {
    return this.userService.deleteAvatar(userId);
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: number,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.userService.changePassword(userId, dto);
  }

  @Get('me/heatmap')
  async getHeatmap(
    @CurrentUser('id') userId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.userService.getHeatmap(userId, startDate, endDate);
  }

  @Get('me/certificates')
  async getCertificates(@CurrentUser('id') userId: number) {
    return this.userService.getCertificates(userId);
  }

  @Get('me/achievements')
  async getAchievements(@CurrentUser('id') userId: number) {
    return this.userService.getAchievements(userId);
  }

  @Get('me/wishlist')
  async getWishlist(@CurrentUser('id') userId: number) {
    return this.userService.getWishlist(userId);
  }

  @Post('me/wishlist/:courseId')
  @HttpCode(HttpStatus.OK)
  async addToWishlist(
    @CurrentUser('id') userId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    return this.userService.addToWishlist(userId, courseId);
  }

  @Delete('me/wishlist/:courseId')
  @HttpCode(HttpStatus.OK)
  async removeFromWishlist(
    @CurrentUser('id') userId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    return this.userService.removeFromWishlist(userId, courseId);
  }

  @Get('me/subscriptions')
  async getSubscriptions(@CurrentUser('id') userId: number) {
    return this.userService.getSubscriptions(userId);
  }

  @Get('me/friends')
  async getFriends(@CurrentUser('id') userId: number) {
    return this.userService.getFriends(userId);
  }

  @Get('me/friends/feed')
  async getFriendsFeed(
    @CurrentUser('id') userId: number,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.userService.getFriendsFeed(
      userId,
      parseInt(page) || 1,
      parseInt(limit) || 20,
    );
  }

  @Get('me/friend-requests')
  async getFriendRequests(@CurrentUser('id') userId: number) {
    return this.userService.getFriendRequests(userId);
  }

  @Post('me/friend-requests/:targetId')
  @HttpCode(HttpStatus.OK)
  async sendFriendRequest(
    @CurrentUser('id') userId: number,
    @Param('targetId', ParseIntPipe) targetId: number,
  ) {
    return this.userService.sendFriendRequest(userId, targetId);
  }

  @Post('me/friend-requests/:requestId/accept')
  @HttpCode(HttpStatus.OK)
  async acceptFriendRequest(
    @CurrentUser('id') userId: number,
    @Param('requestId', ParseIntPipe) requestId: number,
  ) {
    return this.userService.acceptFriendRequest(userId, requestId);
  }

  @Post('me/friend-requests/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectFriendRequest(
    @CurrentUser('id') userId: number,
    @Param('requestId', ParseIntPipe) requestId: number,
  ) {
    return this.userService.rejectFriendRequest(userId, requestId);
  }

  @Delete('me/friend-requests/:requestId')
  @HttpCode(HttpStatus.OK)
  async cancelFriendRequest(
    @CurrentUser('id') userId: number,
    @Param('requestId', ParseIntPipe) requestId: number,
  ) {
    return this.userService.cancelFriendRequest(userId, requestId);
  }

  @Delete('me/friends/:friendId')
  @HttpCode(HttpStatus.OK)
  async removeFriend(
    @CurrentUser('id') userId: number,
    @Param('friendId', ParseIntPipe) friendId: number,
  ) {
    return this.userService.removeFriend(userId, friendId);
  }

  @Get('me/notifications')
  async getNotifications(
    @CurrentUser('id') userId: number,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.userService.getNotifications(
      userId,
      parseInt(page) || 1,
      parseInt(limit) || 20,
    );
  }

  @Post('me/notifications/:notificationId/read')
  @HttpCode(HttpStatus.OK)
  async markNotificationRead(
    @CurrentUser('id') userId: number,
    @Param('notificationId', ParseIntPipe) notificationId: number,
  ) {
    return this.userService.markNotificationRead(userId, notificationId);
  }

  @Post('me/notifications/read-all')
  @HttpCode(HttpStatus.OK)
  async markAllNotificationsRead(@CurrentUser('id') userId: number) {
    return this.userService.markAllNotificationsRead(userId);
  }

  @Patch('me/notification-settings')
  async updateNotificationSettings(
    @CurrentUser('id') userId: number,
    @Body() settings: Record<string, boolean>,
  ) {
    return this.userService.updateNotificationSettings(userId, settings);
  }
}