import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserVerificationStatuses } from "@prisma/client";
import { REQUIRE_VERIFICATION_KEY } from "../decorators/virified.decorator";

@Injectable()
export class VerifiedGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requireVerification = this.reflector.getAllAndOverride<boolean>(
            REQUIRE_VERIFICATION_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!requireVerification) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();

        if (!user) {
            return true;
        }

        if (user.verificationStatus !== UserVerificationStatuses.VERIFIED) {
            throw new ForbiddenException(
                'Требуется подтвержденный аккаунт. Пройдите верификацию.',
            );
        }

        return true;
    }
}