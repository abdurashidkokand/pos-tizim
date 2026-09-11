import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SignupService } from './signup.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@pos/shared';

@ApiTags('Signup')
@Controller('signup')
export class SignupController {
  constructor(private signupService: SignupService) {}

  @ApiOperation({ summary: "Yangi do'kon ro'yxatdan o'tish" })
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  @Post()
  signup(
    @Body()
    body: {
      username: string;
      password: string;
      fullName: string;
      storeName: string;
      phone?: string;
    },
  ) {
    return this.signupService.signup(body);
  }

  @ApiOperation({ summary: 'Onboarding holati' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard)
  @Get('onboarding-status')
  getOnboardingStatus(@CurrentUser() user: AuthUser) {
    return this.signupService.getOnboardingStatus(user.id, user.tenantId!);
  }
}
