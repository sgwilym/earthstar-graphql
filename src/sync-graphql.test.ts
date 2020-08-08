import createMockServer from "./mocks/create-mock-server";
import {
  StorageMemory,
  ValidatorEs4,
  generateAuthorKeypair,
  sign,
  Document,
  AuthorKeypair,
} from "earthstar";
import syncGraphql from "./sync-graphql";
import { createSchemaContext } from ".";
import { Context } from "./types";
import query from "./query";
import { SyncMutation } from "./__generated__/sync-mutation";

export const TEST_WORKSPACE_ADDR = "+test.a123";
export const TEST_AUTHOR = generateAuthorKeypair("test") as AuthorKeypair;
export const TEST_SYNC_MUTATION = /* GraphQL */ `
  mutation SyncMutation($workspace: String!, $pubUrl: String!) {
    syncWithPub(workspace: $workspace, pubUrl: $pubUrl, format: GRAPHQL) {
      __typename
      ... on DetailedSyncSuccess {
        pushed {
          ignoredCount
          rejectedCount
          acceptedCount
        }
        pulled {
          ignoredCount
          rejectedCount
          acceptedCount
        }
      }
    }
  }
`;

function setupTestServerContext(): Context {
  const testServerContext = createSchemaContext("MEMORY", {
    workspaceAddresses: [TEST_WORKSPACE_ADDR],
    syncFilters: {
      versionsByAuthors: [TEST_AUTHOR.address],
      pathPrefixes: ["/test"],
    },
  });

  const docs = [
    {
      format: "es.4",
      workspace: TEST_WORKSPACE_ADDR,
      author: TEST_AUTHOR.address,
      path: "/test/1",
      content: "The first test document",
      timestamp: Date.now() * 1000 - 30000,
      signature: "",
    },
    {
      format: "es.4",
      workspace: TEST_WORKSPACE_ADDR,
      author: TEST_AUTHOR.address,
      path: "/test/2",
      content: "The second test document",
      timestamp: Date.now() * 1000 - 20000,
      signature: "",
    },
    {
      format: "es.4",
      workspace: TEST_WORKSPACE_ADDR,
      author: TEST_AUTHOR.address,
      path: "/test/3",
      content: "The third test document",
      timestamp: Date.now() * 1000 - 10000,
      signature: "",
    },
    {
      format: "es.4",
      workspace: TEST_WORKSPACE_ADDR,
      author: TEST_AUTHOR.address,
      path: "/wiki/door",
      content: "The third test document",
      timestamp: Date.now() * 1000 - 20000,
      signature: "",
    },
  ];

  docs.forEach((doc) => {
    testServerContext.workspaces[0].set(TEST_AUTHOR, doc);
  });

  return testServerContext;
}

var testServerContext = setupTestServerContext();
var server = createMockServer(testServerContext);

beforeAll(() => {
  server.listen();
});

beforeEach(() => {
  server = createMockServer(testServerContext);
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
  testServerContext = setupTestServerContext();
});

afterAll(() => {
  server.close();
});

test("Syncs", async () => {
  const ctx = createSchemaContext("MEMORY", {
    workspaceAddresses: [TEST_WORKSPACE_ADDR],
  });

  await query(
    /* GraphQL */ `
      mutation SetMutation(
        $author: AuthorInput!
        $document: NewDocumentInput!
        $workspace: String!
      ) {
        set(author: $author, document: $document, workspace: $workspace) {
          __typename
          ... on DocumentRejectedError {
            reason
          }
        }
      }
    `,
    {
      author: generateAuthorKeypair("test") as AuthorKeypair,
      document: {
        path: "/test/4",
        content: "A local document",
      },
      workspace: TEST_WORKSPACE_ADDR,
    },
    ctx
  );

  const res = await query<SyncMutation>(
    TEST_SYNC_MUTATION,
    {
      workspace: TEST_WORKSPACE_ADDR,
      pubUrl: "https://test.server/graphql",
    },
    ctx
  );

  expect(res.data?.syncWithPub.pulled).toEqual({
    acceptedCount: 4,
    ignoredCount: 0,
    rejectedCount: 0,
  });
  expect(res.data?.syncWithPub.pushed).toEqual({
    acceptedCount: 1,
    ignoredCount: 0,
    rejectedCount: 0,
  });

  const storage = ctx.workspaces[0];

  expect(res.data).toBeDefined();
  expect(storage.documents().length).toBe(5);
  expect(storage.documents().map((doc) => doc.path)).toEqual([
    "/test/1",
    "/test/2",
    "/test/3",
    "/test/4",
    "/wiki/door",
  ]);
  expect(storage.documents({ path: "/test/4" })[0].content).toEqual(
    "A local document"
  );
});

test("Filter Syncs", async () => {
  const storage = new StorageMemory([ValidatorEs4], "+test.a123");
  const author = generateAuthorKeypair("test") as AuthorKeypair;

  [
    {
      format: "es.4",
      workspace: TEST_WORKSPACE_ADDR,
      author: author,
      path: "/test/4",
      content: "A local document",
      timestamp: Date.now() * 1000,
      signature: sign(author, "A local document"),
    },
    {
      format: "es.4",
      workspace: TEST_WORKSPACE_ADDR,
      author: author,
      path: "/memes",
      content: "...",
      timestamp: Date.now() * 1000,
      signature: sign(author, "..."),
    },
    {
      format: "es.4",
      workspace: TEST_WORKSPACE_ADDR,
      author: TEST_AUTHOR,
      path: "/stuff",
      content: "final_final_draft_v2.psd",
      timestamp: Date.now() * 1000,
      signature: sign(author, "final_final_draft_v2.psd"),
    },
  ]
    .map(({ author, ...rest }) => {
      return {
        author,
        doc: rest,
      };
    })
    .forEach(({ author, doc }) => {
      storage.set(author, doc);
    });

  const result = await syncGraphql(storage, "https://test.server/graphql", {
    pathPrefixes: ["/wiki"],
  });

  expect(storage.documents().length).toBe(4);

  const docPaths = storage.documents().map((doc) => doc.path);

  expect(docPaths).toEqual(["/memes", "/stuff", "/test/4", "/wiki/door"]);

  const pubDocPaths = testServerContext.workspaces[0].documents().map((doc) => {
    return doc.path;
  });

  expect(pubDocPaths).toEqual([
    "/stuff",
    "/test/1",
    "/test/2",
    "/test/3",
    "/test/4",
    "/wiki/door",
  ]);
});
