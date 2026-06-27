import mongoose, { Document, Query } from 'mongoose'
import { getPublicPath, removeSafeFile } from '../utils/files'

export interface IFile {
    fileName: string
    originalName: string
}

export interface IProduct extends Document {
    title: string
    image: IFile
    category: string
    description: string
    price: number
}

type ProductUpdate = {
    $set?: Partial<IProduct>
}

const cardsSchema = new mongoose.Schema<IProduct>(
    {
        title: {
            type: String,
            unique: true,
            required: [true, 'Поле "title" должно быть заполнено'],
            minlength: [2, 'Минимальная длина поля "title" - 2'],
            maxlength: [30, 'Максимальная длина поля "title" - 30'],
        },
        image: {
            fileName: {
                type: String,
                required: [true, 'Поле "image.fileName" должно быть заполнено'],
            },
            originalName: String,
        },
        category: {
            type: String,
            required: [true, 'Поле "category" должно быть заполнено'],
        },
        description: {
            type: String,
        },
        price: {
            type: Number,
            default: null,
        },
    },
    { versionKey: false }
)

cardsSchema.index({ title: 'text' })

cardsSchema.pre(
    'findOneAndUpdate',
    async function deleteOldImage(this: Query<IProduct | null, IProduct>) {
        const update = this.getUpdate() as ProductUpdate
        const updateImage = update.$set?.image
        const docToUpdate = await this.model.findOne(this.getQuery())

        if (updateImage && docToUpdate?.image?.fileName) {
            await removeSafeFile(
                getPublicPath(process.env.UPLOAD_PATH || ''),
                docToUpdate.image.fileName
            )
        }
    }
)

cardsSchema.post('findOneAndDelete', async (doc: IProduct | null) => {
    if (doc?.image?.fileName) {
        await removeSafeFile(
            getPublicPath(process.env.UPLOAD_PATH || ''),
            doc.image.fileName
        )
    }
})

export default mongoose.model<IProduct>('product', cardsSchema)
