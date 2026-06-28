import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()

const ignoredDirs = new Set([
    '.git',
    'node_modules',
    'dist',
    'coverage',
    'temp',
    'public',
])

const ignoredFiles = new Set(['.env'])

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
            if (ignoredDirs.has(entry.name)) {
                return []
            }

            return walk(fullPath)
        }

        if (ignoredFiles.has(entry.name)) {
            return []
        }

        return [fullPath]
    })
}

const emptyFiles = walk(rootDir).filter((filePath) => {
    const stats = fs.statSync(filePath)
    return stats.isFile() && stats.size === 0
})

if (emptyFiles.length > 0) {
    console.error('Empty files found:\n')
    console.error(
        emptyFiles
            .map((filePath) => path.relative(rootDir, filePath))
            .join('\n')
    )
    process.exit(1)
}

console.log('Empty files check passed')
