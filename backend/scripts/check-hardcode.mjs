import fs from 'node:fs'
import path from 'node:path'

const filesToCheck = ['src/app.ts', 'src/config.ts', '.env.example']

const forbiddenPatterns = [
    {
        name: 'дефолтный JWT_SECRET',
        regex: /JWT_SECRET\s*=\s*['"`]JWT_SECRET['"`]/,
    },
    {
        name: 'дефолтный secret-dev',
        regex: /secret-dev/,
    },
    {
        name: 'слишком долгий token expiry 10y',
        regex: /10y/,
    },
    {
        name: 'открытый cors() без origin',
        regex: /cors\(\)/,
    },
    {
        name: 'локальный MongoDB адрес как дефолт в коде',
        regex: /mongodb:\/\/127\.0\.0\.1/,
    },
]

const problems = []

for (const relativePath of filesToCheck) {
    const filePath = path.resolve(relativePath)

    if (!fs.existsSync(filePath)) {
        continue
    }

    const content = fs.readFileSync(filePath, 'utf8')

    for (const pattern of forbiddenPatterns) {
        if (pattern.regex.test(content)) {
            problems.push(`${relativePath}: ${pattern.name}`)
        }
    }
}

if (problems.length > 0) {
    console.error('Hardcode/security config problems found:\n')
    console.error(problems.join('\n'))
    process.exit(1)
}

console.log('Hardcode check passed')
