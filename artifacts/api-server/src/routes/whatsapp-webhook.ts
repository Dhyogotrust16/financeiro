import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { resolveEvolutionConfig } from "../lib/whatsapp-settings";

const router = Router();

function extractBody(message: any): string {
  if (!message) return "";
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.documentMessage?.fileName ??
    (message.audioMessage ? "🎵 Áudio" : null) ??
    (message.stickerMessage ? "🎨 Figurinha" : null) ??
    (message.locationMessage ? "📍 Localização" : null) ??
    (message.contactMessage ? "👤 Contato" : null) ??
    "[mídia]"
  );
}

function msgType(message: any): string {
  if (!message) return "text";
  if (message.imageMessage) return "image";
  if (message.audioMessage) return "audio";
  if (message.videoMessage) return "video";
  if (message.documentMessage) return "document";
  if (message.stickerMessage) return "sticker";
  return "text";
}

function normalizeJid(jid: string): string {
  return jid?.split(":")[0] ?? jid;
}

function normalizeEvolutionRecipient(value: string | undefined) {
  if (!value) return value;
  if (value.endsWith("@g.us")) return value;
  return value.split("@")[0];
}

function normalizeWebhookEventName(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[_-]+/g, ".");
}

function isHistorySyncEvent(event: string | null | undefined) {
  const normalized = normalizeWebhookEventName(event);
  return normalized === "messages.set" || normalized === "messaging.history.set";
}

function isMessageEvent(event: string | null | undefined) {
  const normalized = normalizeWebhookEventName(event);
  return [
    "send.message",
    "messages.upsert",
    "message",
    "messages.set",
    "messaging.history.set",
  ].includes(normalized);
}

