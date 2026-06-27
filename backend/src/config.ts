import { CookieOptions } from 'express'
import ms from 'ms'

function requiredEnv(name: string) {
    const value = process.env[name]

    if (!value) {
        throw new Error(`Environment variable ${name} is required`)
    }

    return value
}

export const PORT = process.env.PORT || '3000'
export const DB_ADDRESS = requiredEnv('DB_ADDRESS')
export const ORIGIN_ALLOW = requiredEnv('ORIGIN_ALLOW')
export const JWT_SECRET = requiredEnv('JWT_SECRET')

export const ACCESS_TOKEN = {
    secret: requiredEnv('AUTH_ACCESS_TOKEN_SECRET'),
    expiry: process.env.AUTH_ACCESS_TOKEN_EXPIRY || '10m',
}

export const REFRESH_TOKEN = {
    secret: requiredEnv('AUTH_REFRESH_TOKEN_SECRET'),
    expiry: process.env.AUTH_REFRESH_TOKEN_EXPIRY || '7d',
    cookie: {
        name: 'refreshToken',
        options: {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: ms(process.env.AUTH_REFRESH_TOKEN_EXPIRY || '7d'),
            path: '/',
        } as CookieOptions,
    },
}
