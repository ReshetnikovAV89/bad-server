import { NextFunction, Request, Response } from 'express'
import { FilterQuery } from 'mongoose'
import NotFoundError from '../errors/not-found-error'
import escapeRegExp from '../utils/escapeRegExp'
import Order from '../models/order'
import User, { IUser } from '../models/user'

const MAX_LIMIT = 10
const MAX_SEARCH_LENGTH = 80
const ALLOWED_SORT_FIELDS = new Set([
    'createdAt',
    'lastOrderDate',
    'totalAmount',
    'orderCount',
    'name',
])

function getQueryString(value: unknown) {
    if (value === undefined) {
        return undefined
    }

    if (typeof value !== 'string') {
        throw new BadRequestError('Некорректный формат query-параметра')
    }

    return value
}

function parsePositiveInteger(
    value: unknown,
    defaultValue: number,
    maxValue: number
) {
    const parsed = Number(getQueryString(value) ?? defaultValue)
    if (!Number.isInteger(parsed) || parsed < 1) {
        return defaultValue
    }
    return Math.min(parsed, maxValue)
}

function parseNumberQuery(value: unknown) {
    const rawValue = getQueryString(value)
    if (!rawValue) {
        return undefined
    }

    const parsed = Number(rawValue)
    return Number.isFinite(parsed) ? parsed : undefined
}

function parseDateQuery(value: unknown) {
    const rawValue = getQueryString(value)
    if (!rawValue) {
        return undefined
    }

    const parsed = new Date(rawValue)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function createSafeSearchRegex(value: unknown) {
    const rawValue = getQueryString(value)?.trim()
    if (!rawValue || rawValue.length > MAX_SEARCH_LENGTH) {
        return undefined
    }

    return new RegExp(escapeRegExp(rawValue), 'i')
}

function getSortField(value: unknown) {
    const rawValue = getQueryString(value)
    return rawValue && ALLOWED_SORT_FIELDS.has(rawValue)
        ? rawValue
        : 'createdAt'
}

function getSortOrder(value: unknown) {
    return getQueryString(value) === 'asc' ? 1 : -1
}

// eslint-disable-next-line max-len
// Get GET /customers?page=2&limit=5&sort=totalAmount&order=desc&registrationDateFrom=2023-01-01&registrationDateTo=2023-12-31&lastOrderDateFrom=2023-01-01&lastOrderDateTo=2023-12-31&totalAmountFrom=100&totalAmountTo=1000&orderCountFrom=1&orderCountTo=10
export const getCustomers = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            page,
            limit,
            sortField,
            sortOrder,
            registrationDateFrom,
            registrationDateTo,
            lastOrderDateFrom,
            lastOrderDateTo,
            totalAmountFrom,
            totalAmountTo,
            orderCountFrom,
            orderCountTo,
            search,
        } = req.query

        const currentPage = parsePositiveInteger(
            page,
            1,
            Number.MAX_SAFE_INTEGER
        )
        const pageSize = parsePositiveInteger(limit, 10, MAX_LIMIT)

        const filters: FilterQuery<Partial<IUser>> = {}

        const registrationFromDate = parseDateQuery(registrationDateFrom)
        if (registrationFromDate) {
            filters.createdAt = {
                ...filters.createdAt,
                $gte: registrationFromDate,
            }
        }

        const registrationToDate = parseDateQuery(registrationDateTo)
        if (registrationToDate) {
            registrationToDate.setHours(23, 59, 59, 999)
            filters.createdAt = {
                ...filters.createdAt,
                $lte: registrationToDate,
            }
        }

        const lastOrderFromDate = parseDateQuery(lastOrderDateFrom)
        if (lastOrderFromDate) {
            filters.lastOrderDate = {
                ...filters.lastOrderDate,
                $gte: lastOrderFromDate,
            }
        }

        const lastOrderToDate = parseDateQuery(lastOrderDateTo)
        if (lastOrderToDate) {
            lastOrderToDate.setHours(23, 59, 59, 999)
            filters.lastOrderDate = {
                ...filters.lastOrderDate,
                $lte: lastOrderToDate,
            }
        }

        const minTotalAmount = parseNumberQuery(totalAmountFrom)
        if (minTotalAmount !== undefined) {
            filters.totalAmount = {
                ...filters.totalAmount,
                $gte: minTotalAmount,
            }
        }

        const maxTotalAmount = parseNumberQuery(totalAmountTo)
        if (maxTotalAmount !== undefined) {
            filters.totalAmount = {
                ...filters.totalAmount,
                $lte: maxTotalAmount,
            }
        }

        const minOrderCount = parseNumberQuery(orderCountFrom)
        if (minOrderCount !== undefined) {
            filters.orderCount = {
                ...filters.orderCount,
                $gte: minOrderCount,
            }
        }

        const maxOrderCount = parseNumberQuery(orderCountTo)
        if (maxOrderCount !== undefined) {
            filters.orderCount = {
                ...filters.orderCount,
                $lte: maxOrderCount,
            }
        }

        const searchRegex = createSafeSearchRegex(search)
        if (searchRegex) {
            const orders = await Order.find(
                {
                    $or: [{ deliveryAddress: searchRegex }],
                },
                '_id'
            )

            const orderIds = orders.map((order) => order._id)

            filters.$or = [
                { name: searchRegex },
                { lastOrder: { $in: orderIds } },
            ]
        }

        const sort = {
            [getSortField(sortField)]: getSortOrder(sortOrder),
        }

        const options = {
            sort,
            skip: (currentPage - 1) * pageSize,
            limit: pageSize,
        }

        const users = await User.find(filters, null, options).populate([
            'orders',
            {
                path: 'lastOrder',
                populate: {
                    path: 'products',
                },
            },
            {
                path: 'lastOrder',
                populate: {
                    path: 'customer',
                },
            },
        ])

        const totalUsers = await User.countDocuments(filters)
        const totalPages = Math.ceil(totalUsers / pageSize)

        res.status(200).json({
            customers: users,
            pagination: {
                totalUsers,
                totalPages,
                currentPage,
                pageSize,
            },
        })
    } catch (error) {
        next(error)
    }
}

// Get /customers/:id
export const getCustomerById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const user = await User.findById(req.params.id).populate([
            'orders',
            'lastOrder',
        ])
        res.status(200).json(user)
    } catch (error) {
        next(error)
    }
}

// Patch /customers/:id
export const updateCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
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
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            {
                new: true,
                runValidators: true,
            }
        )
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )
            .populate(['orders', 'lastOrder'])
        res.status(200).json(updatedUser)
    } catch (error) {
        next(error)
    }
}

// Delete /customers/:id
export const deleteCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id).orFail(
            () =>
                new NotFoundError(
                    'Пользователь по заданному id отсутствует в базе'
                )
        )
        res.status(200).json(deletedUser)
    } catch (error) {
        next(error)
    }
}
