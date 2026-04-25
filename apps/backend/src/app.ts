import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { auth } from "./auth";
import { db } from "./db";

const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
const unauthorizedError = {
  message: "Authentication required",
} as const;
const notFoundError = {
  message: "Resource not found",
} as const;

const betterAuth = new Elysia({ name: "better-auth" }).macro({
  auth: {
    async resolve({ request: { headers }, status }) {
      const session = await auth.api.getSession({
        headers,
      });

      if (!session) {
        return status(401, unauthorizedError);
      }

      return {
        user: session.user,
        session: session.session,
      };
    },
  },
});

export const app = new Elysia()
  .use(betterAuth)
  .use(
    cors({
      origin: frontendOrigin,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
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
  )
  .get(
    "/me",
    ({ user, session }) => ({
      session,
      user,
    }),
    {
      auth: true,
    },
  )
  .get(
    "/resources",
    async ({ user }) => ({
      resources: await db.resource.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    }),
    {
      auth: true,
    },
  )
  .get(
    "/resources/:id",
    async ({ params, status, user }) => {
      const resource = await db.resource.findFirst({
        where: {
          id: params.id,
          userId: user.id,
        },
      });

      if (!resource) {
        return status(404, notFoundError);
      }

      return {
        resource,
      };
    },
    {
      auth: true,
      params: t.Object({
        id: t.String(),
      }),
    },
  )
  .post(
    "/resources",
    async ({ body, user }) => ({
      resource: await db.resource.create({
        data: {
          userId: user.id,
          name: body.name.trim(),
        },
      }),
    }),
    {
      auth: true,
      body: t.Object({
        name: t.String({
          minLength: 1,
          maxLength: 120,
        }),
      }),
    },
  )
  .patch(
    "/resources/:id",
    async ({ body, params, status, user }) => {
      const existing = await db.resource.findFirst({
        where: {
          id: params.id,
          userId: user.id,
        },
      });

      if (!existing) {
        return status(404, notFoundError);
      }

      const resource = await db.resource.update({
        where: {
          id: existing.id,
        },
        data: {
          name: body.name.trim(),
        },
      });

      return {
        resource,
      };
    },
    {
      auth: true,
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.String({
          minLength: 1,
          maxLength: 120,
        }),
      }),
    },
  )
  .delete(
    "/resources/:id",
    async ({ params, status, user }) => {
      const resource = await db.resource.findFirst({
        where: {
          id: params.id,
          userId: user.id,
        },
      });

      if (!resource) {
        return status(404, notFoundError);
      }

      await db.resource.delete({
        where: {
          id: resource.id,
        },
      });

      return {
        resource,
      };
    },
    {
      auth: true,
      params: t.Object({
        id: t.String(),
      }),
    },
  );

export type App = typeof app;