function extractMessageBatch(payload: any): any[] {
  const data = payload?.data;
  const candidates = [
    data?.messages,
    payload?.messages,
    Array.isArray(data) ? data : null,
    data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  const single = data && typeof data === "object" ? data : payload;
  if (single && typeof single === "object" && (single.key || single.remoteJid || single.message)) {
    return [single];
  }

  return [];
}

function extractRecordJid(record: any): string {
  return normalizeJid(record?.key?.remoteJid ?? record?.remoteJid ?? record?.jid ?? record?.id ?? "");
}

function extractRecordName(record: any): string | null {
  return (
    record?.name ??
    record?.pushName ??
    record?.notify ??
    record?.subject ??
    record?.fullName ??
    record?.verifiedName ??
    null
  );
}

function extractRecordTimestamp(record: any): number {
  return (
    Number(
      record?.messageTimestamp ??
      record?.timestamp ??
      record?.conversationTimestamp ??
      record?.lastMessage?.messageTimestamp ??
      record?.lastMessage?.timestamp ??
      Math.floor(Date.now() / 1000),
    ) || Math.floor(Date.now() / 1000)
  );
}

function extractRecordBody(record: any): string {
  if (!record) return "";
  if (typeof record === "string") return record;
  return extractBody(record?.message ?? record?.lastMessage?.message ?? record?.lastMessage ?? record?.content ?? record);
}

async function upsertChatRow(
  instance: string,
  remoteJid: string,
  opts: {
    name?: string | null;
    pushName?: string | null;
    lastMessage?: string | null;
    lastMessageTime?: number | null;
    unreadCount?: number;
    incrementUnread?: boolean;
  },
) {
  const isGroupJid = remoteJid.endsWith("@g.us");
  const hasLastMessage = Boolean(opts.lastMessage);
  const lastMessage = opts.lastMessage ?? null;
  const lastMessageTime = Number(opts.lastMessageTime ?? 0) || Math.floor(Date.now() / 1000);
  const unreadCount = Number(opts.unreadCount ?? 0) || 0;
  const incrementUnread = Boolean(opts.incrementUnread);

  await db.execute(sql`
    INSERT INTO whatsapp_chats (instance_name, remote_jid, name, push_name, last_message, last_message_time, unread_count, status, protocol, updated_at)
    VALUES (${instance}, ${remoteJid}, ${opts.name ?? null}, ${isGroupJid ? null : opts.pushName ?? null}, ${lastMessage}, ${lastMessageTime}, ${unreadCount}, 'open', LPAD(nextval('whatsapp_protocol_seq')::TEXT, 6, '0'), NOW())
    ON CONFLICT (instance_name, remote_jid) DO UPDATE
    SET last_message = CASE
          WHEN ${hasLastMessage} AND EXCLUDED.last_message_time >= whatsapp_chats.last_message_time THEN EXCLUDED.last_message
          ELSE whatsapp_chats.last_message
        END,
        last_message_time = CASE
          WHEN ${hasLastMessage} THEN GREATEST(EXCLUDED.last_message_time, whatsapp_chats.last_message_time)
          ELSE whatsapp_chats.last_message_time
        END,
        push_name = CASE WHEN ${isGroupJid} THEN whatsapp_chats.push_name ELSE COALESCE(EXCLUDED.push_name, whatsapp_chats.push_name) END,
        name = CASE WHEN ${isGroupJid} THEN COALESCE(whatsapp_chats.name, EXCLUDED.name) ELSE COALESCE(EXCLUDED.name, whatsapp_chats.name) END,
        unread_count = CASE
          WHEN ${incrementUnread} THEN whatsapp_chats.unread_count + 1
          ELSE GREATEST(whatsapp_chats.unread_count, EXCLUDED.unread_count)
        END,
        updated_at = NOW()
  `);
}

async function queryRows<T = any>(query: any): Promise<T[]> {
  return (await db.execute(query)) as any[];
}

async function upsertMessageRow(
  instance: string,
  record: any,
  opts: {
    historySync?: boolean;
    groupNameLookup?: boolean;
  } = {},
) {
  const historySync = Boolean(opts.historySync);
  const key = record?.key ?? {};
  const remoteJid = normalizeJid(key?.remoteJid ?? record?.remoteJid ?? "");
  if (!remoteJid) return null;

  const fromMe: boolean = key?.fromMe ?? record?.fromMe ?? false;
  const messageId: string = key?.id ?? record?.id ?? `${Date.now()}-${Math.random()}`;
  const timestamp: number = record?.messageTimestamp ?? record?.timestamp ?? Math.floor(Date.now() / 1000);
  const pushName: string = record?.pushName ?? "";
  const msgContent = record?.message ?? {};
  const body: string = extractBody(msgContent);
  const type: string = msgType(msgContent);
  const shouldIncrementUnread = !historySync && !fromMe;

  await db.execute(sql`
    INSERT INTO whatsapp_messages (id, instance_name, remote_jid, from_me, push_name, message_type, body, timestamp, raw)
    VALUES (${messageId}, ${instance}, ${remoteJid}, ${fromMe}, ${pushName}, ${type}, ${body}, ${timestamp}, ${JSON.stringify(record)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body, raw = EXCLUDED.raw
  `);

  const isGroupJid = remoteJid.endsWith("@g.us");
  const chatName: string | null = isGroupJid
    ? (record?.name ?? null)
    : (!fromMe && pushName ? pushName : null);

  await upsertChatRow(instance, remoteJid, {
    name: chatName,
    pushName: isGroupJid ? null : pushName,
    lastMessage: body,
    lastMessageTime: timestamp,
    unreadCount: shouldIncrementUnread ? 1 : 0,
    incrementUnread: shouldIncrementUnread,
  });

  console.log(`[webhook] saved msg ${messageId} for ${remoteJid} fromMe=${fromMe}`);

  if (isGroupJid && !historySync && opts.groupNameLookup !== false) {
    const existing = await queryRows<{ name: string | null }>(sql`
      SELECT name FROM whatsapp_chats WHERE instance_name = ${instance} AND remote_jid = ${remoteJid} AND name IS NOT NULL LIMIT 1
    `);
    if (!existing[0]?.name) {
      try {
        const evoConfig = await resolveEvolutionConfig();
        if (evoConfig) {
          const resp = await fetch(`${evoConfig.apiUrl}/group/findGroupInfos/${instance}?groupJid=${remoteJid}`, {
            headers: { apikey: evoConfig.apiKey },
          });
          if (resp.ok) {
            const info = await resp.json() as any;
            const groupName = info?.subject ?? info?.name ?? null;
            if (groupName) {
              await db.execute(sql`
                UPDATE whatsapp_chats SET name = ${groupName} WHERE instance_name = ${instance} AND remote_jid = ${remoteJid}
              `);
            }
          }
        }
      } catch { /* ignore */ }
    }
  }

  return { remoteJid, messageId };
}

async function evolutionFetchJson(
  config: { apiUrl: string; apiKey: string },
  path: string,
  body?: unknown,
  timeoutMs = 8000,
) {
  const url = `${config.apiUrl.replace(/\/+$/, "")}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.apiKey,
    },
    signal: controller.signal,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).finally(() => {
    clearTimeout(timer);
  });

  let text = "";
  try {
    text = await response.text();
  } catch {
    text = "";
  }
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : "";
  } catch {
    // keep text
  }

  if (!response.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`Evolution API ${response.status}: ${detail}`);
  }

  return data;
}

function extractEvolutionRecords(payload: any): any[] {
  const candidates = [
    payload,
    payload?.data,
    payload?.messages,
    payload?.chats,
    payload?.contacts,
    payload?.records,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }

    if (candidate && typeof candidate === "object") {
      if (Array.isArray(candidate.records)) return candidate.records;
      if (Array.isArray(candidate.items)) return candidate.items;
      if (Array.isArray(candidate.messages)) return candidate.messages;
      if (Array.isArray(candidate.chats)) return candidate.chats;
      if (Array.isArray(candidate.contacts)) return candidate.contacts;
    }
  }

  return [];
}

async function syncChatsFromEvolution(instance: string, options: { limit?: number } = {}) {
  const evoConfig = await resolveEvolutionConfig();
  if (!evoConfig) {
    return { ok: false, reason: "Evolution API configuration not found" };
  }

  const limit = Math.max(25, Math.min(Number(options.limit ?? 100), 250));
  const maxPages = 1;
  let total = 0;

  for (let page = 1; page <= maxPages; page++) {
    const payload = await evolutionFetchJson(
      evoConfig,
      `/chat/findChats/${encodeURIComponent(instance)}?page=${page}&limit=${limit}`,
      {},
    );
    const pageInfo = payload as any;
    const records = extractEvolutionRecords(payload);
    if (!records.length) break;

    for (const chat of records) {
      const remoteJid = extractRecordJid(chat);
      if (!remoteJid) continue;

      const lastMessage = chat?.lastMessage ? extractRecordBody(chat.lastMessage) : null;
      await upsertChatRow(instance, remoteJid, {
        name: extractRecordName(chat),
        pushName: remoteJid.endsWith("@g.us") ? null : (chat?.pushName ?? chat?.notify ?? null),
        lastMessage,
        lastMessageTime: extractRecordTimestamp(chat),
        unreadCount: Number(chat?.unreadCount ?? chat?.unread_count ?? 0) || 0,
        incrementUnread: false,
      });
      total += 1;
    }

    const pageCount = Number(pageInfo?.pages ?? pageInfo?.chats?.pages ?? pageInfo?.messages?.pages ?? 0) || 0;
    if ((pageCount && page >= pageCount) || records.length < limit) break;
  }

  return { ok: true, synced: total };
}

async function syncMessagesFromEvolution(instance: string, remoteJid: string, options: { limit?: number } = {}) {
  const evoConfig = await resolveEvolutionConfig();
  if (!evoConfig) {
    return { ok: false, reason: "Evolution API configuration not found" };
  }

  const limit = Math.max(25, Math.min(Number(options.limit ?? 200), 500));
  const maxPages = 5;
  let total = 0;

  for (let page = 1; page <= maxPages; page++) {
    const payload = await evolutionFetchJson(
      evoConfig,
      `/chat/findMessages/${encodeURIComponent(instance)}?page=${page}&limit=${limit}`,
      {
        where: {
          key: {
            remoteJid,
          },
        },
      },
    );
    const pageInfo = payload as any;
    const records = extractEvolutionRecords(payload);
    if (!records.length) break;

    for (const record of records) {
      const saved = await upsertMessageRow(instance, record, {
        historySync: true,
        groupNameLookup: false,
      });
      if (saved) total += 1;
    }

    const pageCount = Number(pageInfo?.pages ?? pageInfo?.messages?.pages ?? pageInfo?.chats?.pages ?? 0) || 0;
    if ((pageCount && page >= pageCount) || records.length < limit) break;
  }

  return { ok: true, synced: total };
}

// POST /whatsapp/webhook/:instance
router.post("/webhook/:instance", async (req, res) => {
  const { instance } = req.params;
  const payload = req.body;

  // Log the payload for debugging
  console.log("[webhook] event payload:", JSON.stringify(payload).slice(0, 600));

  const event = payload?.event ?? payload?.type;
  const historySync = isHistorySyncEvent(event);

  try {
    // Evolution API v2 payload formats:
    // event: "send.message" | "messages.upsert" | "messages.set" — data is a message batch or history sync payload
    if (isMessageEvent(event)) {
      const messages = extractMessageBatch(payload);

      for (const m of messages) {
        await upsertMessageRow(instance, m, { historySync });
      }

      if (historySync) {
        const syncData = (payload?.data ?? {}) as any;
        const chats: any[] = Array.isArray(syncData?.chats) ? syncData.chats : [];
        for (const chat of chats) {
          const remoteJid = extractRecordJid(chat);
          if (!remoteJid) continue;

          const lastMessage = chat?.lastMessage ? extractRecordBody(chat.lastMessage) : null;
          await upsertChatRow(instance, remoteJid, {
            name: extractRecordName(chat),
            pushName: remoteJid.endsWith("@g.us") ? null : (chat?.pushName ?? chat?.notify ?? null),
            lastMessage,
            lastMessageTime: extractRecordTimestamp(chat),
            unreadCount: Number(chat?.unreadCount ?? chat?.unread_count ?? 0) || 0,
            incrementUnread: false,
          });
        }

        const contacts: any[] = Array.isArray(syncData?.contacts) ? syncData.contacts : [];
        for (const contact of contacts) {
          const remoteJid = extractRecordJid(contact);
          if (!remoteJid) continue;

          await upsertChatRow(instance, remoteJid, {
            name: extractRecordName(contact),
            pushName: remoteJid.endsWith("@g.us") ? null : (contact?.pushName ?? contact?.notify ?? null),
            lastMessage: null,
            lastMessageTime: 0,
            unreadCount: Number(contact?.unreadCount ?? contact?.unread_count ?? 0) || 0,
            incrementUnread: false,
          });
        }
      }
    }

    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[whatsapp-webhook] error:", err?.message);
    res.status(200).json({ ok: false }); // always 200 so Evolution doesn't retry
  }
});

router.post("/chats/:instance/sync", async (req, res) => {
  const { instance } = req.params;
  const { limit } = (req.body ?? {}) as { limit?: number };

  try {
    const result = await syncChatsFromEvolution(instance, { limit });
    res.json(result);
  } catch (err: any) {
    console.warn(`[whatsapp-webhook] chat sync failed for ${instance}: ${err?.message}`);
    res.status(502).json({ ok: false, error: err?.message ?? "Falha ao sincronizar chats" });
  }
});

// GET /whatsapp/chats/:instance — list chats from our DB
router.get("/chats/:instance", async (req, res) => {
  const { instance } = req.params;
  const rows = await queryRows(sql`
    SELECT * FROM whatsapp_chats
    WHERE instance_name = ${instance}
    ORDER BY last_message_time DESC
    LIMIT 200
  `);
  res.json(rows);
});

router.post("/messages/:instance/:jid/sync", async (req, res) => {
  const { instance, jid } = req.params;
  const { limit } = (req.body ?? {}) as { limit?: number };

  try {
    const result = await syncMessagesFromEvolution(instance, jid, { limit });
    res.json(result);
  } catch (err: any) {
    console.warn(`[whatsapp-webhook] message sync failed for ${instance}/${jid}: ${err?.message}`);
    res.status(502).json({ ok: false, error: err?.message ?? "Falha ao sincronizar mensagens" });
  }
});

// GET /whatsapp/messages/:instance/:jid — list messages from our DB
router.get("/messages/:instance/:jid", async (req, res) => {
  const { instance, jid } = req.params;
  const rows = await queryRows(sql`
    SELECT * FROM whatsapp_messages
    WHERE instance_name = ${instance} AND remote_jid = ${jid}
    ORDER BY timestamp ASC
    LIMIT 100
  `);
  res.json(rows);
});

// PATCH /whatsapp/chats/:instance/:jid/name — update chat name
router.patch("/chats/:instance/:jid/name", async (req, res) => {
  const { instance, jid } = req.params;
  const { name } = req.body as { name: string };
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  await db.execute(sql`
    UPDATE whatsapp_chats SET name = ${name} WHERE instance_name = ${instance} AND remote_jid = ${jid}
  `);
  res.json({ ok: true });
});

// PATCH /whatsapp/chats/:instance/:jid — update SAC fields
router.patch("/chats/:instance/:jid", async (req, res) => {
  const { instance, jid } = req.params;
  const { status, assignedTo, tags, internalNotes } = req.body as {
    status?: string; assignedTo?: string | null; tags?: string[]; internalNotes?: string;
  };
  if (status !== undefined)
    await db.execute(sql`UPDATE whatsapp_chats SET status = ${status} WHERE instance_name = ${instance} AND remote_jid = ${jid}`);
  if (assignedTo !== undefined)
    await db.execute(sql`UPDATE whatsapp_chats SET assigned_to = ${assignedTo ?? null} WHERE instance_name = ${instance} AND remote_jid = ${jid}`);
  if (tags !== undefined)
    await db.execute(sql`UPDATE whatsapp_chats SET tags = ${tags}::TEXT[] WHERE instance_name = ${instance} AND remote_jid = ${jid}`);
  if (internalNotes !== undefined)
    await db.execute(sql`UPDATE whatsapp_chats SET internal_notes = ${internalNotes} WHERE instance_name = ${instance} AND remote_jid = ${jid}`);
  const rows = await queryRows(sql`SELECT * FROM whatsapp_chats WHERE instance_name = ${instance} AND remote_jid = ${jid}`);
  res.json(rows[0] ?? { ok: true });
});

// GET /whatsapp/tags/:instance
router.get("/tags/:instance", async (req, res) => {
  const { instance } = req.params;
  const rows = await queryRows(sql`SELECT * FROM whatsapp_tags WHERE instance_name = ${instance} ORDER BY name`);
  res.json(rows);
});

// POST /whatsapp/tags/:instance
router.post("/tags/:instance", async (req, res) => {
  const { instance } = req.params;
  const { name, color } = req.body as { name: string; color?: string };
  const rows = await queryRows(sql`
    INSERT INTO whatsapp_tags (instance_name, name, color) VALUES (${instance}, ${name}, ${color ?? "#6366f1"})
    ON CONFLICT (instance_name, name) DO UPDATE SET color = EXCLUDED.color RETURNING *
  `);
  res.json(rows[0] ?? { ok: true });
});

// DELETE /whatsapp/tags/:instance/:tagname
router.delete("/tags/:instance/:tagname", async (req, res) => {
  const { instance, tagname } = req.params;
  await db.execute(sql`DELETE FROM whatsapp_tags WHERE instance_name = ${instance} AND name = ${tagname}`);
  res.json({ ok: true });
});

// ── Quick replies ────────────────────────────────────────────────────────────

router.get("/quick-replies/:instance", async (req, res) => {
  const { instance } = req.params;
  const rows = await queryRows(sql`SELECT * FROM whatsapp_quick_replies WHERE instance_name = ${instance} ORDER BY shortcut`);
  res.json(rows);
});

router.post("/quick-replies/:instance", async (req, res) => {
  const { instance } = req.params;
  const { shortcut, title, body } = req.body as { shortcut: string; title: string; body: string };
  const rows = await queryRows(sql`
    INSERT INTO whatsapp_quick_replies (instance_name, shortcut, title, body)
    VALUES (${instance}, ${shortcut}, ${title}, ${body})
    ON CONFLICT (instance_name, shortcut) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body
    RETURNING *
  `);
  res.json(rows[0] ?? { ok: true });
});

router.delete("/quick-replies/:instance/:id", async (req, res) => {
  const { instance, id } = req.params;
  await db.execute(sql`DELETE FROM whatsapp_quick_replies WHERE id = ${Number(id)} AND instance_name = ${instance}`);
  res.json({ ok: true });
});

// ── Media proxy (base64 → Evolution) ────────────────────────────────────────

router.post("/send-media/:instance", async (req, res) => {
  const { instance } = req.params;
  const { number, mediatype, mimetype, caption, fileName, media } = req.body;
  try {
    const evoConfig = await resolveEvolutionConfig();
    if (!evoConfig) {
      res.status(503).json({ error: "Evolution API configuration not found" });
      return;
    }

    const evoUrl = evoConfig.apiUrl.replace(/\/+$/, "");
    const evoKey = evoConfig.apiKey;
    const upstream = await fetch(`${evoUrl}/message/sendMedia/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evoKey },
      body: JSON.stringify({
        number: normalizeEvolutionRecipient(number),
        mediatype,
        mimetype,
        caption: caption ?? "",
        fileName: fileName ?? "file",
        media,
      }),
    });
    const text = await upstream.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : "";
    } catch {
      data = text;
    }
    res.status(upstream.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message });
  }
});

