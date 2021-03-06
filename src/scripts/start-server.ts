import createSchemaContext from "../create-schema-context";
import fs from "fs";
import path from "path";
import { ApolloServer } from "apollo-server";
import schema from "../schema";
import { printSchema } from "graphql";

export function isDefined<T>(t: T | undefined): t is T {
  return t !== undefined;
}

const workspacesDir = path.resolve("./workspaces/");
const sqliteRegex = /.*\/?(\+.*\.*)\.sqlite/;

if (!fs.existsSync(workspacesDir)) {
  fs.mkdirSync(workspacesDir);
}

const workspaces =
  fs
    .readdirSync(workspacesDir)
    .filter((fileName) => fileName.match(sqliteRegex))
    .map((fileName) => {
      const result = sqliteRegex.exec(fileName);

      if (result) {
        return result[1];
      }

      return undefined;
    })
    .filter(isDefined) || [];

const context = createSchemaContext("SQLITE", {
  workspaceAddresses: workspaces,
  getWorkspacePath: (addr) => path.resolve(`./workspaces/${addr}.sqlite`),
});

const server = new ApolloServer({ schema, context });
server
  .listen({
    port: 4000,
  })
  .then(({ url }) => {
    console.log(`🍄 earthstar-graphql ready at ${url}`);
  });

fs.writeFileSync(path.resolve("./src/schema.graphql"), printSchema(schema));
