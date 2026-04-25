import { treaty, type Treaty } from "@elysiajs/eden";
import type { App } from "backend";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const api: Treaty.Create<App> = treaty<App>(baseUrl, {
  fetch: {
    credentials: "include",
  },
});