// ── Departments ──────────────────────────────────────────────────────────────

router.get("/departments/:instance", async (req, res) => {
  const { instance } = req.params;
  const rows = await queryRows(sql`SELECT * FROM whatsapp_departments WHERE instance_name = ${instance} ORDER BY name`);
  res.json(rows);
});

router.post("/departments/:instance", async (req, res) => {
  const { instance } = req.params;
  const { name, color } = req.body as { name: string; color?: string };
  const rows = await queryRows(sql`
    INSERT INTO whatsapp_departments (instance_name, name, color) VALUES (${instance}, ${name}, ${color ?? "#6366f1"})
    ON CONFLICT (instance_name, name) DO UPDATE SET color = EXCLUDED.color RETURNING *
  `);
  res.json(rows[0] ?? { ok: true });
});

router.delete("/departments/:instance/:id", async (req, res) => {
  const { instance, id } = req.params;
  await db.execute(sql`DELETE FROM whatsapp_departments WHERE id = ${Number(id)} AND instance_name = ${instance}`);
  res.json({ ok: true });
});

// ── Transfer chamado ─────────────────────────────────────────────────────────

router.post("/chats/:instance/:jid/transfer", async (req, res) => {
  const { instance, jid } = req.params;
  const { department, assignedTo, comment } = req.body as { department: string; assignedTo?: string; comment?: string };
  const agentValue = assignedTo?.trim() || null;
  const note = comment?.trim()
    ? `[Transferência → ${department}${agentValue ? ` / ${agentValue}` : ""}]: ${comment.trim()}`
    : null;
  await db.execute(sql`
    UPDATE whatsapp_chats
    SET department = ${department},
        assigned_to = ${agentValue},
        status = 'attending',
        internal_notes = CASE WHEN ${note} IS NOT NULL THEN
          COALESCE(internal_notes || E'\n', '') || ${note}
        ELSE internal_notes END
    WHERE instance_name = ${instance} AND remote_jid = ${jid}
  `);
  const rows = await queryRows(sql`SELECT * FROM whatsapp_chats WHERE instance_name = ${instance} AND remote_jid = ${jid}`);
  res.json(rows[0] ?? { ok: true });
});

