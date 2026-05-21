import { SetMetadata } from "@nestjs/common"
import { Roles as UserRole } from "../../generated/prisma/enums"

export const ROLES_KEY = 'roles'

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles)