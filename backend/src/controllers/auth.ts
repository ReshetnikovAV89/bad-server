import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import { Error as MongooseError } from 'mongoose'
import { REFRESH_TOKEN } from '../config'
import BadRequestError from '../errors/bad-request-error'
import ConflictError from '../errors/conflict-error'
import NotFoundError from '../errors/not-found-error'
import UnauthorizedError from '../errors/unauthorized-error'
import User from '../models/user'
import { hashRefreshToken, verifyRefreshToken } from '../utils/tokens'

// POST /auth/login
const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body
        const user = await User.findUserByCredentials(email, password)
        const accessToken = user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()
        res.cookie(
            REFRESH_TOKEN.cookie.name,
            refreshToken,
            REFRESH_TOKEN.cookie.options
        )
        return res.json({
            success: true,
            user,
            accessToken,
        })
    } catch (err) {
        return next(err)
    }
}

// POST /auth/register
const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password, name } = req.body
        const newUser = new User({ email, password, name })
        await newUser.save()
        const accessToken = newUser.generateAccessToken()
        const refreshToken = await newUser.generateRefreshToken()

        res.cookie(
            REFRESH_TOKEN.cookie.name,
            refreshToken,
            REFRESH_TOKEN.cookie.options
        )
        return res.status(constants.HTTP_STATUS_CREATED).json({
            success: true,
            user: newUser,
            accessToken,
        })
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Пользователь с таким email уже существует')
            )
        }
        return next(error)
    }
}

// GET /auth/user
const getCurrentUser = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id
        const user = await User.findById(userId).orFail(
            () =>
                new NotFoundError(
                    'Пользователь по заданному id отсутствует в базе'
                )
        )
        res.json({ user, success: true })
    } catch (error) {
        next(error)
    }
}

const getUserByRefreshToken = async (req: Request) => {
    const refreshToken = req.cookies[REFRESH_TOKEN.cookie.name]

    if (!refreshToken) {
        throw new UnauthorizedError('Не валидный токен')
    }

    const decodedRefreshToken = verifyRefreshToken(refreshToken)
    const user = await User.findOne({
        _id: decodedRefreshToken._id,
    }).orFail(() => new UnauthorizedError('Пользователь не найден в базе'))

    return { user, refreshToken }
}

const deleteRefreshTokenInUser = async (req: Request) => {
    const { user, refreshToken } = await getUserByRefreshToken(req)
    const refreshTokenHash = hashRefreshToken(refreshToken)

    user.tokens = user.tokens.filter(
        (tokenObj) => tokenObj.token !== refreshTokenHash
    )

    await user.save()

    return user
}

// Реализация удаления токена из базы может отличаться
// POST /auth/logout
const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await deleteRefreshTokenInUser(req)
        const expireCookieOptions = {
            ...REFRESH_TOKEN.cookie.options,
            maxAge: -1,
        }
        res.cookie(REFRESH_TOKEN.cookie.name, '', expireCookieOptions)
        res.status(200).json({
            success: true,
        })
    } catch (error) {
        next(error)
    }
}

// POST /auth/token
const refreshAccessToken = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userWithRefreshTkn = await deleteRefreshTokenInUser(req)
        const accessToken = await userWithRefreshTkn.generateAccessToken()
        const refreshToken = await userWithRefreshTkn.generateRefreshToken()
        res.cookie(
            REFRESH_TOKEN.cookie.name,
            refreshToken,
            REFRESH_TOKEN.cookie.options
        )
        return res.json({
            success: true,
            user: userWithRefreshTkn,
            accessToken,
        })
    } catch (error) {
        return next(error)
    }
}

const getCurrentUserRoles = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        const user = await User.findById(userId).orFail(
            () =>
                new NotFoundError(
                    'Пользователь по заданному id отсутствует в базе'
                )
        )
        res.status(200).json(user.roles)
    } catch (error) {
        next(error)
    }
}

const updateCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    const { name, email, phone } = req.body
    const updateData: Partial<{
        name: string
        email: string
        phone: string
    }> = {}

    if (name !== undefined) {
        updateData.name = name
    }

    if (email !== undefined) {
        updateData.email = email
    }

    if (phone !== undefined) {
        updateData.phone = phone
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
            new: true,
            runValidators: true,
        }).orFail(
            () =>
                new NotFoundError(
                    'Пользователь по заданному id отсутствует в базе'
                )
        )
        res.status(200).json(updatedUser)
    } catch (error) {
        next(error)
    }
}

export {
    getCurrentUser,
    getCurrentUserRoles,
    login,
    logout,
    refreshAccessToken,
    register,
    updateCurrentUser,
}
