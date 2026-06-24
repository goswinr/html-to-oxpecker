import common from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { rollup } from "rollup";

const serverEntry = `import { createRequest } from "solid-start/node/fetch.js";
import "solid-start/node/globals.js";
import manifest from "../../dist/public/route-manifest.json";
import handler from "./entry-server.js";

const MAX_REDIRECTS = 10;

async function handleRequest(req) {
  req.headers = {};
  req.method = "GET";
  const webRes = await handler({
    request: createRequest(req),
    env: { manifest },
  });
  return webRes;
}

export default async (req) => {
  let webRes = await handleRequest(req);
  if (webRes.status === 200) {
    return webRes.text();
  } else if (webRes.status === 302) {
    let redirects = 1;
    while (redirects < MAX_REDIRECTS) {
      webRes = await handleRequest({ url: webRes.headers.get("location") });
      if (webRes.status === 200) {
        return webRes.text();
      } else if (webRes.status === 302) {
        redirects++;
      } else {
        return "<h1>Error</h1>";
      }
    }
  }
  return webRes.text();
};
`;

async function renderRoute(entry: string, output: string, url: string) {
  const server = (await import(pathToFileURL(entry).href)).default;
  const res = await server({ url });

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, res);
}

export default function staticAdapter(): any {
  return {
    name: "static",
    start(_config: unknown, { port }: { port: string }) {
      process.env.PORT = port;
      spawn("npx", ["serve", "./dist/public"], {
        shell: true,
        stdio: "inherit",
      });
      return `http://localhost:${process.env.PORT}`;
    },
    async build(config: any, builder: any) {
      if (!config?.solidOptions?.ssr) {
        throw new Error(
          "solid-start-static needs ssr to be enabled for pre-rendering routes at build time",
        );
      }

      const ssrExternal = config?.ssr?.external || [];
      await builder.client(join(config.root, "dist", "public"));
      await builder.server(join(config.root, ".solid", "server"));

      const pathToServer = join(config.root, ".solid", "server", "server.js");
      await writeFile(pathToServer, serverEntry);

      const pathToDist = resolve(config.root, "dist", "public");

      builder.debug("bundling server with rollup");

      const bundle = await rollup({
        input: pathToServer,
        plugins: [
          json(),
          nodeResolve({
            preferBuiltins: true,
            exportConditions: ["node", "solid"],
          }),
          common({ strictRequires: true, ...config.build.commonjsOptions }),
        ],
        external: ["stream/web", ...ssrExternal],
      });

      await bundle.write({ format: "esm", dir: join(config.root, "dist") });
      await bundle.close();

      builder.debug("bundling server done");

      await config.solidOptions.router.init();
      const routes = [
        ...config.solidOptions.router
          .getFlattenedPageRoutes()
          .map((route: { path: string }) => route.path)
          .filter((path: string) => (path.includes(":") || path.includes("/")) && !path.includes("*")),
        "/404",
        ...(config.solidOptions.prerenderRoutes || []),
      ];

      await Promise.all(
        routes.map((url) =>
          renderRoute(
            join(config.root, "dist", "server.js"),
            join(
              pathToDist,
              url.endsWith("/") ? `${url.slice(1)}index.html` : `${url.slice(1)}.html`,
            ),
            url,
          ),
        ),
      );
    },
  };
}
