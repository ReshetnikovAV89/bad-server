import { errors } from 'celebrate'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { json, urlencoded } from 'express'
import mongoose from 'mongoose'
import path from 'path'
import { DB_ADDRESS, ORIGIN_ALLOW, PORT } from './config'
import errorHandler from './middlewares/error-handler'
import serveStatic from './middlewares/serverStatic'
import routes from './routes'

const app = express()

const corsOptions = {
    origin: ORIGIN_ALLOW.split(',').map((origin) => origin.trim()),
    credentials: true,
}

app.use(cookieParser())
app.use(cors(corsOptions))

app.use(serveStatic(path.join(__dirname, 'public')))

app.use(urlencoded({ extended: true }))
app.use(json())

app.options('*', cors(corsOptions))
app.use(routes)
app.use(errors())
app.use(errorHandler)

const bootstrap = async () => {
    await mongoose.connect(DB_ADDRESS)
    await app.listen(PORT)
}

bootstrap().catch(() => {
    process.exit(1)
})