// ── Close chamado ─────────────────────────────────────────────────────────────

router.post("/chats/:instance/:jid/close", async (req, res) => {
  const { instance, jid } = req.params;
  const { subject, closedBy } = req.body as { subject?: string; closedBy?: string };
  await db.execute(sql`
    UPDATE whatsapp_chats
    SET status = 'resolved',
        closed_at = NOW(),
        closed_by = ${closedBy ?? null},
        subject = ${subject ?? null}
    WHERE instance_name = ${instance} AND remote_jid = ${jid}
  `);
  const rows = await queryRows(sql`SELECT * FROM whatsapp_chats WHERE instance_name = ${instance} AND remote_jid = ${jid}`);
  res.json(rows[0] ?? { ok: true });
});

// ── Mark unread ───────────────────────────────────────────────────────────────

router.post("/chats/:instance/:jid/mark-unread", async (req, res) => {
  const { instance, jid } = req.params;
  await db.execute(sql`UPDATE whatsapp_chats SET marked_unread = TRUE WHERE instance_name = ${instance} AND remote_jid = ${jid}`);
  res.json({ ok: true });
});

// ── Reopen chamado ────────────────────────────────────────────────────────────

router.post("/chats/:instance/:jid/reopen", async (req, res) => {
  const { instance, jid } = req.params;
  await db.execute(sql`
    UPDATE whatsapp_chats
    SET status = 'open', closed_at = NULL, closed_by = NULL, opened_at = NOW(), unread_count = 0, marked_unread = FALSE
    WHERE instance_name = ${instance} AND remote_jid = ${jid}
  `);
  const rows = await queryRows(sql`SELECT * FROM whatsapp_chats WHERE instance_name = ${instance} AND remote_jid = ${jid}`);
  res.json(rows[0] ?? { ok: true });
});

