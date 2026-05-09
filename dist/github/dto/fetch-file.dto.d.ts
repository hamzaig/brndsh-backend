export declare class FetchFileDto {
    owner: string;
    repo: string;
    path: string;
    branch?: string;
}
export declare class FetchFileRangeDto {
    owner: string;
    repo: string;
    path: string;
    startLine: number;
    endLine: number;
    branch?: string;
}
