import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import {
    ModerateUserDto,
    ProcessReportDto,
    ProcessAppealDto,
    ProcessWithdrawalDto,
    CreateTermDto,
} from './dto';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser } from '../common/decorators/current.user.decorator';
import { ReportStatus } from '../generated/prisma/enums';

@Controller('admin')
@Auth('ADMIN')
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('stats')
    async getStats() {
        return this.adminService.getStats();
    }

    @Get('users')
    async getUsers(
        @Query('page') page: string,
        @Query('limit') limit: string,
        @Query('filter') filter: string,
    ) {
        return this.adminService.getUsers(
            parseInt(page) || 1,
            parseInt(limit) || 20,
            filter,
        );
    }

    @Get('users/:id')
    async getUserDetails(@Param('id', ParseIntPipe) userId: number) {
        return this.adminService.getUserDetails(userId);
    }

    @Post('users/:id/verify')
    @HttpCode(HttpStatus.OK)
    async verifyUser(
        @CurrentUser('id') adminId: number,
        @Param('id', ParseIntPipe) targetUserId: number,
    ) {
        return this.adminService.verifyUser(adminId, targetUserId);
    }

    @Post('users/:id/reject-verification')
    @HttpCode(HttpStatus.OK)
    async rejectVerification(
        @CurrentUser('id') adminId: number,
        @Param('id', ParseIntPipe) targetUserId: number,
        @Body() dto: ModerateUserDto,
    ) {
        return this.adminService.rejectVerification(adminId, targetUserId, dto);
    }

    @Post('users/:id/ban')
    @HttpCode(HttpStatus.OK)
    async banUser(
        @CurrentUser('id') adminId: number,
        @Param('id', ParseIntPipe) targetUserId: number,
        @Body() dto: ModerateUserDto,
    ) {
        return this.adminService.banUser(adminId, targetUserId, dto);
    }

    @Post('users/:id/unban')
    @HttpCode(HttpStatus.OK)
    async unbanUser(
        @CurrentUser('id') adminId: number,
        @Param('id', ParseIntPipe) targetUserId: number,
    ) {
        return this.adminService.unbanUser(adminId, targetUserId);
    }

    @Get('history')
    async getAdminHistory(
        @CurrentUser('id') adminId: number,
        @Query('page') page: string,
        @Query('limit') limit: string,
    ) {
        return this.adminService.getAdminHistory(
            adminId,
            parseInt(page) || 1,
            parseInt(limit) || 50,
        );
    }

    @Get('reports')
    async getReports(
        @Query('page') page: string,
        @Query('limit') limit: string,
        @Query('status') status: ReportStatus,
    ) {
        return this.adminService.getReports(
            parseInt(page) || 1,
            parseInt(limit) || 20,
            status,
        );
    }

    @Get('reports/:id')
    async getReportDetails(@Param('id', ParseIntPipe) reportId: number) {
        return this.adminService.getReportDetails(reportId);
    }

    @Post('reports/:id/process')
    @HttpCode(HttpStatus.OK)
    async processReport(
        @CurrentUser('id') adminId: number,
        @Param('id', ParseIntPipe) reportId: number,
        @Body() dto: ProcessReportDto,
    ) {
        return this.adminService.processReport(adminId, reportId, dto);
    }

    @Post('reports/:id/reject')
    @HttpCode(HttpStatus.OK)
    async rejectReport(
        @CurrentUser('id') adminId: number,
        @Param('id', ParseIntPipe) reportId: number,
    ) {
        return this.adminService.rejectReport(adminId, reportId);
    }

    @Get('appeals')
    async getAppeals(
        @Query('page') page: string,
        @Query('limit') limit: string,
    ) {
        return this.adminService.getAppeals(
            parseInt(page) || 1,
            parseInt(limit) || 20,
        );
    }

    @Post('appeals/:id/approve')
    @HttpCode(HttpStatus.OK)
    async processAppeal(
        @CurrentUser('id') adminId: number,
        @Param('id', ParseIntPipe) appealId: number,
        @Body() dto: ProcessAppealDto,
    ) {
        return this.adminService.processAppeal(adminId, appealId, dto);
    }

    @Post('appeals/:id/reject')
    @HttpCode(HttpStatus.OK)
    async rejectAppeal(
        @CurrentUser('id') adminId: number,
        @Param('id', ParseIntPipe) appealId: number,
        @Body() dto: ProcessAppealDto,
    ) {
        return this.adminService.rejectAppeal(adminId, appealId, dto);
    }

    @Get('withdrawals')
    async getWithdrawals(
        @Query('page') page: string,
        @Query('limit') limit: string,
    ) {
        return this.adminService.getWithdrawals(
            parseInt(page) || 1,
            parseInt(limit) || 20,
        );
    }

    @Post('withdrawals/:id/process')
    @HttpCode(HttpStatus.OK)
    async processWithdrawal(
        @CurrentUser('id') adminId: number,
        @Param('id', ParseIntPipe) withdrawalId: number,
        @Body() dto: ProcessWithdrawalDto,
    ) {
        return this.adminService.processWithdrawal(adminId, withdrawalId, dto);
    }

    @Post('terms/create')
    @HttpCode(HttpStatus.OK)
    async createTerm(@Body() dto: CreateTermDto) {
        return this.adminService.createTerm(dto)
    }
}