import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { auth } from "./auth";
import { db } from "./db";

type Resource = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
};

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

const resourceListQuery = db.query<Resource, [string]>(
  "SELECT id, user_id as userId, name, created_at as createdAt FROM resources WHERE user_id = ? ORDER BY created_at DESC",
);

const resourceByIdQuery = db.query<Resource, [string, string]>(
  "SELECT id, user_id as userId, name, created_at as createdAt FROM resources WHERE id = ? AND user_id = ? LIMIT 1",
);

const insertResource = db.query(
  "INSERT INTO resources (id, user_id, name, created_at) VALUES (?, ?, ?, ?)",
);

const updateResource = db.query(
  "UPDATE resources SET name = ? WHERE id = ? AND user_id = ?",
);

const deleteResource = db.query(
  "DELETE FROM resources WHERE id = ? AND user_id = ?",
);

const listResources = (userId: string) => resourceListQuery.all(userId);
const findResource = (id: string, userId: string) =>
  resourceByIdQuery.get(id, userId) ?? null;

const createResource = (userId: string, name: string) => {
  const resource = {
    id: crypto.randomUUID(),
    userId,
    name,
    createdAt: new Date().toISOString(),
  } satisfies Resource;

  insertResource.run(
    resource.id,
    resource.userId,
    resource.name,
    resource.createdAt,
  );

  return resource;
};

const renameResource = (id: string, userId: string, name: string) => {
  const existing = findResource(id, userId);

  if (!existing) {
    return null;
  }

  updateResource.run(name, id, userId);

  return {
    ...existing,
    name,
  } satisfies Resource;
};

const removeResource = (id: string, userId: string) => {
  const existing = findResource(id, userId);

  if (!existing) {
    return null;
  }

  deleteResource.run(id, userId);

  return existing;
};

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
    ({ user }) => ({
      resources: listResources(user.id),
    }),
    {
      auth: true,
    },
  )
  .get(
    "/resources/:id",
    ({ params, status, user }) => {
      const resource = findResource(params.id, user.id);

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
    ({ body, user }) => ({
      resource: createResource(user.id, body.name.trim()),
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
    ({ body, params, status, user }) => {
      const resource = renameResource(params.id, user.id, body.name.trim());

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
    ({ params, status, user }) => {
      const resource = removeResource(params.id, user.id);

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
  );

export type App = typeof app;
