import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import categoriesRouter from "./categories";
import revenuesRouter from "./revenues";
import expensesRouter from "./expenses";
import billingsRouter from "./billings";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/clients", clientsRouter);
router.use("/categories", categoriesRouter);
router.use("/revenues", revenuesRouter);
router.use("/expenses", expensesRouter);
router.use("/billings", billingsRouter);
router.use("/dashboard", dashboardRouter);

export default router;
