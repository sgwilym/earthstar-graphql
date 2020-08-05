import createMockServer from "./mocks/create-mock-server";
import {
  StorageMemory,
  ValidatorEs3,
  generateAuthorKeypair,
  sign,
  Document,
} from "earthstar";
import syncGraphql from "./sync-graphql";
import { createSchemaContext } from ".";
import { Context } from "./types";

export const TEST_WORKSPACE_ADDR = "+test.123";
export const TEST_AUTHOR = generateAuthorKeypair("test");

function setupTestServerContext(): Context {
  const testServerContext = createSchemaContext("MEMORY", {
    workspaceAddresses: [TEST_WORKSPACE_ADDR],
    syncFilters: {
      versionsByAuthors: [TEST_AUTHOR.address],
      pathPrefixes: ["/test"],
    },
  });

  const docs: Document[] = [
    {
      format: "es.3",
      workspace: TEST_WORKSPACE_ADDR,
      author: TEST_AUTHOR.address,
      path: "/test/1",
      value: "The first test document",
      timestamp: Date.now() * 1000 - 30000,
      signature: "",
    },
    {
      format: "es.3",
      workspace: TEST_WORKSPACE_ADDR,
      author: TEST_AUTHOR.address,
      path: "/test/2",
      value: "The second test document",
      timestamp: Date.now() * 1000 - 20000,
      signature: "",
    },
    {
      format: "es.3",
      workspace: TEST_WORKSPACE_ADDR,
      author: TEST_AUTHOR.address,
      path: "/test/3",
      value: "The third test document",
      timestamp: Date.now() * 1000 - 10000,
      signature: "",
    },
    {
      format: "es.3",
      workspace: TEST_WORKSPACE_ADDR,
      author: TEST_AUTHOR.address,
      path: "/wiki/door",
      value: "The third test document",
      timestamp: Date.now() * 1000 - 20000,
      signature: "",
    },
  ];

  docs.forEach((doc) => {
    const signedDoc = ValidatorEs3.signDocument(TEST_AUTHOR, doc);
    testServerContext.workspaces[0].ingestDocument(signedDoc);
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
  const storage = new StorageMemory([ValidatorEs3], "+test.123");
  const author = generateAuthorKeypair("test");

  const doc = {
    format: "es.3",
    workspace: "+test.123",
    author: author.address,
    path: "/test/4",
    value: "A local document",
    timestamp: Date.now() * 1000,
    signature: sign(author, "A local document"),
  };

  const signedDoc = ValidatorEs3.signDocument(author, doc);
  storage.ingestDocument(signedDoc);

  await syncGraphql(storage, "https://test.server/graphql", {});

  expect(storage.documents().length).toBe(5);
  expect(storage.documents().map((doc) => doc.path)).toEqual([
    "/test/1",
    "/test/2",
    "/test/3",
    "/test/4",
    "/wiki/door",
  ]);
  expect(storage.documents({ path: "/test/4" })[0].value).toEqual(
    "A local document"
  );
  expect(storage.documents({ path: "/test/4" })[0].author).toEqual(
    author.address
  );
});

test("Filter Syncs", async () => {
  const storage = new StorageMemory([ValidatorEs3], "+test.123");
  const author = generateAuthorKeypair("test");

  [
    {
      format: "es.3",
      workspace: "+test.123",
      author: author.address,
      path: "/test/4",
      value: "A local document",
      timestamp: Date.now() * 1000,
      signature: sign(author, "A local document"),
    },
    {
      format: "es.3",
      workspace: "+test.123",
      author: author.address,
      path: "/memes",
      value: "...",
      timestamp: Date.now() * 1000,
      signature: sign(author, "..."),
    },
    {
      format: "es.3",
      workspace: "+test.123",
      author: TEST_AUTHOR.address,
      path: "/stuff",
      value: "final_final_draft_v2.psd",
      timestamp: Date.now() * 1000,
      signature: sign(author, "final_final_draft_v2.psd"),
    },
  ]
    .map((doc) => {
      return ValidatorEs3.signDocument(
        doc.author === author.address ? author : TEST_AUTHOR,
        doc
      );
    })
    .forEach((signedDoc) => {
      storage.ingestDocument(signedDoc);
    });

  await syncGraphql(storage, "https://test.server/graphql", {
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