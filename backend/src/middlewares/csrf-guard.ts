import { NextFunction, Request, Response } from 'express'
import ForbiddenError from '../errors/forbidden-error'
import { ORIGIN_ALLOW } from '../config'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

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

    return next()
}
