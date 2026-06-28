import crypto from 'crypto'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../config'

type AccessTokenUser = {
    _id: unknown
    email: string
}

type RefreshTokenUser = {
    _id: unknown
}

export function hashRefreshToken(refreshToken: string) {
    return crypto
        .createHmac('sha256', REFRESH_TOKEN.secret)
        .update(refreshToken)
        .digest('hex')
}

export function createAccessToken(user: AccessTokenUser) {
    const userId = String(user._id)

    return jwt.sign(
        {
            _id: userId,
            email: user.email,
        },
        ACCESS_TOKEN.secret,
        {
            expiresIn: ACCESS_TOKEN.expiry,
            subject: userId,
        }
    )
}

export function createRefreshToken(user: RefreshTokenUser) {
    const userId = String(user._id)

    return jwt.sign(
        {
            _id: userId,
        },
        REFRESH_TOKEN.secret,
        {
            expiresIn: REFRESH_TOKEN.expiry,
            subject: userId,
        }
    )
}

export function verifyRefreshToken(refreshToken: string) {
    return jwt.verify(refreshToken, REFRESH_TOKEN.secret) as JwtPayload
}
