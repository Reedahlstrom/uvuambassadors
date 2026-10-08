import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page is dynamic (reads the session cookie), so no incremental cache is needed.
export default defineCloudflareConfig({});
