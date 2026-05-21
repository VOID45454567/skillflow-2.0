export interface JwtPayload {
    sub: number,
    email: string,
    role: string
}

export interface JwtRefreshPayload {
    sub: number,
    tokenId: string
}