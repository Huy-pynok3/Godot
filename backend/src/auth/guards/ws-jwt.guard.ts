import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const token = this.extractTokenFromHandshake(client);

    if (!token) {
      throw new WsException('Unauthorized: Token is missing');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'super-secret-default-key-for-dev'),
      });
      // Attach the payload to the client/socket object so gateways can access it
      client['user'] = payload;
    } catch {
      throw new WsException('Unauthorized: Token is invalid or expired');
    }
    return true;
  }

  private extractTokenFromHandshake(client: any): string | undefined {
    // Check if token is in auth payload (socket.io standard)
    if (client.handshake?.auth?.token) {
      return client.handshake.auth.token;
    }
    // Check query params as fallback
    if (client.handshake?.query?.token) {
      return client.handshake.query.token;
    }
    // Check headers as last resort
    const authHeader = client.handshake?.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
       return authHeader.split(' ')[1];
    }
    return undefined;
  }
}
