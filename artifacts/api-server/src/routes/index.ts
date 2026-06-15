import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import categoriesRouter from "./categories";
import revenuesRouter from "./revenues";
import expensesRouter from "./expenses";
import billingsRouter from "./billings";
import billingsPdfRouter from "./billings-pdf";
import dashboardRouter from "./dashboard";
import payablesRouter from "./payables";
import evolutionProxyRouter from "./evolution-proxy";
import whatsappWebhookRouter from "./whatsapp-webhook";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/clients", clientsRouter);
router.use("/categories", categoriesRouter);
router.use("/revenues", revenuesRouter);
router.use("/expenses", expensesRouter);
router.use("/billings", billingsRouter);
router.use("/billings", billingsPdfRouter);
router.use("/dashboard", dashboardRouter);
router.use("/payables", payablesRouter);
router.use("/evolution", evolutionProxyRouter);
router.use("/whatsapp", whatsappWebhookRouter);

export default router;
