import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? "financeiro-local-secret-change-in-prod";
const JWT_EXPIRES_IN = "7d";

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { email, password, name } = req.body as Record<string, string>;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password e name são obrigatórios" });
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: "E-mail já cadastrado" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = `user_${randomUUID().replace(/-/g, "")}`;

  const [user] = await db.insert(usersTable).values({
    userId,
    email: email.toLowerCase(),
    passwordHash,
    name,
  }).returning();

  const token = jwt.sign({ userId: user.userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return res.status(201).json({ token, user: { id: user.userId, email: user.email, name: user.name } });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body as Record<string, string>;

  if (!email || !password) {
    return res.status(400).json({ error: "email e password são obrigatórios" });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (!user) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  const token = jwt.sign({ userId: user.userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return res.json({ token, user: { id: user.userId, email: user.email, name: user.name } });
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, payload.userId)).limit(1);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    return res.json({ id: user.userId, email: user.email, name: user.name });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

export default router;
