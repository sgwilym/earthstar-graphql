/* eslint-disable */
/* This is an autogenerated file. Do not edit this file directly! */
export type PullQuery = {
    syncFilters: {
        pathPrefixes: string[] | null;
        versionsByAuthors: string[] | null;
    };
    workspace: ({
        documents: ((({
            content: string;
            contentHash: string;
            deleteAfter: number | null;
            timestamp: number;
            signature: string;
            path: string;
            format: string;
            author: {
                address: string;
            };
            workspace: {
                address: string;
            };
        })))[];
    }) | null;
};
export type PullQueryVariables = {
    workspaceAddress: string;
    versionsByAuthors: string[] | null;
    pathPrefixes: string[] | null;
};
