import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

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

// POST /whatsapp/webhook/:instance
router.post("/webhook/:instance", async (req, res) => {
  const { instance } = req.params;
  const payload = req.body;

  // Log the payload for debugging
  console.log("[webhook] event payload:", JSON.stringify(payload).slice(0, 600));

  const event = payload?.event ?? payload?.type;

  try {
    // Evolution API v2 payload formats:
    // event: "send.message" | "messages.upsert" — data is a single message or array
    const isMessageEvent =
      event === "send.message" ||
      event === "messages.upsert" ||
      event === "message" ||
      event === "MESSAGES_UPSERT" ||
      event === "SEND_MESSAGE";

    if (isMessageEvent) {
      // Normalize to array
      const raw = payload?.data;
      const messages: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.messages)
        ? raw.messages
        : raw ? [raw] : [];

      for (const m of messages) {
        const key = m.key ?? {};
        const remoteJid = normalizeJid(key?.remoteJid ?? m.remoteJid ?? "");
        if (!remoteJid) continue;

        const fromMe: boolean = key?.fromMe ?? m.fromMe ?? false;
        const messageId: string = key?.id ?? m.id ?? `${Date.now()}-${Math.random()}`;
        const timestamp: number = m.messageTimestamp ?? m.timestamp ?? Math.floor(Date.now() / 1000);
        const pushName: string = m.pushName ?? "";
        const msgContent = m.message ?? {};
        const body: string = extractBody(msgContent);
        const type: string = msgType(msgContent);

        // Upsert message
        await db.execute(sql`
          INSERT INTO whatsapp_messages (id, instance_name, remote_jid, from_me, push_name, message_type, body, timestamp, raw)
          VALUES (${messageId}, ${instance}, ${remoteJid}, ${fromMe}, ${pushName}, ${type}, ${body}, ${timestamp}, ${JSON.stringify(m)}::jsonb)
          ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body, raw = EXCLUDED.raw
        `);

        // Upsert chat
        // For groups: name comes from the group JID info, NOT from pushName (which is sender name)
        const isGroupJid = remoteJid.endsWith("@g.us");
        const chatName: string | null = isGroupJid
          ? (m.name ?? null)          // group name if provided in payload
          : (!fromMe && pushName ? pushName : null);
        await db.execute(sql`
          INSERT INTO whatsapp_chats (instance_name, remote_jid, name, push_name, last_message, last_message_time, unread_count, status, protocol, updated_at)
          VALUES (${instance}, ${remoteJid}, ${chatName}, ${isGroupJid ? null : pushName}, ${body}, ${timestamp}, ${fromMe ? 0 : 1}, 'open', LPAD(nextval('whatsapp_protocol_seq')::TEXT, 6, '0'), NOW())
          ON CONFLICT (instance_name, remote_jid) DO UPDATE
          SET last_message = CASE WHEN EXCLUDED.last_message_time >= whatsapp_chats.last_message_time THEN EXCLUDED.last_message ELSE whatsapp_chats.last_message END,
              last_message_time = GREATEST(EXCLUDED.last_message_time, whatsapp_chats.last_message_time),
              push_name = CASE WHEN ${isGroupJid} THEN whatsapp_chats.push_name ELSE COALESCE(EXCLUDED.push_name, whatsapp_chats.push_name) END,
              name = CASE WHEN ${isGroupJid} THEN COALESCE(whatsapp_chats.name, EXCLUDED.name) ELSE COALESCE(EXCLUDED.name, whatsapp_chats.name) END,
              unread_count = whatsapp_chats.unread_count + (CASE WHEN ${fromMe} THEN 0 ELSE 1 END),
              updated_at = NOW()
        `);

        console.log(`[webhook] saved msg ${messageId} for ${remoteJid} fromMe=${fromMe}`);

        // For groups, fetch group name from Evolution if not stored yet
        if (isGroupJid) {
          const existing = await db.execute(sql`
            SELECT name FROM whatsapp_chats WHERE instance_name = ${instance} AND remote_jid = ${remoteJid} AND name IS NOT NULL LIMIT 1
          `);
          if (!existing.rows[0]?.name) {
            // Try to get group info from Evolution
            try {
              const evoUrl = process.env.EVOLUTION_API_URL ?? "http://localhost:8080";
              const evoKey = process.env.EVOLUTION_API_KEY ?? "";
              if (evoKey) {
                const resp = await fetch(`${evoUrl}/group/findGroupInfos/${instance}?groupJid=${remoteJid}`, {
                  headers: { apikey: evoKey },
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
      }
    }

    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[whatsapp-webhook] error:", err?.message);
    res.status(200).json({ ok: false }); // always 200 so Evolution doesn't retry
  }
});

// GET /whatsapp/chats/:instance — list chats from our DB
router.get("/chats/:instance", async (req, res) => {
  const { instance } = req.params;
  const result = await db.execute(sql`
    SELECT * FROM whatsapp_chats
    WHERE instance_name = ${instance}
    ORDER BY last_message_time DESC
    LIMIT 200
  `);
  res.json(result.rows);
});

// GET /whatsapp/messages/:instance/:jid — list messages from our DB
router.get("/messages/:instance/:jid", async (req, res) => {
  const { instance, jid } = req.params;
  const result = await db.execute(sql`
    SELECT * FROM whatsapp_messages
    WHERE instance_name = ${instance} AND remote_jid = ${jid}
    ORDER BY timestamp ASC
    LIMIT 100
  `);
  res.json(result.rows);
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
  const result = await db.execute(sql`SELECT * FROM whatsapp_chats WHERE instance_name = ${instance} AND remote_jid = ${jid}`);
  res.json(result.rows[0] ?? { ok: true });
});

// GET /whatsapp/tags/:instance
router.get("/tags/:instance", async (req, res) => {
  const { instance } = req.params;
  const result = await db.execute(sql`SELECT * FROM whatsapp_tags WHERE instance_name = ${instance} ORDER BY name`);
  res.json(result.rows);
});

// POST /whatsapp/tags/:instance
router.post("/tags/:instance", async (req, res) => {
  const { instance } = req.params;
  const { name, color } = req.body as { name: string; color?: string };
  const result = await db.execute(sql`
    INSERT INTO whatsapp_tags (instance_name, name, color) VALUES (${instance}, ${name}, ${color ?? "#6366f1"})
    ON CONFLICT (instance_name, name) DO UPDATE SET color = EXCLUDED.color RETURNING *
  `);
  res.json(result.rows[0]);
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
  const result = await db.execute(sql`SELECT * FROM whatsapp_quick_replies WHERE instance_name = ${instance} ORDER BY shortcut`);
  res.json(result.rows);
});

router.post("/quick-replies/:instance", async (req, res) => {
  const { instance } = req.params;
  const { shortcut, title, body } = req.body as { shortcut: string; title: string; body: string };
  const result = await db.execute(sql`
    INSERT INTO whatsapp_quick_replies (instance_name, shortcut, title, body)
    VALUES (${instance}, ${shortcut}, ${title}, ${body})
    ON CONFLICT (instance_name, shortcut) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body
    RETURNING *
  `);
  res.json(result.rows[0]);
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
  const evoUrl = (process.env.EVOLUTION_API_URL ?? "http://localhost:8080").replace(/\/+$/, "");
  const evoKey = process.env.EVOLUTION_API_KEY ?? "";
  try {
    const upstream = await fetch(`${evoUrl}/message/sendMedia/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evoKey },
      body: JSON.stringify({ number, mediatype, mimetype, caption: caption ?? "", fileName: fileName ?? "file", media }),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message });
  }
});

// ── Departments ──────────────────────────────────────────────────────────────

router.get("/departments/:instance", async (req, res) => {
  const { instance } = req.params;
  const result = await db.execute(sql`SELECT * FROM whatsapp_departments WHERE instance_name = ${instance} ORDER BY name`);
  res.json(result.rows);
});

router.post("/departments/:instance", async (req, res) => {
  const { instance } = req.params;
  const { name, color } = req.body as { name: string; color?: string };
  const result = await db.execute(sql`
    INSERT INTO whatsapp_departments (instance_name, name, color) VALUES (${instance}, ${name}, ${color ?? "#6366f1"})
    ON CONFLICT (instance_name, name) DO UPDATE SET color = EXCLUDED.color RETURNING *
  `);
  res.json(result.rows[0]);
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
  const result = await db.execute(sql`SELECT * FROM whatsapp_chats WHERE instance_name = ${instance} AND remote_jid = ${jid}`);
  res.json(result.rows[0] ?? { ok: true });
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
  const result = await db.execute(sql`SELECT * FROM whatsapp_chats WHERE instance_name = ${instance} AND remote_jid = ${jid}`);
  res.json(result.rows[0]);
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
  const result = await db.execute(sql`SELECT * FROM whatsapp_chats WHERE instance_name = ${instance} AND remote_jid = ${jid}`);
  res.json(result.rows[0]);
});

// ── Metrics ──────────────────────────────────────────────────────────────────

router.get("/metrics/:instance", async (req, res) => {
  const { instance } = req.params;

  const totals = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM whatsapp_chats WHERE instance_name = ${instance}
    GROUP BY status
  `);

  const unread = await db.execute(sql`
    SELECT SUM(unread_count) as total FROM whatsapp_chats WHERE instance_name = ${instance}
  `);

  const today = new Date().toISOString().split("T")[0];
  const todayMsgs = await db.execute(sql`
    SELECT COUNT(*) as count FROM whatsapp_messages
    WHERE instance_name = ${instance} AND created_at::date = ${today}::date
  `);

  const recentChats = await db.execute(sql`
    SELECT DATE(updated_at) as day, COUNT(*) as count
    FROM whatsapp_chats WHERE instance_name = ${instance}
      AND updated_at >= NOW() - INTERVAL '7 days'
    GROUP BY day ORDER BY day ASC
  `);

  const tagStats = await db.execute(sql`
    SELECT unnest(tags) as tag, COUNT(*) as count
    FROM whatsapp_chats WHERE instance_name = ${instance} AND array_length(tags,1) > 0
    GROUP BY tag ORDER BY count DESC LIMIT 10
  `);

  res.json({
    byStatus: totals.rows,
    unreadTotal: Number((unread.rows[0] as any)?.total ?? 0),
    todayMessages: Number((todayMsgs.rows[0] as any)?.count ?? 0),
    recentActivity: recentChats.rows,
    topTags: tagStats.rows,
  });
});

// POST /whatsapp/chats/:instance/fix-group-names — fetches group names from Evolution and updates DB
router.post("/chats/:instance/fix-group-names", async (req, res) => {
  const { instance } = req.params;
  const evoUrl = (process.env.EVOLUTION_API_URL ?? "http://localhost:8080").replace(/\/+$/, "");
  const evoKey = process.env.EVOLUTION_API_KEY ?? "";

  const chats = await db.execute(sql`
    SELECT remote_jid FROM whatsapp_chats WHERE instance_name = ${instance}
  `);

  let fixed = 0;
  for (const row of chats.rows as any[]) {
    const jid: string = row.remote_jid;
    const isGroupJid = jid.endsWith("@g.us");

    try {
      // Fetch profile picture for all chats
      const phone = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
      const picRes = await fetch(`${evoUrl}/chat/fetchProfilePictureUrl/${instance}`, {
        method: "POST",
        headers: { apikey: evoKey, "Content-Type": "application/json" },
        body: JSON.stringify({ number: phone }),
      });
      if (picRes.ok) {
        const picData = await picRes.json() as any;
        const picUrl: string | null = picData?.profilePictureUrl ?? null;
        if (picUrl) {
          await db.execute(sql`UPDATE whatsapp_chats SET profile_pic = ${picUrl} WHERE instance_name = ${instance} AND remote_jid = ${jid}`);
        }
      }
    } catch { /* ignore */ }

    // For groups also fix name
    if (isGroupJid) {
      try {
        const r = await fetch(`${evoUrl}/group/findGroupInfos/${instance}?groupJid=${encodeURIComponent(jid)}`, {
          headers: { apikey: evoKey },
        });
        if (r.ok) {
          const info = await r.json() as any;
          const name: string | null = info?.subject ?? info?.name ?? null;
          if (name) {
            await db.execute(sql`UPDATE whatsapp_chats SET name = ${name} WHERE instance_name = ${instance} AND remote_jid = ${jid}`);
            fixed++;
          }
        }
      } catch { /* ignore */ }
    }
  }

  res.json({ ok: true, fixed });
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
  const result = await db.execute(sql`
    SELECT * FROM whatsapp_internal_comments
    WHERE instance_name = ${instance} AND remote_jid = ${jid}
    ORDER BY created_at ASC
  `);
  res.json(result.rows);
});

router.post("/comments/:instance/:jid", async (req, res) => {
  const { instance, jid } = req.params;
  const { author, body } = req.body as { author: string; body: string };
  const result = await db.execute(sql`
    INSERT INTO whatsapp_internal_comments (instance_name, remote_jid, author, body)
    VALUES (${instance}, ${jid}, ${author}, ${body})
    RETURNING *
  `);
  res.json(result.rows[0]);
});

// ── Scheduled messages ────────────────────────────────────────────────────────

router.get("/scheduled/:instance", async (req, res) => {
  const { instance } = req.params;
  const result = await db.execute(sql`
    SELECT * FROM whatsapp_scheduled
    WHERE instance_name = ${instance} AND sent = FALSE AND scheduled_at > NOW()
    ORDER BY scheduled_at ASC
  `);
  res.json(result.rows);
});

router.post("/scheduled/:instance", async (req, res) => {
  const { instance } = req.params;
  const { remoteJid, body, scheduledAt, createdBy } = req.body as {
    remoteJid: string; body: string; scheduledAt: string; createdBy?: string;
  };
  const result = await db.execute(sql`
    INSERT INTO whatsapp_scheduled (instance_name, remote_jid, body, scheduled_at, created_by)
    VALUES (${instance}, ${remoteJid}, ${body}, ${scheduledAt}::TIMESTAMPTZ, ${createdBy ?? null})
    RETURNING *
  `);
  res.json(result.rows[0]);
});

router.delete("/scheduled/:instance/:id", async (req, res) => {
  const { instance, id } = req.params;
  await db.execute(sql`DELETE FROM whatsapp_scheduled WHERE id = ${Number(id)} AND instance_name = ${instance}`);
  res.json({ ok: true });
});

// ── Contact custom fields ─────────────────────────────────────────────────────

router.get("/contact-fields/:instance/:jid", async (req, res) => {
  const { instance, jid } = req.params;
  const result = await db.execute(sql`
    SELECT field_key, field_value FROM whatsapp_contact_fields
    WHERE instance_name = ${instance} AND remote_jid = ${jid}
  `);
  const fields: Record<string, string> = {};
  for (const row of result.rows as any[]) fields[row.field_key] = row.field_value;
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
  const result = await db.execute(
    searchPattern
      ? sql`SELECT * FROM whatsapp_chats WHERE instance_name = ${instance} AND status = 'resolved'
            AND (name ILIKE ${searchPattern} OR protocol ILIKE ${searchPattern} OR subject ILIKE ${searchPattern})
            ORDER BY closed_at DESC NULLS LAST LIMIT ${Number(limit)} OFFSET ${Number(offset)}`
      : sql`SELECT * FROM whatsapp_chats WHERE instance_name = ${instance} AND status = 'resolved'
            ORDER BY closed_at DESC NULLS LAST LIMIT ${Number(limit)} OFFSET ${Number(offset)}`
  );
  res.json(result.rows);
});

// ── Live overview ─────────────────────────────────────────────────────────────

router.get("/overview/:instance", async (req, res) => {
  const { instance } = req.params;
  const [active, queue, pending, resolved, todayResolved] = await Promise.all([
    db.execute(sql`SELECT COUNT(*) as c FROM whatsapp_chats WHERE instance_name = ${instance} AND status = 'attending'`),
    db.execute(sql`SELECT COUNT(*) as c FROM whatsapp_chats WHERE instance_name = ${instance} AND status = 'open'`),
    db.execute(sql`SELECT COUNT(*) as c FROM whatsapp_chats WHERE instance_name = ${instance} AND status = 'pending'`),
    db.execute(sql`SELECT COUNT(*) as c FROM whatsapp_chats WHERE instance_name = ${instance} AND status = 'resolved'`),
    db.execute(sql`SELECT COUNT(*) as c FROM whatsapp_chats WHERE instance_name = ${instance} AND status = 'resolved' AND closed_at::date = CURRENT_DATE`),
  ]);
  const unread = await db.execute(sql`SELECT SUM(unread_count) as u FROM whatsapp_chats WHERE instance_name = ${instance}`);
  const agents = await db.execute(sql`
    SELECT assigned_to, COUNT(*) as chats FROM whatsapp_chats
    WHERE instance_name = ${instance} AND status = 'attending' AND assigned_to IS NOT NULL
    GROUP BY assigned_to ORDER BY chats DESC
  `);
  res.json({
    attending: Number((active.rows[0] as any)?.c ?? 0),
    queue: Number((queue.rows[0] as any)?.c ?? 0),
    pending: Number((pending.rows[0] as any)?.c ?? 0),
    resolved: Number((resolved.rows[0] as any)?.c ?? 0),
    todayResolved: Number((todayResolved.rows[0] as any)?.c ?? 0),
    unreadTotal: Number((unread.rows[0] as any)?.u ?? 0),
    agentLoad: agents.rows,
  });
});

export default router;
