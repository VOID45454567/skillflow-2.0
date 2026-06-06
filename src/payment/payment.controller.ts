import {
    Controller,
    Get,
    Post,
    Body,
    Query,
    Param,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, CreateWithdrawalDto } from './dto';
import { CurrentUser } from '../common/decorators/current.user.decorator';

@Controller('payments')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) { }

    @Get('balance')
    async getBalance(@CurrentUser('id') userId: number) {
        return this.paymentService.getBalance(userId);
    }

    @Post('top-up')
    @HttpCode(HttpStatus.OK)
    async createPayment(
        @CurrentUser('id') userId: number,
        @Body() dto: CreatePaymentDto,
    ) {
        return this.paymentService.createPayment(userId, dto);
    }

    @Get('transactions')
    async getTransactions(
        @CurrentUser('id') userId: number,
        @Query('page') page: string,
        @Query('limit') limit: string,
    ) {
        return this.paymentService.getTransactions(
            userId,
            parseInt(page) || 1,
            parseInt(limit) || 20,
        );
    }

    @Get('history')
    async getPaymentHistory(
        @CurrentUser('id') userId: number,
        @Query('page') page: string,
        @Query('limit') limit: string,
    ) {
        return this.paymentService.getPaymentHistory(
            userId,
            parseInt(page) || 1,
            parseInt(limit) || 20,
        );
    }

    @Post('refund/:courseId')
    @HttpCode(HttpStatus.OK)
    async requestRefund(
        @CurrentUser('id') userId: number,
        @Param('courseId', ParseIntPipe) courseId: number,
    ) {
        return this.paymentService.requestRefund(userId, courseId);
    }

    @Post('withdraw')
    @HttpCode(HttpStatus.OK)
    async createWithdrawal(
        @CurrentUser('id') userId: number,
        @Body() dto: CreateWithdrawalDto,
    ) {
        return this.paymentService.createWithdrawal(userId, dto);
    }

    @Get('withdrawals')
    async getWithdrawals(@CurrentUser('id') userId: number) {
        return this.paymentService.getWithdrawals(userId);
    }

    @Get('referrals/info')
    async getReferralInfo(@CurrentUser('id') userId: number) {
        return this.paymentService.getReferralInfo(userId);
    }

    @Get('referrals/history')
    async getReferralHistory(
        @CurrentUser('id') userId: number,
        @Query('page') page: string,
        @Query('limit') limit: string,
    ) {
        return this.paymentService.getReferralHistory(
            userId,
            parseInt(page) || 1,
            parseInt(limit) || 20,
        );
    }
}