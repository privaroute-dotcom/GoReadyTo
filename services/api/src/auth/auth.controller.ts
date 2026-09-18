import { Body, Controller, Headers, Post, Get, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register') register(@Body() body:any) {
    return this.auth.register({ displayName:String(body.displayName||''), email:String(body.email||''), password:String(body.password||''), role:body.role });
  }

  @Post('login') login(@Body() body:any) {
    return this.auth.login(String(body.email||''), String(body.password||''));
  }

  @Get('me') me(@Headers('authorization') authorization?:string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    return this.auth.me(token);
  }

  @Post('logout') logout(@Headers('authorization') authorization?:string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    return this.auth.logout(token);
  }
}
