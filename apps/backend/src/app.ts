import Busboy from "@fastify/busboy";
import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { auth } from "./auth";
import { db } from "./db";
import { uploadAudioStream } from "./storage";

const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
const maxAudioUploadBytes = Number(
  process.env.MAX_AUDIO_UPLOAD_BYTES ?? 1024 * 1024 * 100,
);
const unauthorizedError = {
  message: "Authentication required",
} as const;
const notFoundError = {
  message: "Resource not found",
} as const;
const badUploadRequestError = {
  message: "Expected multipart/form-data with a file field named `file`.",
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
  )
  .post(
    "/upload",
    async ({ request, status, user }) => {
      const contentType = request.headers.get("content-type");

      if (!contentType?.includes("multipart/form-data")) {
        return status(400, badUploadRequestError);
      }

      if (!request.body) {
        return status(400, badUploadRequestError);
      }

      return await new Promise((resolve) => {
        const requestStream = Readable.fromWeb(
          request.body as unknown as NodeReadableStream<Uint8Array>,
        );
        const busboy = new Busboy({
          headers: {
            "content-type": contentType,
          },
          limits: {
            files: 1,
            fileSize: maxAudioUploadBytes,
            fields: 4,
            parts: 5,
          },
        });

        let fileSeen = false;
        let settled = false;
        let uploadPromise: Promise<{
          bucket: string;
          key: string;
          url: string | null;
        }> | null = null;

        const finish = (value: unknown) => {
          if (settled) {
            return;
          }

          settled = true;
          resolve(value);
        };

        const fail = (code: number, message: string) => {
          requestStream.destroy();
          finish(
            status(code, {
              message,
            }),
          );
        };

        busboy.on("file", (fieldname, file, filename, _encoding, mimeType) => {
          if (fieldname !== "file") {
            file.resume();
            return;
          }

          if (fileSeen) {
            file.resume();
            fail(400, "Only one file upload is allowed.");
            return;
          }

          if (!mimeType.startsWith("audio/")) {
            file.resume();
            fail(400, "Only audio files are allowed.");
            return;
          }

          fileSeen = true;
          const chunks: Buffer[] = [];
          let totalBytes = 0;

          file.on("limit", () => {
            file.resume();
            fail(413, "Audio file exceeds the upload size limit.");
          });

          uploadPromise = new Promise((resolveUpload, rejectUpload) => {
            file.on("data", (chunk: Buffer) => {
              totalBytes += chunk.length;
              chunks.push(Buffer.from(chunk));
            });

            file.on("error", rejectUpload);

            file.on("end", () => {
              void uploadAudioStream({
                userId: user.id,
                filename,
                contentType: mimeType,
                body: Buffer.concat(chunks, totalBytes),
                contentLength: totalBytes,
              }).then(resolveUpload, rejectUpload);
            });
          });
        });

        busboy.on("filesLimit", () => {
          fail(400, "Only one file upload is allowed.");
        });

        busboy.on("error", () => {
          fail(500, "Could not process the upload.");
        });

        requestStream.on("error", () => {
          fail(500, "Could not read the upload stream.");
        });

        busboy.on("finish", async () => {
          if (settled) {
            return;
          }

          if (!fileSeen || !uploadPromise) {
            fail(400, badUploadRequestError.message);
            return;
          }

          try {
            const upload = await uploadPromise;

            finish({
              upload,
            });
          } catch (error) {
            const message =
              error instanceof Error && error.message
                ? error.message
                : "Upload to object storage failed.";

            fail(500, message);
          }
        });

        requestStream.pipe(busboy);
      });
    },
    {
      auth: true,
    },
  );

export type App = typeof app;
