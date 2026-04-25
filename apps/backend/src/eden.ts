import { treaty, type Treaty } from "@elysiajs/eden";
import type { App } from "./app";

const port = process.env.PORT ?? "4000";
const baseUrl = process.env.API_URL ?? `http://localhost:${port}`;

export const api: Treaty.Create<App> = treaty<App>(baseUrl);
