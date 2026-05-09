import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GithubService } from './github.service';

@Controller('github')
export class GithubController {
  constructor(private readonly github: GithubService) {}

  @Get('file')
  async fetchFile(
    @Query('owner') owner: string,
    @Query('repo') repo: string,
    @Query('path') path: string,
    @Query('branch') branch?: string,
  ) {
    const content = await this.github.fetchFile(owner, repo, path, branch);
    return { path, lineCount: this.github.getLineCount(content), content };
  }

  @Get('file/range')
  async fetchFileRange(
    @Query('owner') owner: string,
    @Query('repo') repo: string,
    @Query('path') path: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('branch') branch?: string,
  ) {
    const content = await this.github.fetchFile(owner, repo, path, branch);
    const snippet = this.github.getFileRange(content, Number(start), Number(end));
    return { path, startLine: Number(start), endLine: Number(end), snippet };
  }

  @Get('files')
  async listFiles(
    @Query('owner') owner: string,
    @Query('repo') repo: string,
    @Query('path') path?: string,
    @Query('branch') branch?: string,
  ) {
    return this.github.listFiles(owner, repo, path, branch);
  }

  @Get('search')
  async searchCode(
    @Query('owner') owner: string,
    @Query('repo') repo: string,
    @Query('q') query: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.github.searchCode(owner, repo, query, perPage ? Number(perPage) : undefined);
  }

  @Post('tree')
  @HttpCode(HttpStatus.OK)
  async buildTree(
    @Body()
    body: {
      owner: string;
      repo: string;
      branch?: string;
      maxDepth?: number;
      excludeDirs?: string[];
    },
  ) {
    return this.github.buildRepoTree(body);
  }

  @Post('parse-url')
  @HttpCode(HttpStatus.OK)
  parseUrl(@Body('url') url: string) {
    return this.github.parseRepoUrl(url);
  }

  @Get('symbols')
  async extractSymbols(
    @Query('owner') owner: string,
    @Query('repo') repo: string,
    @Query('path') path: string,
    @Query('branch') branch?: string,
  ) {
    return this.github.getFileWithSymbols(owner, repo, path, branch);
  }
}
