import { NextFunction, Request, Response } from 'express'
import { randomBytes, timingSafeEqual } from 'crypto'
import ForbiddenError from '../errors/forbidden-error'
import { ORIGIN_ALLOW } from '../config'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const CSRF_COOKIE_NAME = 'csrfToken'
const CSRF_COMPAT_COOKIE_NAME = '_csrf'

const allowedOrigins = ORIGIN_ALLOW.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

function getRequestOrigin(req: Request) {
    const origin = req.get('origin')

    if (origin) {
        return origin
    }

    const referer = req.get('referer')

    if (!referer) {
        return undefined
    }

    try {
        return new URL(referer).origin
    } catch {
        return undefined
    }
}

function getHeaderToken(req: Request) {
    return (
        req.get('x-csrf-token') ||
        req.get('csrf-token') ||
        req.get('x-xsrf-token')
    )
}

function isSameToken(firstToken: string, secondToken: string) {
    const firstBuffer = Buffer.from(firstToken)
    const secondBuffer = Buffer.from(secondToken)

    return (
        firstBuffer.length === secondBuffer.length &&
        timingSafeEqual(firstBuffer, secondBuffer)
    )
}

export function csrfTokenHandler(_req: Request, res: Response) {
    const csrfToken = randomBytes(32).toString('hex')

    res.cookie(CSRF_COMPAT_COOKIE_NAME, csrfToken, {
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    })

    res.cookie(CSRF_COOKIE_NAME, csrfToken, {
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    })

    res.status(200).json({ csrfToken })
}

export default function csrfGuard(
    req: Request,
    _res: Response,
    next: NextFunction
) {
    if (SAFE_METHODS.has(req.method)) {
        return next()
    }

    const requestOrigin = getRequestOrigin(req)

    if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
        return next(new ForbiddenError('Недопустимый источник запроса'))
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME]
    const headerToken = getHeaderToken(req)

    if (
        !cookieToken ||
        !headerToken ||
        !isSameToken(cookieToken, headerToken)
    ) {
        return next(new ForbiddenError('Недопустимый CSRF токен'))
    }

    return next()
}
