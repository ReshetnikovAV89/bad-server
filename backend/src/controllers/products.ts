import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import { Error as MongooseError } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import ConflictError from '../errors/conflict-error'
import NotFoundError from '../errors/not-found-error'
import Product from '../models/product'
import movingFile from '../utils/movingFile'
import { getPublicPath } from '../utils/files'

const MAX_LIMIT = 10

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

// GET /product
const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page, limit } = req.query
        const currentPage = parsePositiveInteger(
            page,
            1,
            Number.MAX_SAFE_INTEGER
        )
        const pageSize = parsePositiveInteger(limit, 5, MAX_LIMIT)

        const options = {
            skip: (currentPage - 1) * pageSize,
            limit: pageSize,
        }

        const products = await Product.find({}, null, options)
        const totalProducts = await Product.countDocuments({})
        const totalPages = Math.ceil(totalProducts / pageSize)

        return res.send({
            items: products,
            pagination: {
                totalProducts,
                totalPages,
                currentPage,
                pageSize,
            },
        })
    } catch (error) {
        return next(error)
    }
}

// POST /product
const createProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { description, category, price, title, image } = req.body

        // Переносим картинку из временной папки
        if (image) {
            await movingFile(
                image.fileName,
                getPublicPath(process.env.UPLOAD_PATH_TEMP || ''),
                getPublicPath(process.env.UPLOAD_PATH || '')
            )
        }

        const product = await Product.create({
            description,
            image,
            category,
            price,
            title,
        })
        return res.status(constants.HTTP_STATUS_CREATED).send(product)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Товар с таким заголовком уже существует')
            )
        }
        return next(error)
    }
}

// PUT /product
const updateProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { productId } = req.params
        const { image } = req.body

        // Переносим картинку из временной папки
        if (image) {
            await movingFile(
                image.fileName,
                getPublicPath(process.env.UPLOAD_PATH_TEMP || ''),
                getPublicPath(process.env.UPLOAD_PATH || '')
            )
        }

        const { description, category, price, title } = req.body
        const updateData = {
            description,
            category,
            title,
            price: price || null,
            image: image || undefined,
        }

        const product = await Product.findByIdAndUpdate(
            productId,
            { $set: updateData },
            { runValidators: true, new: true }
        ).orFail(() => new NotFoundError('Нет товара по заданному id'))
        return res.send(product)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID товара'))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Товар с таким заголовком уже существует')
            )
        }
        return next(error)
    }
}

// DELETE /product
const deleteProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { productId } = req.params
        const product = await Product.findByIdAndDelete(productId).orFail(
            () => new NotFoundError('Нет товара по заданному id')
        )
        return res.send(product)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID товара'))
        }
        return next(error)
    }
}

export { createProduct, deleteProduct, getProducts, updateProduct }
