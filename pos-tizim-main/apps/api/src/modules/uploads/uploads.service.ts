import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { randomBytes } from 'crypto';

const UPLOADS_DIR = join(process.cwd(), 'uploads');
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Detect real image type from file bytes (magic numbers) — client-supplied
// mimetype/filename can be spoofed, so we never trust them for storage decisions.
function detectImageExt(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'png';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'webp';
  return null;
}

@Injectable()
export class UploadsService {
  constructor(private prisma: PrismaService) {}

  async saveImage(file: Express.Multer.File): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('Rasm fayli kerak');
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Faqat JPG, PNG yoki WEBP ruxsat etiladi');
    }
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('Rasm hajmi 5MB dan oshmasligi kerak');
    }

    const ext = detectImageExt(file.buffer);
    if (!ext) {
      throw new BadRequestException('Fayl tarkibi rasm formatiga mos kelmadi');
    }

    if (!existsSync(UPLOADS_DIR)) {
      await mkdir(UPLOADS_DIR, { recursive: true });
    }

    const filename = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
    const filepath = join(UPLOADS_DIR, filename);

    await writeFile(filepath, file.buffer);

    return { url: `/uploads/${filename}` };
  }

  async addProductImage(
    productId: string,
    url: string,
    alt?: string,
    sortOrder?: number,
  ) {
    return this.prisma.productImage.create({
      data: { productId, url, alt, sortOrder: sortOrder ?? 0 },
    });
  }

  async removeProductImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new BadRequestException('Rasm topilmadi');
    await this.prisma.productImage.delete({ where: { id: imageId } });
    return { success: true };
  }

  async getProductImages(productId: string) {
    return this.prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
