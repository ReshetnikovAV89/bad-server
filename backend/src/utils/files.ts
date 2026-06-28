import { randomUUID } from 'crypto'
import { constants } from 'fs'
import { access, mkdir, rename, unlink } from 'fs/promises'
import { basename, extname, join, relative, resolve } from 'path'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif'])

type FileSystemError = Error & {
    code?: string
}

export function createSafeImageFileName(originalName: string) {
    const extension = extname(originalName).toLowerCase()

    if (!IMAGE_EXTENSIONS.has(extension)) {
        throw new Error('Недопустимое расширение файла')
    }

    return `${randomUUID()}${extension}`
}

export function getSafeFilePath(baseDir: string, fileName: string) {
    const safeFileName = basename(fileName)
    const basePath = resolve(baseDir)
    const filePath = resolve(basePath, safeFileName)
    const relativePath = relative(basePath, filePath)

    if (
        relativePath.startsWith('..') ||
        resolve(relativePath) === relativePath
    ) {
        throw new Error('Недопустимый путь к файлу')
    }

    return filePath
}

export async function moveSafeFile(
    fileName: string,
    fromDir: string,
    toDir: string
) {
    const sourcePath = getSafeFilePath(fromDir, fileName)
    const targetPath = getSafeFilePath(toDir, fileName)

    await access(sourcePath, constants.F_OK)
    await mkdir(toDir, { recursive: true })
    await rename(sourcePath, targetPath)
}

export async function removeSafeFile(baseDir: string, fileName?: string) {
    if (!fileName) {
        return
    }

    const filePath = getSafeFilePath(baseDir, fileName)

    try {
        await unlink(filePath)
    } catch (error) {
        const fileSystemError = error as FileSystemError

        if (fileSystemError.code !== 'ENOENT') {
            throw error
        }
    }
}

export function getPublicPath(...parts: string[]) {
    return join(__dirname, '../public', ...parts)
}
