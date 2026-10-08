// Load .env / .env.local the same way Next.js does, before anything reads process.env.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: console.error });
