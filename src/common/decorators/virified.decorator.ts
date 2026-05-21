import { SetMetadata } from '@nestjs/common';

export const REQUIRE_VERIFICATION_KEY = 'requireVerification';
export const RequireVerification = () => SetMetadata(REQUIRE_VERIFICATION_KEY, true);