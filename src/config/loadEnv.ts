import path from "path";
import { config } from "dotenv";

const ROOT = path.resolve(__dirname, "../..");
config({ path: path.join(ROOT, ".env") });
