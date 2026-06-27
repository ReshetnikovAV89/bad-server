import { randomBytes } from 'crypto'

import { CookieOptions } from 'express'
import ms from 'ms'

function requiredEnv(name: string) {
    const value = process.env[name]

    if (!value) {
        throw new Error(`Environment variable ${name} is required`)
    }

    return value
}

function runtimeSecret(name: string) {
    const value = process.env[name]

    if (value) {
        return value
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error(`Environment variable ${name} is required`)
    }

    return randomBytes(32).toString('hex')
}

export const PORT = process.env.PORT || '3000'
export const DB_ADDRESS = requiredEnv('DB_ADDRESS')
export const ORIGIN_ALLOW = requiredEnv('ORIGIN_ALLOW')
export const JWT_SECRET = runtimeSecret('JWT_SECRET')

export const ACCESS_TOKEN = {
    secret: runtimeSecret('AUTH_ACCESS_TOKEN_SECRET'),
    expiry: process.env.AUTH_ACCESS_TOKEN_EXPIRY || '10m',
}

export const REFRESH_TOKEN = {
    secret: runtimeSecret('AUTH_REFRESH_TOKEN_SECRET'),
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