// ── Metrics ──────────────────────────────────────────────────────────────────

router.get("/metrics/:instance", async (req, res) => {
  const { instance } = req.params;

  const totals = await queryRows(sql`
    SELECT status, COUNT(*) as count
    FROM whatsapp_chats WHERE instance_name = ${instance}
    GROUP BY status
  `);

  const unread = await queryRows(sql`
    SELECT SUM(unread_count) as total FROM whatsapp_chats WHERE instance_name = ${instance}
  `);

  const today = new Date().toISOString().split("T")[0];
  const todayMsgs = await queryRows(sql`
    SELECT COUNT(*) as count FROM whatsapp_messages
    WHERE instance_name = ${instance} AND created_at::date = ${today}::date
  `);

  const recentChats = await queryRows(sql`
    SELECT DATE(updated_at) as day, COUNT(*) as count
    FROM whatsapp_chats WHERE instance_name = ${instance}
      AND updated_at >= NOW() - INTERVAL '7 days'
    GROUP BY day ORDER BY day ASC
  `);

  const tagStats = await queryRows(sql`
    SELECT unnest(tags) as tag, COUNT(*) as count
    FROM whatsapp_chats WHERE instance_name = ${instance} AND array_length(tags,1) > 0
    GROUP BY tag ORDER BY count DESC LIMIT 10
  `);

  res.json({
    byStatus: totals,
    unreadTotal: Number((unread[0] as any)?.total ?? 0),
    todayMessages: Number((todayMsgs[0] as any)?.count ?? 0),
    recentActivity: recentChats,
    topTags: tagStats,
  });
});

