import { applyDecorators, UseGuards } from "@nestjs/common"
import { Roles as UserRole } from "../../generated/prisma/enums"
import { JwtAuthGuard } from "../guards/jwt.auth.guard"
import { RolesGuard } from "../guards/roles.guard"
import { Roles } from "./roles.decorator"

export const Auth = (...roles: UserRole[]) => {
    return applyDecorators(
        UseGuards(JwtAuthGuard),
        ...(roles.length ? [UseGuards(RolesGuard), Roles(...roles)] : [])
    )
}