export interface AppConfiguration {
    nodeEnv: string;
    port: number;
    databaseUrl: string;
    host: string;

    jwt: {
        accessSecret: string;
        accessExpiresIn: string;
        refreshSecret: string;
        refreshExpiresIn: string;
    };

    redis: {
        host: string;
        port: number;
        password: string;
    };

    minio: {
        endpoint: string;
        port: number;
        accessKey: string;
        secretKey: string;
        useSsl: boolean;
        bucket: string;
    };

    mail: {
        host: string;
        port: number;
        user: string;
        password: string;
        from: string;
        provider: string;
        smtp: string;
    };

    certificate: {
        templatePath: string;
    };

    emailTemplates: {
        path: string;
    };

    twoFactor: {
        appName: string;
        codeLength: number;
        codeTtl: number;
    };

    passwordReset: {
        tokenTtl: number;
    };

    emailVerification: {
        tokenTtl: number;
    };

    streak: {
        freezeCost: number;
    };

    security: {
        maxLoginAttempts: number;
        loginBlockTime: number;
    };

    puppeteer: {
        executablePath: string;
    };

    referral: {
        bonusPercent: number;
    };
}