// POST /whatsapp/chats/:instance/fix-group-names — fetches group names from Evolution and updates DB
router.post("/chats/:instance/fix-group-names", async (req, res) => {
  const { instance } = req.params;
  res.json({
    ok: true,
    fixed: 0,
    skipped: true,
    message: "Group names are now resolved by webhook/history sync.",
  });
});

// POST /whatsapp/messages/:instance/:jid/read — mark as read
router.post("/messages/:instance/:jid/read", async (req, res) => {
  const { instance, jid } = req.params;
  await db.execute(sql`
    UPDATE whatsapp_chats SET unread_count = 0
    WHERE instance_name = ${instance} AND remote_jid = ${jid}
  `);
  res.json({ ok: true });
});

// ── Internal comments ─────────────────────────────────────────────────────────

router.get("/comments/:instance/:jid", async (req, res) => {
  const { instance, jid } = req.params;
  const rows = await queryRows(sql`
    SELECT * FROM whatsapp_internal_comments
    WHERE instance_name = ${instance} AND remote_jid = ${jid}
    ORDER BY created_at ASC
  `);
  res.json(rows);
});

router.post("/comments/:instance/:jid", async (req, res) => {
  const { instance, jid } = req.params;
  const { author, body } = req.body as { author: string; body: string };
  const rows = await queryRows(sql`
    INSERT INTO whatsapp_internal_comments (instance_name, remote_jid, author, body)
    VALUES (${instance}, ${jid}, ${author}, ${body})
    RETURNING *
  `);
  res.json(rows[0] ?? { ok: true });
});

