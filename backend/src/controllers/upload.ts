import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import { readFile, unlink } from 'fs/promises'
import BadRequestError from '../errors/bad-request-error'

const MIN_IMAGE_SIZE_BYTES = 2 * 1024

async function removeUploadedFile(filePath?: string) {
    if (!filePath) {
        return
    }

    try {
        await unlink(filePath)
    } catch {
        // если файл уже удалён или недоступен — не ломаем обработку ошибки
    }
}

function hasValidImageSignature(buffer: Buffer, mimetype?: string) {
    const isPng =
        mimetype === 'image/png' &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47

    const isJpeg =
        (mimetype === 'image/jpeg' || mimetype === 'image/jpg') &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff

    const isGif =
        mimetype === 'image/gif' &&
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46

    return isPng || isJpeg || isGif
}

export const uploadFile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.file) {
        return next(new BadRequestError('Файл не загружен'))
    }

    try {
        if (req.file.size <= MIN_IMAGE_SIZE_BYTES) {
            await removeUploadedFile(req.file.path)
            return next(new BadRequestError('Размер файла должен быть больше 2KB'))
        }

        const fileBuffer = await readFile(req.file.path)
        if (!hasValidImageSignature(fileBuffer, req.file.mimetype)) {
            await removeUploadedFile(req.file.path)
            return next(new BadRequestError('Некорректное содержимое изображения'))
        }

        const fileName = process.env.UPLOAD_PATH
            ? `/${process.env.UPLOAD_PATH}/${req.file.filename}`
            : `/${req.file?.filename}`
        return res.status(constants.HTTP_STATUS_CREATED).send({
            fileName,
            originalName: req.file?.originalname,
        })
    } catch (error) {
        return next(error)
    }
}

export default {}
