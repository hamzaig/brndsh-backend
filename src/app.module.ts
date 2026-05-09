import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GithubModule } from './github/github.module';
import { SessionModule } from './session/session.module';
import { InvestigatorModule } from './investigator/investigator.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GithubModule,
    SessionModule,
    AuditModule,
    InvestigatorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
