import { Router } from 'express';
import authRoutes from './authRoutes.js';
import productRoutes from './productRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import orderRoutes from './orderRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import trackingRoutes from './trackingRoutes.js';
import cartRoutes from './cartRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import supplierProductRoutes from './supplierProductRoutes.js';
import supplierOrderRoutes from './supplierOrderRoutes.js';
import adminRoutes from './adminRoutes.js';
import rfqRoutes from './rfqRoutes.js';
import escrowRoutes from './escrowRoutes.js';
import disputeRoutes from './disputeRoutes.js';
import reviewRoutes from './reviewRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/tracking', trackingRoutes);
router.use('/cart', cartRoutes);
router.use('/upload', uploadRoutes);
router.use('/supplier/products', supplierProductRoutes);
router.use('/supplier/orders', supplierOrderRoutes);
router.use('/admin', adminRoutes);
router.use('/rfq', rfqRoutes);
router.use('/escrow', escrowRoutes);
router.use('/disputes', disputeRoutes);
router.use('/reviews', reviewRoutes);

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'TradeSphere Backend API',
    database: 'MySQL connected',
  });
});


export default router;
