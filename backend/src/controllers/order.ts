import { NextFunction, Request, Response } from 'express'
import { FilterQuery, Error as MongooseError, Types } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import escapeRegExp from '../utils/escapeRegExp'
import Order, { IOrder, StatusType } from '../models/order'
import Product, { IProduct } from '../models/product'
import User from '../models/user'

const MAX_LIMIT = 50
const MAX_SEARCH_LENGTH = 80
const ALLOWED_SORT_FIELDS = new Set([
    'createdAt',
    'totalAmount',
    'orderNumber',
    'status',
])

function getQueryString(value: unknown) {
    return typeof value === 'string' ? value : undefined
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

function getStatusFilter(value: unknown) {
    const rawValue = getQueryString(value)
    if (
        !rawValue ||
        !Object.values(StatusType).includes(rawValue as StatusType)
    ) {
        return undefined
    }

    return rawValue
}

// eslint-disable-next-line max-len
// GET /orders?page=2&limit=5&sort=totalAmount&order=desc&orderDateFrom=2024-07-01&orderDateTo=2024-08-01&status=delivering&totalAmountFrom=100&totalAmountTo=1000&search=%2B1

export const getOrders = async (
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
            status,
            totalAmountFrom,
            totalAmountTo,
            orderDateFrom,
            orderDateTo,
            search,
        } = req.query

        const currentPage = parsePositiveInteger(
            page,
            1,
            Number.MAX_SAFE_INTEGER
        )
        const pageSize = parsePositiveInteger(limit, 10, MAX_LIMIT)

        const filters: FilterQuery<Partial<IOrder>> = {}

        const statusFilter = getStatusFilter(status)
        if (statusFilter) {
            filters.status = statusFilter
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

        const orderFromDate = parseDateQuery(orderDateFrom)
        if (orderFromDate) {
            filters.createdAt = {
                ...filters.createdAt,
                $gte: orderFromDate,
            }
        }

        const orderToDate = parseDateQuery(orderDateTo)
        if (orderToDate) {
            orderToDate.setHours(23, 59, 59, 999)
            filters.createdAt = {
                ...filters.createdAt,
                $lte: orderToDate,
            }
        }

        const aggregatePipeline: any[] = [
            { $match: filters },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products',
                    foreignField: '_id',
                    as: 'products',
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            { $unwind: '$customer' },
        ]

        const searchRegex = createSafeSearchRegex(search)
        if (searchRegex) {
            const searchNumber = Number(getQueryString(search))
            const searchConditions: any[] = [{ 'products.title': searchRegex }]

            if (Number.isFinite(searchNumber)) {
                searchConditions.push({ orderNumber: searchNumber })
            }

            aggregatePipeline.push({
                $match: {
                    $or: searchConditions,
                },
            })
        }

        const countPipeline = [...aggregatePipeline, { $count: 'totalOrders' }]

        aggregatePipeline.push(
            { $sort: { [getSortField(sortField)]: getSortOrder(sortOrder) } },
            { $skip: (currentPage - 1) * pageSize },
            { $limit: pageSize }
        )

        const orders = await Order.aggregate(aggregatePipeline)
        const countResult = await Order.aggregate(countPipeline)
        const totalOrders = countResult[0]?.totalOrders ?? 0
        const totalPages = Math.ceil(totalOrders / pageSize)

        res.status(200).json({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage,
                pageSize,
            },
        })
    } catch (error) {
        next(error)
    }
}

export const getOrdersCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id
        const { search, page, limit } = req.query
        const currentPage = parsePositiveInteger(
            page,
            1,
            Number.MAX_SAFE_INTEGER
        )
        const pageSize = parsePositiveInteger(limit, 5, MAX_LIMIT)

        const user = await User.findById(userId)
            .populate({
                path: 'orders',
                populate: [
                    {
                        path: 'products',
                    },
                    {
                        path: 'customer',
                    },
                ],
            })
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )

        let orders = user.orders as unknown as IOrder[]

        const searchRegex = createSafeSearchRegex(search)
        if (searchRegex) {
            const searchNumber = Number(getQueryString(search))
            const products = await Product.find({ title: searchRegex })
            const productIds = products.map((product) => product._id)

            orders = orders.filter((order) => {
                const matchesProductTitle = order.products.some((product) =>
                    productIds.some((id) => id.equals(product._id))
                )
                const matchesOrderNumber =
                    Number.isFinite(searchNumber) &&
                    order.orderNumber === searchNumber

                return matchesOrderNumber || matchesProductTitle
            })
        }

        const totalOrders = orders.length
        const totalPages = Math.ceil(totalOrders / pageSize)
        const skip = (currentPage - 1) * pageSize

        orders = orders.slice(skip, skip + pageSize)

        return res.send({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage,
                pageSize,
            },
        })
    } catch (error) {
        next(error)
    }
}

// Get order by ID
export const getOrderByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const order = await Order.findOne({
            orderNumber: req.params.orderNumber,
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

export const getOrderCurrentUserByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        const order = await Order.findOne({
            orderNumber: req.params.orderNumber,
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        if (!order.customer._id.equals(userId)) {
            // Если нет доступа не возвращаем 403, а отдаем 404
            return next(
                new NotFoundError('Заказ по заданному id отсутствует в базе')
            )
        }
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// POST /product
export const createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const basket: IProduct[] = []
        const products = await Product.find<IProduct>({})
        const userId = res.locals.user._id
        const { address, payment, phone, total, email, items, comment } =
            req.body

        items.forEach((id: Types.ObjectId) => {
            const product = products.find((p) => p._id.equals(id))
            if (!product) {
                throw new BadRequestError(`Товар с id ${id} не найден`)
            }
            if (product.price === null) {
                throw new BadRequestError(`Товар с id ${id} не продается`)
            }
            return basket.push(product)
        })
        const totalBasket = basket.reduce((a, c) => a + c.price, 0)
        if (totalBasket !== total) {
            return next(new BadRequestError('Неверная сумма заказа'))
        }

        const newOrder = new Order({
            totalAmount: total,
            products: items,
            payment,
            phone,
            email,
            comment,
            customer: userId,
            deliveryAddress: address,
        })
        const populateOrder = await newOrder.populate(['customer', 'products'])
        await populateOrder.save()

        return res.status(200).json(populateOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        return next(error)
    }
}

// Update an order
export const updateOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { status } = req.body
        const updatedOrder = await Order.findOneAndUpdate(
            { orderNumber: req.params.orderNumber },
            { status },
            { new: true, runValidators: true }
        )
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(updatedOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// Delete an order
export const deleteOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const deletedOrder = await Order.findByIdAndDelete(req.params.id)
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(deletedOrder)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}
