import { AppConfiguration } from "../types/app";

export const configuration = (): AppConfiguration => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 3000,

    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET!,
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshSecret: process.env.JWT_REFRESH_SECRET!,
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || '',
    },

    minio: {
        endpoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: Number(process.env.MINIO_PORT) || 9000,
        accessKey: process.env.MINIO_ACCESS_KEY!,
        secretKey: process.env.MINIO_SECRET_KEY!,
        useSsl: process.env.MINIO_USE_SSL === 'true',
        bucket: process.env.MINIO_BUCKET || 'eduplatform',
    },

    mail: {
        host: process.env.MAIL_HOST || 'localhost',
        port: Number(process.env.MAIL_PORT) || 1025,
        user: process.env.MAIL_USER || '',
        password: process.env.MAIL_PASSWORD || '',
        from: process.env.MAIL_FROM || 'noreply@eduplatform.com',
        provider: process.env.MAIL_PROVIDER || '',
        smtp: process.env.MAIL_SERVER || '',
    },

    certificate: {
        templatePath: process.env.CERTIFICATE_TEMPLATE_PATH || 'templates/certificate.hbs',
    },

    emailTemplates: {
        path: process.env.EMAIL_TEMPLATES_PATH || 'templates/emails',
    },

    twoFactor: {
        appName: process.env.TWO_FA_APP_NAME || 'SkillFlow',
        codeLength: Number(process.env.TWO_FA_CODE_LENGTH) || 6,
        codeTtl: Number(process.env.TWO_FA_CODE_TTL) || 300,
    },

    passwordReset: {
        tokenTtl: Number(process.env.PASSWORD_RESET_TOKEN_TTL) || 3600,
    },

    emailVerification: {
        tokenTtl: Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL) || 86400,
    },

    streak: {
        freezeCost: Number(process.env.STREAK_FREEZE_COST) || 100,
    },

    security: {
        maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS) || 5,
        loginBlockTime: Number(process.env.LOGIN_BLOCK_TIME) || 900,
    },

    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '',
    },

    databaseUrl: process.env.DATABASE_URL!,
    host: process.env.HOST || 'localhost',

    referral: {
        bonusPercent: Number(process.env.REFERRAL_BONUS_PERCENT) || 10,
    },
});