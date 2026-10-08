import fs from "node:fs";
import path from "node:path";

// Deletes the LOCAL demo database only. It never touches DATABASE_URL.
const dir = path.join(process.cwd(), ".data");
if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
console.log("✓ Local demo database deleted. Run `npm run dev` to recreate it with fresh demo data.");
