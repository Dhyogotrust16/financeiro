import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { isDatabaseConfigured } from "@workspace/db";
import { isSupabaseAuthConfigured } from "./middlewares/requireAuth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.get(["/favicon.svg", "/favicon.ico"], (_req, res) => {
  const faviconPath = path.join(frontendDist, "favicon.svg");
  if (existsSync(faviconPath)) {
    res.sendFile(faviconPath);
    return;
  }

  res.status(204).end();
});

app.use("/api", (req, res, next) => {
  if (req.path === "/healthz") {
    next();
    return;
  }

  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: "DATABASE_URL is not configured" });
    return;
  }

  if (!isSupabaseAuthConfigured()) {
    res.status(503).json({
      error: "Supabase auth is not configured",
    });
    return;
  }

  next();
});

app.use("/api", router);

// Serve frontend static files in production
const frontendDist = process.env.VERCEL
  ? path.resolve(process.cwd(), "public")
  : path.resolve(__dirname, "../../financeiro/dist/public");
app.use(express.static(frontendDist));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

export default app;
