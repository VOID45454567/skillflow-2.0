import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BannedGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user } = context.switchToHttp().getRequest();

        if (!user) {
            return true;
        }

        const activeBan = await this.prisma.blockInfo.findFirst({
            where: {
                bannedId: user.id,
                appeal: null,
            },
        });

        if (activeBan) {
            throw new ForbiddenException(
                `Ваш аккаунт заблокирован. Причина: ${activeBan.blockReason}. Вы можете подать апелляцию.`,
            );
        }

        return true;
    }
}