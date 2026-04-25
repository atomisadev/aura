import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { db } from "./db";

const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://localhost:4000";
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
const configuredAuthUrl = process.env.BETTER_AUTH_URL ?? backendOrigin;
const normalizedAuthUrl = new URL(configuredAuthUrl);
const inferredBasePath =
  normalizedAuthUrl.pathname && normalizedAuthUrl.pathname !== "/"
    ? normalizedAuthUrl.pathname
    : undefined;

normalizedAuthUrl.pathname = "/";
normalizedAuthUrl.search = "";
normalizedAuthUrl.hash = "";

export const auth = betterAuth({
  appName: "Aura",
  baseURL: normalizedAuthUrl.toString(),
  basePath: process.env.BETTER_AUTH_BASE_PATH ?? inferredBasePath ?? "/api/auth",
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  experimental: {
    joins: true,
  },
  trustedOrigins: [frontendOrigin, backendOrigin],
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      scope: ["read:user", "user:email"],
    },
  },
});
