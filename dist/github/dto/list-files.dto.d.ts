export declare class ListFilesDto {
    owner: string;
    repo: string;
    path?: string;
    branch?: string;
}
export declare class BuildRepoTreeDto {
    owner: string;
    repo: string;
    branch?: string;
    maxDepth?: number;
    excludeDirs?: string[];
}
