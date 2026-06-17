import { Router } from "express";
import PDFDocument from "pdfkit";
import { db, billingsTable, billingItemsTable, clientsTable, categoriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

router.get("/:id/pdf", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);

  const rows = await db.select({
    billing: billingsTable,
    clientName: clientsTable.name,
    clientDocument: clientsTable.document,
    clientEmail: clientsTable.email,
    clientPhone: clientsTable.phone,
    categoryName: categoriesTable.name,
  }).from(billingsTable)
    .leftJoin(clientsTable, eq(billingsTable.clientId, clientsTable.id))
    .leftJoin(categoriesTable, eq(billingsTable.categoryId, categoriesTable.id))
    .where(and(eq(billingsTable.id, id), eq(billingsTable.userId, userId)));

  if (!rows[0]) {
    return res.status(404).json({ error: "Cobrança não encontrada" });
  }

  const items = await db.select().from(billingItemsTable)
    .where(eq(billingItemsTable.billingId, id));

  const { billing, clientName, clientDocument, clientEmail, clientPhone, categoryName } = rows[0];
  const now = new Date().toISOString().split("T")[0];
  let status = billing.status;
  if (status === "pendente" && billing.dueDate < now) status = "atrasado";

  const monthLabel = `${MONTH_NAMES[billing.month - 1]}/${billing.year}`;
  const fileLabel = (clientName ?? billing.description ?? "cobranca").replace(/\s+/g, "-").toLowerCase();
  const fileName = `cobranca-${fileLabel}-${billing.month}-${billing.year}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  doc.pipe(res);

  const PAGE_WIDTH = doc.page.width;
  const MARGIN = 50;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

  const PRIMARY = "#1e293b";
  const ACCENT = "#3b82f6";
  const MUTED = "#64748b";
  const LIGHT_BG = "#f8fafc";
  const BORDER = "#e2e8f0";

  // ── Header bar ──────────────────────────────────────────────────────────
  doc.rect(0, 0, PAGE_WIDTH, 90).fill(PRIMARY);

  doc.fontSize(22).fillColor("#ffffff").font("Helvetica-Bold")
    .text("COBRANÇA", MARGIN, 28);

  doc.fontSize(10).fillColor("#94a3b8").font("Helvetica")
    .text(`Referência: ${monthLabel}`, MARGIN, 55);

  doc.fontSize(11).fillColor("#ffffff").font("Helvetica-Bold")
    .text(`Nº ${String(billing.id).padStart(5, "0")}`, PAGE_WIDTH - MARGIN - 80, 38, { width: 80, align: "right" });

  // ── Info cards row ──────────────────────────────────────────────────────
  const cardY = 110;
  const cardH = 65;
  const cardW = (CONTENT_WIDTH - 15) / 3;

  function drawInfoCard(x: number, label: string, value: string, accent?: boolean) {
    doc.rect(x, cardY, cardW, cardH).fill(accent ? ACCENT : LIGHT_BG);
    doc.fontSize(8).fillColor(accent ? "rgba(255,255,255,0.75)" : MUTED).font("Helvetica")
      .text(label.toUpperCase(), x + 12, cardY + 10, { width: cardW - 20 });
    doc.fontSize(13).fillColor(accent ? "#ffffff" : PRIMARY).font("Helvetica-Bold")
      .text(value, x + 12, cardY + 26, { width: cardW - 20 });
  }

  const statusLabel = status === "pago" ? "PAGO" : status === "atrasado" ? "ATRASADO" : "PENDENTE";
  drawInfoCard(MARGIN, "Vencimento", formatDateBR(billing.dueDate));
  drawInfoCard(MARGIN + cardW + 7.5, "Status", statusLabel, status !== "pendente");
  drawInfoCard(MARGIN + (cardW + 7.5) * 2, "Total a Pagar", formatBRL(parseFloat(billing.totalAmount)), true);

  // ── Client section ──────────────────────────────────────────────────────
  const clientY = cardY + cardH + 25;
  doc.fontSize(9).fillColor(MUTED).font("Helvetica").text(clientName ? "CLIENTE" : "DESCRIÇÃO", MARGIN, clientY);
  doc.moveTo(MARGIN, clientY + 12).lineTo(MARGIN + CONTENT_WIDTH, clientY + 12).stroke(BORDER);

  doc.fontSize(13).fillColor(PRIMARY).font("Helvetica-Bold")
    .text(clientName ?? billing.description ?? "—", MARGIN, clientY + 20);

  let clientInfoY = clientY + 38;
  if (clientName && billing.description) {
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
      .text(`Descrição: ${billing.description}`, MARGIN, clientInfoY);
    clientInfoY += 14;
  }
  if (clientDocument) {
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
      .text(`CPF/CNPJ: ${clientDocument}`, MARGIN, clientInfoY);
    clientInfoY += 14;
  }
  if (clientEmail) {
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
      .text(`E-mail: ${clientEmail}`, MARGIN, clientInfoY);
    clientInfoY += 14;
  }
  if (clientPhone) {
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
      .text(`Telefone: ${clientPhone}`, MARGIN, clientInfoY);
    clientInfoY += 14;
  }
  if (categoryName) {
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
      .text(`Categoria: ${categoryName}`, MARGIN, clientInfoY);
    clientInfoY += 14;
  }

  // ── Items table ─────────────────────────────────────────────────────────
  const tableY = clientInfoY + 20;
  doc.fontSize(9).fillColor(MUTED).font("Helvetica").text("ITENS DA COBRANÇA", MARGIN, tableY);
  doc.moveTo(MARGIN, tableY + 12).lineTo(MARGIN + CONTENT_WIDTH, tableY + 12).stroke(BORDER);

  const COL_DESC = MARGIN;
  const COL_TYPE = MARGIN + CONTENT_WIDTH * 0.62;
  const COL_AMT = MARGIN + CONTENT_WIDTH * 0.82;
  const COL_DESC_W = CONTENT_WIDTH * 0.6;
  const COL_TYPE_W = CONTENT_WIDTH * 0.18;
  const COL_AMT_W = CONTENT_WIDTH * 0.18;

  const headerY = tableY + 18;
  doc.rect(MARGIN, headerY, CONTENT_WIDTH, 20).fill("#f1f5f9");
  doc.fontSize(8).fillColor(MUTED).font("Helvetica-Bold")
    .text("DESCRIÇÃO", COL_DESC + 6, headerY + 6, { width: COL_DESC_W })
    .text("TIPO", COL_TYPE, headerY + 6, { width: COL_TYPE_W, align: "center" })
    .text("VALOR", COL_AMT, headerY + 6, { width: COL_AMT_W, align: "right" });

  let rowY = headerY + 22;
  const ROW_H = 22;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i % 2 === 1) {
      doc.rect(MARGIN, rowY - 3, CONTENT_WIDTH, ROW_H).fill("#fafafa");
    }
    const typeLabel = item.itemType === "honorario" ? "Honorário" : item.itemType === "despesa" ? "Despesa" : "Lançamento";
    doc.fontSize(9).fillColor(PRIMARY).font("Helvetica")
      .text(item.description, COL_DESC + 6, rowY, { width: COL_DESC_W - 6 });
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
      .text(typeLabel, COL_TYPE, rowY, { width: COL_TYPE_W, align: "center" });
    doc.fontSize(9).fillColor(PRIMARY).font("Helvetica-Bold")
      .text(formatBRL(parseFloat(item.amount)), COL_AMT, rowY, { width: COL_AMT_W, align: "right" });
    rowY += ROW_H;
  }

  // ── Totals ──────────────────────────────────────────────────────────────
  rowY += 8;
  doc.moveTo(MARGIN, rowY).lineTo(MARGIN + CONTENT_WIDTH, rowY).stroke(BORDER);
  rowY += 12;

  const totalsX = MARGIN + CONTENT_WIDTH * 0.58;
  const totalsW = CONTENT_WIDTH * 0.42;

  function drawTotalRow(label: string, value: string, bold = false, highlight = false) {
    if (highlight) {
      doc.rect(totalsX - 10, rowY - 4, totalsW + 10, 24).fill(PRIMARY);
    }
    doc.fontSize(bold ? 11 : 9)
      .fillColor(highlight ? "#ffffff" : bold ? PRIMARY : MUTED)
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .text(label, totalsX, rowY, { width: totalsW * 0.55 });
    doc.fontSize(bold ? 11 : 9)
      .fillColor(highlight ? "#ffffff" : bold ? PRIMARY : MUTED)
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .text(value, totalsX + totalsW * 0.55, rowY, { width: totalsW * 0.45, align: "right" });
    rowY += bold ? 30 : 18;
  }

  drawTotalRow("Honorários mensais:", formatBRL(parseFloat(billing.monthlyFee)));
  drawTotalRow("Reembolso de despesas:", formatBRL(parseFloat(billing.expensesTotal)));
  drawTotalRow("TOTAL:", formatBRL(parseFloat(billing.totalAmount)), true, true);

  // ── Footer ──────────────────────────────────────────────────────────────
  const footerY = doc.page.height - 60;
  doc.rect(0, footerY, PAGE_WIDTH, 60).fill(LIGHT_BG);
  doc.moveTo(0, footerY).lineTo(PAGE_WIDTH, footerY).stroke(BORDER);

  if (billing.paidAt) {
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
      .text(`Pago em: ${formatDateBR(billing.paidAt)}`, MARGIN, footerY + 10);
  }

  doc.fontSize(8).fillColor(MUTED).font("Helvetica")
    .text(
      `Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      MARGIN, footerY + (billing.paidAt ? 26 : 22),
    );

  doc.end();
  return;
});

export default router;