// ── Scheduled messages ────────────────────────────────────────────────────────

router.get("/scheduled/:instance", async (req, res) => {
  const { instance } = req.params;
  const rows = await queryRows(sql`
    SELECT * FROM whatsapp_scheduled
    WHERE instance_name = ${instance} AND sent = FALSE AND scheduled_at > NOW()
    ORDER BY scheduled_at ASC
  `);
  res.json(rows);
});

router.post("/scheduled/:instance", async (req, res) => {
  const { instance } = req.params;
  const { remoteJid, body, scheduledAt, createdBy } = req.body as {
    remoteJid: string; body: string; scheduledAt: string; createdBy?: string;
  };
  const rows = await queryRows(sql`
    INSERT INTO whatsapp_scheduled (instance_name, remote_jid, body, scheduled_at, created_by)
    VALUES (${instance}, ${remoteJid}, ${body}, ${scheduledAt}::TIMESTAMPTZ, ${createdBy ?? null})
    RETURNING *
  `);
  res.json(rows[0] ?? { ok: true });
});

router.delete("/scheduled/:instance/:id", async (req, res) => {
  const { instance, id } = req.params;
  await db.execute(sql`DELETE FROM whatsapp_scheduled WHERE id = ${Number(id)} AND instance_name = ${instance}`);
  res.json({ ok: true });
});

