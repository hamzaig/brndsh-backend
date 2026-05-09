export class SearchCodeDto {
  owner: string;
  repo: string;
  query: string;
  perPage?: number;
}
