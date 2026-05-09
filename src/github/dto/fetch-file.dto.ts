export class FetchFileDto {
  owner: string;
  repo: string;
  path: string;
  branch?: string;
}

export class FetchFileRangeDto {
  owner: string;
  repo: string;
  path: string;
  startLine: number;
  endLine: number;
  branch?: string;
}
