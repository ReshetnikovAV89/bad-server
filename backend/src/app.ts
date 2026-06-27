import { errors } from 'celebrate'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { json, urlencoded } from 'express'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'
import path from 'path'
import { DB_ADDRESS, ORIGIN_ALLOW, PORT } from './config'
import errorHandler from './middlewares/error-handler'
import csrfGuard from './middlewares/csrf-guard'
import serveStatic from './middlewares/serverStatic'
import routes from './routes'

const app = express()

app.set('trust proxy', 1)

const corsOptions = {
    origin: ORIGIN_ALLOW.split(',').map((origin) => origin.trim()),
    credentials: true,
}

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
})

app.use(limiter)
app.use(cookieParser())
app.use(cors(corsOptions))
app.use(csrfGuard)

app.use(serveStatic(path.join(__dirname, 'public')))

app.use(urlencoded({ extended: true, limit: '100kb' }))
app.use(json({ limit: '100kb' }))

app.options('*', cors(corsOptions))
app.use(routes)
app.use(errors())
app.use(errorHandler)

const bootstrap = async () => {
    await mongoose.connect(DB_ADDRESS)
    await app.listen(PORT)
}

bootstrap().catch((error: Error) => {
    process.stderr.write(`${error.message}\n`)
    process.exit(1)
})
