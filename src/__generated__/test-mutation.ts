/* eslint-disable */
/* This is an autogenerated file. Do not edit this file directly! */
export type TestMutation = {
    set: (({
        document: (({
            content: string;
        }));
    }));
};
export type TestMutationVariables = {
    author: {
        address: string;
        secret: string;
    };
    document: {
        format: ("ES3") | null;
        content: string;
        path: string;
    };
    workspace: string;
};
