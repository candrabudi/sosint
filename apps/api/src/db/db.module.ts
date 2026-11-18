import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDb } from '@sig/db';

export const DB = Symbol('DB');
const CONN = Symbol('CONN');
type Conn = ReturnType<typeof createDb>;

@Global()
@Module({
  providers: [
    {
      provide: CONN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createDb(config.getOrThrow<string>('DATABASE_URL')),
    },
    { provide: DB, inject: [CONN], useFactory: (conn: Conn) => conn.db },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(CONN) private readonly conn: Conn) {}
  async onApplicationShutdown() {
    await this.conn.pool.end();
  }
}
