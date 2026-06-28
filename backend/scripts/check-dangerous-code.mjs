import fs from 'node:fs'
import path from 'node:path'

const rootDir = path.resolve('src')

const forbiddenPatterns = [
    {
        name: 'NoSQL injection через Object.assign(filters, status)',
        regex: /Object\.assign\(filters,\s*status\)/,
    },
    {
        name: 'сырой new RegExp(search)',
        regex: /new RegExp\(search/,
    },
    {
        name: 'сырой Number(limit)',
        regex: /Number\(limit\)/,
    },
    {
        name: 'сырой Number(page)',
        regex: /Number\(page\)/,
    },
    {
        name: 'динамический sort[sortField]',
        regex: /sort\[sortField/,
    },
    {
        name: 'массовое обновление через req.body',
        regex: /find(ById|One)?AndUpdate\([^)]*,\s*req\.body/,
    },
]

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
            return walk(fullPath)
        }

        return fullPath.endsWith('.ts') ? [fullPath] : []
    })
}

const problems = []

for (const filePath of walk(rootDir)) {
    const content = fs.readFileSync(filePath, 'utf8')

    for (const pattern of forbiddenPatterns) {
        if (pattern.regex.test(content)) {
            problems.push(`${filePath}: ${pattern.name}`)
        }
    }
}

if (problems.length > 0) {
    console.error('Dangerous code patterns found:\n')
    console.error(problems.join('\n'))
    process.exit(1)
}

console.log('Dangerous code check passed')
