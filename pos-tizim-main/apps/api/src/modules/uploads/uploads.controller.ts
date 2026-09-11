import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@pos/shared';

@ApiTags('Uploads')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller()
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post('uploads/image')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploadsService.saveImage(file);
  }

  @Post('products/:id/images')
  @Roles(Role.ADMIN, Role.MANAGER)
  addImage(
    @Param('id') productId: string,
    @Body() body: { url: string; alt?: string; sortOrder?: number },
  ) {
    return this.uploadsService.addProductImage(
      productId,
      body.url,
      body.alt,
      body.sortOrder,
    );
  }

  @Delete('products/:productId/images/:imageId')
  @Roles(Role.ADMIN, Role.MANAGER)
  removeImage(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.uploadsService.removeProductImage(productId, imageId);
  }

  @Get('products/:id/images')
  getImages(@Param('id') productId: string) {
    return this.uploadsService.getProductImages(productId);
  }
}
