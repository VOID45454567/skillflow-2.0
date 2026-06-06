import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    ParseIntPipe,
    UseInterceptors,
    UploadedFile,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrganizationService } from './organization.service';
import {
    CreateOrganizationDto,
    UpdateOrganizationDto,
    JoinOrganizationDto,
    SetMandatoryDto,
    UpdateSubscriptionDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current.user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('organizations')
export class OrganizationController {
    constructor(private readonly organizationService: OrganizationService) { }

    @Post()
    async createOrganization(
        @CurrentUser('id') userId: number,
        @Body() dto: CreateOrganizationDto,
    ) {
        return this.organizationService.createOrganization(userId, dto);
    }

    @Get('my')
    async getMyOrganizations(@CurrentUser('id') userId: number) {
        return this.organizationService.getMyOrganizations(userId);
    }

    @Public()
    @Get(':id')
    async getOrganization(@Param('id', ParseIntPipe) organizationId: number) {
        return this.organizationService.getOrganization(organizationId);
    }

    @Patch(':id')
    async updateOrganization(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
        @Body() dto: UpdateOrganizationDto,
    ) {
        return this.organizationService.updateOrganization(
            userId,
            organizationId,
            dto,
        );
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async deleteOrganization(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
    ) {
        return this.organizationService.deleteOrganization(userId, organizationId);
    }

    @Post(':id/logo')
    @UseInterceptors(FileInterceptor('logo'))
    async uploadLogo(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
        @UploadedFile() file: any,
    ) {
        return this.organizationService.uploadLogo(userId, organizationId, file);
    }

    @Post(':id/invite-code/regenerate')
    @HttpCode(HttpStatus.OK)
    async regenerateInviteCode(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
    ) {
        return this.organizationService.regenerateInviteCode(userId, organizationId);
    }

    @Post('join')
    @HttpCode(HttpStatus.OK)
    async joinByInviteCode(
        @CurrentUser('id') userId: number,
        @Body() dto: JoinOrganizationDto,
    ) {
        return this.organizationService.joinByInviteCode(userId, dto);
    }

    @Post(':id/request')
    @HttpCode(HttpStatus.OK)
    async requestToJoin(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
    ) {
        return this.organizationService.requestToJoin(userId, organizationId);
    }

    @Get(':id/requests')
    async getPendingRequests(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
    ) {
        return this.organizationService.getPendingRequests(userId, organizationId);
    }

    @Post(':id/requests/:requesterId/approve')
    @HttpCode(HttpStatus.OK)
    async approveRequest(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
        @Param('requesterId', ParseIntPipe) requesterId: number,
    ) {
        return this.organizationService.approveRequest(
            userId,
            organizationId,
            requesterId,
        );
    }

    @Post(':id/requests/:requesterId/reject')
    @HttpCode(HttpStatus.OK)
    async rejectRequest(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
        @Param('requesterId', ParseIntPipe) requesterId: number,
    ) {
        return this.organizationService.rejectRequest(
            userId,
            organizationId,
            requesterId,
        );
    }

    @Get(':id/members')
    async getMembers(@Param('id', ParseIntPipe) organizationId: number) {
        return this.organizationService.getMembers(organizationId);
    }

    @Post(':id/members/:memberId/promote')
    @HttpCode(HttpStatus.OK)
    async promoteToAdmin(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
        @Param('memberId', ParseIntPipe) memberId: number,
    ) {
        return this.organizationService.promoteToAdmin(
            userId,
            organizationId,
            memberId,
        );
    }

    @Post(':id/members/:memberId/demote')
    @HttpCode(HttpStatus.OK)
    async demoteFromAdmin(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
        @Param('memberId', ParseIntPipe) memberId: number,
    ) {
        return this.organizationService.demoteFromAdmin(
            userId,
            organizationId,
            memberId,
        );
    }

    @Delete(':id/members/:memberId')
    @HttpCode(HttpStatus.OK)
    async removeMember(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
        @Param('memberId', ParseIntPipe) memberId: number,
    ) {
        return this.organizationService.removeMember(
            userId,
            organizationId,
            memberId,
        );
    }

    @Post(':id/leave')
    @HttpCode(HttpStatus.OK)
    async leaveOrganization(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
    ) {
        return this.organizationService.leaveOrganization(userId, organizationId);
    }

    @Get(':id/courses')
    async getOrganizationCourses(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
    ) {
        return this.organizationService.getOrganizationCourses(
            organizationId,
            userId,
        );
    }

    @Post(':id/courses/mandatory')
    @HttpCode(HttpStatus.OK)
    async setMandatoryCourse(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
        @Body() dto: SetMandatoryDto,
    ) {
        return this.organizationService.setMandatoryCourse(
            userId,
            organizationId,
            dto,
        );
    }

    @Delete(':id/courses/mandatory')
    @HttpCode(HttpStatus.OK)
    async unsetMandatoryCourse(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
        @Body() dto: SetMandatoryDto,
    ) {
        return this.organizationService.unsetMandatoryCourse(
            userId,
            organizationId,
            dto,
        );
    }

    @Get(':id/dashboard')
    async getDashboard(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
    ) {
        return this.organizationService.getDashboard(userId, organizationId);
    }

    @Get(':id/export')
    async exportReport(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
    ) {
        return this.organizationService.exportReport(userId, organizationId);
    }

    @Post(':id/subscription')
    @HttpCode(HttpStatus.OK)
    async createSubscription(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
        @Body() dto: UpdateSubscriptionDto,
    ) {
        return this.organizationService.createSubscription(
            userId,
            organizationId,
            dto,
        );
    }

    @Delete(':id/subscription')
    @HttpCode(HttpStatus.OK)
    async cancelSubscription(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
    ) {
        return this.organizationService.cancelSubscription(userId, organizationId);
    }

    @Get(':id/subscription')
    async getSubscriptionStatus(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) organizationId: number,
    ) {
        return this.organizationService.getSubscriptionStatus(
            userId,
            organizationId,
        );
    }
}