export interface AppConfiguration {
    nodeEnv: string,
    host: string,
    port: number,
    databaseUrl: string,
    jwt: {
        accessSecret: string,
        accessExpires: string,
        refreshSecret: string,
        refreshExpires: string,
    }
    redis: {
        host: string,
        port: number,
        password: string
    }

    minio: {
        host: string,
        port: number,
        accessKey: string,
        secretKey: string,
        useSsl: boolean,
        bucketName: string
    }

    mail: {
        host: string,
        port: number,
        provider: string,
        user: string,
        pass: string,
        from: string
        smtp: string
    }

    certificate: {
        templatePath: string,

    }

    emailTemplates: {
        path: string
    }

    twoFactor: {
        appName: string,
        codeLength: number,
        codeTtl: number
    }

    passwordReset: {
        tokenTtl: number
    }

    emailVerification: {
        tokenTtl: number
    }

    streak: {
        freezeCost: number
    }

    referral: {
        bonusPersent: number
    }

    security: {
        maxLoginAttempts: number,
        loginBlockTime: number
    }

    puppeteer: {
        executablePath: string
    }
}