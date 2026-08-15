import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { Roles } from '../common/decorators/roles.decorator';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Dev/local storage for product photos (camera or gallery on the mobile
 * app upload here as multipart/form-data). Swap `diskStorage` for an S3
 * adapter in production — the response contract ({ url }) stays the same
 * so ProductsModule never needs to change.
 */
@Roles('ADMIN')
@Controller('uploads')
export class UploadsController {
  @Post('product-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/products',
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
          return cb(new BadRequestException('Format image non supporté.'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    return { url: `/uploads/products/${file.filename}` };
  }
}