// ── Contact custom fields ─────────────────────────────────────────────────────

router.get("/contact-fields/:instance/:jid", async (req, res) => {
  const { instance, jid } = req.params;
  const rows = await queryRows(sql`
    SELECT field_key, field_value FROM whatsapp_contact_fields
    WHERE instance_name = ${instance} AND remote_jid = ${jid}
  `);
  const fields: Record<string, string> = {};
  for (const row of rows as any[]) fields[row.field_key] = row.field_value;
  res.json(fields);
});

router.post("/contact-fields/:instance/:jid", async (req, res) => {
  const { instance, jid } = req.params;
  const fields = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(fields)) {
    await db.execute(sql`
      INSERT INTO whatsapp_contact_fields (instance_name, remote_jid, field_key, field_value)
      VALUES (${instance}, ${jid}, ${key}, ${value})
      ON CONFLICT (instance_name, remote_jid, field_key) DO UPDATE SET field_value = EXCLUDED.field_value
    `);
  }
  res.json({ ok: true });
});

// ── History (closed chats) ────────────────────────────────────────────────────

router.get("/history/:instance", async (req, res) => {
  const { instance } = req.params;
  const { search, limit = "50", offset = "0" } = req.query as Record<string, string>;
  const searchPattern = search ? `%${search}%` : null;
  const rows = await queryRows(
    searchPattern
      ? sql`SELECT * FROM whatsapp_chats WHERE instance_name = ${instance} AND status = 'resolved'
            AND (name ILIKE ${searchPattern} OR protocol ILIKE ${searchPattern} OR subject ILIKE ${searchPattern})
            ORDER BY closed_at DESC NULLS LAST LIMIT ${Number(limit)} OFFSET ${Number(offset)}`
      : sql`SELECT * FROM whatsapp_chats WHERE instance_name = ${instance} AND status = 'resolved'
            ORDER BY closed_at DESC NULLS LAST LIMIT ${Number(limit)} OFFSET ${Number(offset)}`
  );
  res.json(rows);
});

// ── Live overview ─────────────────────────────────────────────────────────────

router.get("/overview/:instance", async (req, res) => {
  const { instance } = req.params;
  const [active, queue, pending, resolved, todayResolved] = await Promise.all([
    queryRows(sql`SELECT COUNT(*) as c FROM whatsapp_chats WHERE instance_name = ${instance} AND status = 'attending'`),
    queryRows(sql`SELECT COUNT(*) as c FROM whatsapp_chats WHERE instance_name = ${instance} AND status = 'open'`),
    queryRows(sql`SELECT COUNT(*) as c FROM whatsapp_chats WHERE instance_name = ${instance} AND status = 'pending'`),
    queryRows(sql`SELECT COUNT(*) as c FROM whatsapp_chats WHERE instance_name = ${instance} AND status = 'resolved'`),
    queryRows(sql`SELECT COUNT(*) as c FROM whatsapp_chats WHERE instance_name = ${instance} AND status = 'resolved' AND closed_at::date = CURRENT_DATE`),
  ]);
  const unread = await queryRows(sql`SELECT SUM(unread_count) as u FROM whatsapp_chats WHERE instance_name = ${instance}`);
  const agents = await queryRows(sql`
    SELECT assigned_to, COUNT(*) as chats FROM whatsapp_chats
    WHERE instance_name = ${instance} AND status = 'attending' AND assigned_to IS NOT NULL
    GROUP BY assigned_to ORDER BY chats DESC
  `);
  res.json({
    attending: Number((active[0] as any)?.c ?? 0),
    queue: Number((queue[0] as any)?.c ?? 0),
    pending: Number((pending[0] as any)?.c ?? 0),
    resolved: Number((resolved[0] as any)?.c ?? 0),
    todayResolved: Number((todayResolved[0] as any)?.c ?? 0),
    unreadTotal: Number((unread[0] as any)?.u ?? 0),
    agentLoad: agents,
  });
});

export default router;
