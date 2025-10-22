import { Router } from 'express';
import { sales, salesByCustomer, topProducts, aiRecs } from '../controllers/reports.controller';


const router = Router();


router.get('/sales', sales);
router.get('/sales-by-customer', salesByCustomer);
router.get('/top-products', topProducts);
router.get('/ai-recs', aiRecs);

export default router;
