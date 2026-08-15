import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** A tiny HTTP origin for the E2E specs.
 *
 *  Content scripts declared for `<all_urls>` do not run on `about:blank`
 *  or `data:` documents, so `page.setContent()` is not enough to test
 *  anything the content script does. These specs need a real http://
 *  origin, and one we control — the extension's YouTube path must be
 *  exercisable without depending on youtube.com being reachable or
 *  unchanged. */
export interface TestServer {
  origin: string;
  close: () => Promise<void>;
}

const ARTICLE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Test article</title></head>
<body>
  <article>
    <h1>An article about detection</h1>
    <p>${'Readable prose for the page-text scan path. '.repeat(30)}</p>
  </article>
</body></html>`;

const EMPTY_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Empty</title></head>
<body></body></html>`;

export async function startTestServer(): Promise<TestServer> {
  const server: Server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (path === '/empty') {
      res.end(EMPTY_HTML);
      return;
    }
    res.end(ARTICLE_HTML);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        // Chromium holds keep-alive sockets open after the page closes,
        // and `server.close()` waits for every connection to drain — so
        // without this the whole spec hangs until the test times out.
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
