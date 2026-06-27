import { moveSafeFile } from './files'

async function movingFile(imagePath: string, from: string, to: string) {
    await moveSafeFile(imagePath, from, to)
}

export default movingFile
