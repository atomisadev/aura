import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";

export const app = new Elysia()
  .use(
    cors({
      origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    }),
  )
  .get("/", () => ({
    name: "Aura API",
    status: "ok" as const,
  }))
  .get("/health", () => ({
    status: "ok" as const,
    uptime: process.uptime(),
  }))
  .post(
    "/echo",
    ({ body }) => ({
      message: body.message,
    }),
    {
      body: t.Object({
        message: t.String(),
      }),
    },
  );

export type App = typeof app;
