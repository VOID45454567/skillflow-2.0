import { AppConfiguration } from "../types/app";

export const configuration = (): AppConfiguration => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT!),

    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET!,
        accessExpires: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshSecret: process.env.JWT_REFRESH_SECRET!,
        refreshExpires: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT!) || 6379,
        password: process.env.REDIS_PASSWORD!,
    },

    minio: {
        host: process.env.MINIO_ENDPOINT!,
        port: Number(process.env.MINIO_PORT!) || 9000,
        accessKey: process.env.MINIO_ACCESS_KEY!,
        secretKey: process.env.MINIO_SECRET_KEY!,
        useSsl: process.env.MINIO_USE_SSL === 'true',
        bucketName: process.env.MINIO_BUCKET || 'eduplatform',
    },

    mail: {
        host: process.env.MAIL_HOST || 'localhost',
        port: Number(process.env.MAIL_PORT!) || 1025,
        user: process.env.MAIL_USER || '',
        pass: process.env.MAIL_PASSWORD || '',
        from: process.env.MAIL_FROM || 'noreply@eduplatform.com',
        provider: process.env.MAIL_PROVIDER!,
        smtp: process.env.MAIL_SERVER!
    },

    certificate: {
        templatePath: process.env.CERTIFICATE_TEMPLATE_PATH!,
    },

    emailTemplates: {
        path: process.env.EMAIL_TEMPLATES_PATH!,
    },

    twoFactor: {
        appName: process.env.TWO_FA_APP_NAME!,
        codeLength: Number(process.env.TWO_FA_CODE_LENGTH!),
        codeTtl: Number(process.env.TWO_FA_CODE_TTL!),
    },

    passwordReset: {
        tokenTtl: Number(process.env.PASSWORD_RESET_TOKEN_TTL!),
    },

    emailVerification: {
        tokenTtl: Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL),
    },

    streak: {
        freezeCost: Number(process.env.STREAK_FREEZE_COST),
    },


    security: {
        maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS),
        loginBlockTime: Number(process.env.LOGIN_BLOCK_TIME),
    },

    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH!,
    },
    databaseUrl: process.env.DATABASE_URL!,
    host: process.env.HOST!,
    referral: {
        bonusPersent: Number(process.env.REFERRAL_BONUS_PERCENT)
    }

});