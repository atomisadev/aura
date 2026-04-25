import { app } from "./app";
import { auth } from "./auth";

const port = Number(process.env.PORT ?? 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

const createCorsHeaders = (request: Request) => {
  const headers = new Headers();
  const origin = request.headers.get("origin");

  if (origin === frontendOrigin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Vary", "Origin");
  }

  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  return headers;
};

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/auth")) {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: createCorsHeaders(request),
        });
      }

      const response = await auth.handler(request);
      const headers = new Headers(response.headers);
      const corsHeaders = createCorsHeaders(request);

      corsHeaders.forEach((value, key) => {
        headers.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return app.handle(request);
  },
});

console.log(`Backend running at ${server.url}`);
