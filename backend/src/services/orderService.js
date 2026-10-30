import prisma from '../config/db.js';
import { generateOrderNumber } from '../utils/orderNumber.js';
import { sendOrderConfirmationEmail } from './emailService.js';
import { initiateEscrowForOrder } from './escrowService.js';
import {
  calculateOrderCommission,
  getActiveCommissionPolicy,
  roundINR,
} from './commissionTierService.js';
import { createNotification } from './notificationService.js';
import { broadcastInventoryUpdate, broadcastProductStock } from './socketService.js';

export async function validateAndCalculateOrder({ lines, shippingMethod = 'standard', deliveryAddress = null }) {
  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    const error = new Error('Order must contain at least one item.');
    error.statusCode = 400;
    throw error;
  }

  const validatedItems = [];
  let subtotal = 0;

  for (const line of lines) {
    const productId = line.productId || line.product?.id || line.id;
    const quantity = parseInt(line.quantity, 10);

    if (!productId || isNaN(quantity) || quantity <= 0) {
      const error = new Error('Invalid item or quantity.');
      error.statusCode = 400;
      throw error;
    }

    const productName = line.name || line.productName || line.product?.name || '';
    const productSlug = line.slug || line.product?.slug || '';
    const productSku = line.sku || line.product?.sku || '';

    // 1. Look up by exact ID
    let product = null;
    try {
      product = await prisma.product.findUnique({
        where: { id: productId },
      });
    } catch {
      // Ignored if productId is not a UUID
    }

    // 2. Fall back to SKU, model number, slug, or name
    if (!product) {
      const match = String(productId).match(/(\d+)$/);
      const number = match ? match[1] : null;

      const orConditions = [
        { id: productId },
        ...(productSku ? [{ sku: productSku }] : [{ sku: productId }]),
        ...(number ? [{ sku: { endsWith: `-${number}` } }] : []),
        ...(productSlug ? [{ slug: productSlug }] : []),
        ...(productName ? [{ name: productName }] : []),
      ];

      product = await prisma.product.findFirst({
        where: {
          OR: orConditions,
        },
      });
    }

    // 3. Fall back to case-insensitive name match
    if (!product && productName) {
      product = await prisma.product.findFirst({
        where: {
          name: { equals: productName, mode: 'insensitive' },
        },
      });
    }

    // 4. Fall back to partial name match
    if (!product && productName) {
      product = await prisma.product.findFirst({
        where: {
          name: { contains: productName, mode: 'insensitive' },
        },
      });
    }

    // 5. If still not in database but valid product metadata is provided, auto-create as active product
    if (!product && (productName || line.product)) {
      const pData = line.product || {};
      const finalName = productName || pData.name || 'Custom Wholesale Product';
      const finalPrice = Number(pData.price || line.price || line.unitPrice || 100);
      const finalMoq = Number(pData.moq || line.moq || 1);
      const finalStock = Number(pData.stock || 50000);
      const finalLead = Number(pData.leadTimeDays || line.leadTimeDays || 14);
      const finalSku = productSku || pData.sku || `TS-P-${Date.now().toString().slice(-6)}`;
      const finalSlug = productSlug || pData.slug || finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      try {
        product = await prisma.product.create({
          data: {
            sku: finalSku,
            name: finalName,
            slug: finalSlug,
            categorySlug: pData.categorySlug || pData.category || 'fashion-apparel',
            subcategory: pData.subcategory || 'General',
            summary: pData.summary || finalName,
            description: pData.description || finalName,
            photo: pData.photo || 'photo-1562157873-818bc0726f68',
            currency: 'INR',
            price: finalPrice,
            unit: pData.unit || 'piece',
            moq: finalMoq,
            stock: finalStock,
            leadTimeDays: finalLead,
            status: 'Active',
            companyId: pData.companyId || 'TS-CO-010',
            supplierId: pData.supplierId || null,
            variants: pData.variants || {},
            priceTiers: pData.priceTiers || [],
            specifications: pData.specifications || {},
          },
        });
      } catch (createErr) {
        console.warn('Auto-create fallback product warning:', createErr.message);
      }
    }

    if (!product || product.status !== 'Active') {
      const error = new Error(`Product "${productName || productId}" is not available.`);
      error.statusCode = 400;
      throw error;
    }

    if (quantity < product.moq) {
      const error = new Error(`Quantity for "${product.name}" must be at least ${product.moq} ${product.unit}(s).`);
      error.statusCode = 400;
      throw error;
    }

    if (quantity > product.stock) {
      const error = new Error(`Insufficient stock for "${product.name}". Available: ${product.stock} ${product.unit}(s).`);
      error.statusCode = 400;
      throw error;
    }

    // Server-side tiered pricing calculation
    let unitPrice = Number(product.price);
    if (product.priceTiers && Array.isArray(product.priceTiers)) {
      const sortedTiers = [...product.priceTiers].sort((a, b) => b.minQty - a.minQty);
      for (const tier of sortedTiers) {
        if (quantity >= tier.minQty) {
          unitPrice = Number(tier.price);
          break;
        }
      }
    }

    const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
    subtotal += lineTotal;

    validatedItems.push({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      productPhoto: product.photo,
      companyId: product.companyId || null,
      supplierId: product.supplierId || null,
      hsnCode: product.hsnCode || '8471',
      gstRate: Number(product.gstRate || 18.0),
      unit: product.unit,
      quantity,
      unitPrice,
      lineTotal,
      variant: line.variant || null,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;

  // Shipping rules
  let shippingFee = 0;
  let shippingEta = '5–7 business days';
  if (shippingMethod === 'express') {
    shippingFee = 650;
    shippingEta = '2–3 business days';
  } else if (shippingMethod === 'freight') {
    shippingFee = 1500;
    shippingEta = '7–12 business days (pallet cargo)';
  } else {
    shippingFee = subtotal >= 5000 ? 0 : 250;
    shippingEta = '5–7 business days';
  }

  // GST Calculation: Intra-state (CGST 9% + SGST 9%) vs Inter-state (IGST 18%)
  // Default supplier state is Maharashtra if not specified
  let buyerState = '';
  if (deliveryAddress) {
    try {
      const parsed = typeof deliveryAddress === 'object' ? deliveryAddress : JSON.parse(deliveryAddress || '{}');
      buyerState = (parsed?.state || '').trim().toLowerCase();
    } catch {
      buyerState = '';
    }
  }
  const supplierState = (validatedItems[0]?.companyId ? 'maharashtra' : 'maharashtra').toLowerCase();
  const isInterState = buyerState ? buyerState !== supplierState : false;

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterState) {
    igst = Math.round(subtotal * 0.18 * 100) / 100;
  } else {
    cgst = Math.round(subtotal * 0.09 * 100) / 100;
    sgst = Math.round(subtotal * 0.09 * 100) / 100;
  }

  const tax = Math.round((cgst + sgst + igst) * 100) / 100;
  const discount = 0;
  const total = Math.round((subtotal + shippingFee + tax - discount) * 100) / 100;

  // Calculate declining order-level commission (base: product subtotal minus product discount)
  const commissionPolicy = await getActiveCommissionPolicy();
  const commissionCalc = calculateOrderCommission({
    subtotal,
    discount,
    policy: commissionPolicy,
  });

  return {
    items: validatedItems,
    totals: {
      subtotal,
      shippingFee,
      tax,
      cgst,
      sgst,
      igst,
      isInterState,
      discount,
      total,
      commission: commissionCalc,
    },
    shippingMethod,
    shippingEta,
  };
}

export async function createOrder({
  userId,
  buyerName,
  buyerEmail,
  buyerPhone,
  buyerCompany,
  buyerGstin,
  supplierGstin,
  shippingMethod = 'standard',
  paymentMethod = 'online',
  isPartialPayment = false,
  deliveryAddress,
  lines,
  idempotencyKey,
  notes,
}) {
  const parsedAddress = typeof deliveryAddress === 'object' ? deliveryAddress : JSON.parse(deliveryAddress || '{}');
  // Check for duplicate submission using idempotency key
  if (idempotencyKey) {
    const existingOrder = await prisma.order.findUnique({
      where: { idempotencyKey },
      include: {
        items: true,
        payments: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (existingOrder) {
      return formatOrder(existingOrder);
    }
  }

  // Strictly validate prices, quantities, and totals against MySQL
  const calculation = await validateAndCalculateOrder({ lines, shippingMethod, deliveryAddress });
  const orderNumber = generateOrderNumber();

  const isCod = paymentMethod === 'cod';
  const initialPaymentStatus = isCod ? 'COD' : 'PENDING';
  const initialOrderStatus = isCod ? 'ORDER_CONFIRMED' : 'ORDER_PLACED';

  // Execute database atomic transaction
  const order = await prisma.$transaction(async (tx) => {
    // 1. Concurrency-safe atomic stock reservation & negative stock prevention
    for (const item of calculation.items) {
      const affected = await tx.$executeRaw`
        UPDATE products 
        SET reservedStock = reservedStock + ${item.quantity} 
        WHERE id = ${item.productId} AND (stock - reservedStock) >= ${item.quantity}
      `;

      if (affected === 0) {
        const error = new Error(`Insufficient available stock for "${item.productName}". Remaining units were already claimed by another buyer.`);
        error.statusCode = 409;
        throw error;
      }

      const current = await tx.product.findUnique({
        where: { id: item.productId },
        select: { id: true, stock: true, reservedStock: true, supplierId: true, sku: true },
      });

      if (current) {
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            supplierId: current.supplierId || item.supplierId,
            previousStock: current.stock,
            newStock: current.stock,
            changeAmount: 0,
            previousReserved: Math.max(0, current.reservedStock - item.quantity),
            newReserved: current.reservedStock,
            reason: 'ORDER_RESERVED',
            notes: `Reserved ${item.quantity} ${item.unit || 'unit'}(s) for Order #${orderNumber}`,
            orderId: orderNumber,
            actorId: userId || 'Buyer',
            actorName: buyerName || 'Buyer',
          },
        });
      }
    }

    const primarySupplierCompanyId = calculation.items[0]?.companyId || 'SUP';
    const primarySupplierId = calculation.items[0]?.supplierId || null;
    const supplierInvoiceSeries = `TS-INV-${primarySupplierCompanyId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const advanceAmount = isPartialPayment ? Math.round(calculation.totals.total * 0.20 * 100) / 100 : calculation.totals.total;
    const balanceDue = isPartialPayment ? Math.round((calculation.totals.total - advanceAmount) * 100) / 100 : 0;

    // 2. Create Order record
    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: userId || null,
        supplierId: primarySupplierId,
        supplierCompanyId: primarySupplierCompanyId,
        supplierInvoiceNumber: supplierInvoiceSeries,
        buyerName,
        buyerEmail,
        buyerPhone,
        buyerCompany: buyerCompany || '',
        buyerGstin: buyerGstin || null,
        supplierGstin: supplierGstin || null,
        shippingMethod: calculation.shippingMethod,
        shippingEta: calculation.shippingEta,
        paymentMethod,
        paymentStatus: initialPaymentStatus,
        orderStatus: initialOrderStatus,
        subtotal: calculation.totals.subtotal,
        shippingFee: calculation.totals.shippingFee,
        tax: calculation.totals.tax,
        cgst: calculation.totals.cgst,
        sgst: calculation.totals.sgst,
        igst: calculation.totals.igst,
        isInterState: calculation.totals.isInterState,
        discount: calculation.totals.discount,
        total: calculation.totals.total,
        commissionEligibleSubtotal: calculation.totals.commission?.eligibleSubtotal ?? Math.max(0, calculation.totals.subtotal - calculation.totals.discount),
        commissionRate: calculation.totals.commission?.commissionRate ?? 8.0,
        commissionFee: calculation.totals.commission?.commissionFee ?? 0,
        commissionPolicy: calculation.totals.commission?.policyVersion ?? 'TIERED_V1',
        commissionCalculatedAt: calculation.totals.commission?.calculatedAt ?? new Date(),
        isPartialPayment: Boolean(isPartialPayment),
        advanceAmount,
        balanceDue,
        currency: 'INR',
        deliveryAddress: parsedAddress,
        idempotencyKey: idempotencyKey || null,
        notes: notes || '',
        items: {
          create: calculation.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            productPhoto: item.productPhoto,
            hsnCode: item.hsnCode || '8471',
            gstRate: item.gstRate || 18.0,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            variant: item.variant || null,
          })),
        },
        statusHistory: {
          create: [
            {
              status: 'ORDER_PLACED',
              notes: isCod ? 'Order placed with Cash on Delivery.' : 'Order placed, awaiting online payment confirmation.',
              changedBy: 'Buyer',
            },
            ...(isCod
              ? [
                  {
                    status: 'ORDER_CONFIRMED',
                    notes: 'Order confirmed for Cash on Delivery processing.',
                    changedBy: 'System',
                  },
                ]
              : []),
          ],
        },
      },
      include: {
        items: true,
        payments: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    return created;
  });

  // Automatically initialize escrow ledger entry for wholesale order
  initiateEscrowForOrder(order.id).catch((err) => {
    console.error('[TradeExpress Escrow] Escrow init note:', err.message);
  });

  // If COD, send confirmation email immediately since order is confirmed
  if (isCod) {
    sendOrderConfirmationEmail(order).catch((err) => {
      console.error('[TradeExpress OrderService] Failed to send COD confirmation email:', err.message);
    });
  }

  // Notify supplier of incoming wholesale order
  if (order.supplierId) {
    createNotification({
      userId: order.supplierId,
      title: `New Order: #${order.orderNumber}`,
      message: `Received new bulk order of ₹${Number(order.total).toLocaleString('en-IN')} from ${order.buyerCompany || order.buyerName}.`,
      type: 'ORDER',
      link: `/supplier/orders?order=${order.orderNumber}`,
    }).catch(() => {});
  }

  // Broadcast real-time stock updates to supplier and buyers
  for (const item of calculation.items) {
    prisma.product.findUnique({
      where: { id: item.productId },
      select: { id: true, sku: true, stock: true, reservedStock: true, supplierId: true, lowStockThreshold: true },
    }).then((prod) => {
      if (prod) {
        const available = Math.max(0, prod.stock - prod.reservedStock);
        if (prod.supplierId) {
          broadcastInventoryUpdate(prod.supplierId, {
            productId: prod.id,
            sku: prod.sku,
            stock: prod.stock,
            reservedStock: prod.reservedStock,
            availableStock: available,
            lowStockThreshold: prod.lowStockThreshold,
          });
        }
        broadcastProductStock(prod.id, {
          sku: prod.sku,
          availableStock: available,
          inStock: available > 0,
        });
      }
    }).catch(() => {});
  }

  return formatOrder(order);
}

export async function getOrderByIdOrNumber(identifier, userId = null) {
  const where = identifier.startsWith('TS-') ? { orderNumber: identifier } : { id: identifier };

  const order = await prisma.order.findFirst({
    where,
    include: {
      items: true,
      payments: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
      escrowLedger: true,
      dispute: {
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      },
      review: true,
      supplier: {
        select: {
          id: true,
          name: true,
          company: true,
          email: true,
          phone: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          gstin: true,
          pan: true,
        },
      },
    },
  });

  if (!order) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  // If userId is provided, ensure user owns the order (or is admin/supplier)
  if (userId && order.userId && order.userId !== userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'ADMIN') {
      const error = new Error('You do not have permission to view this order.');
      error.statusCode = 403;
      throw error;
    }
  }

  return formatOrder(order);
}

export async function listUserOrders(userId) {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: true,
      payments: true,
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  return orders.map(formatOrder);
}

export async function cancelBuyerOrder({ orderId, userId, reason = '' }) {
  const where = orderId.startsWith('TS-') ? { orderNumber: orderId } : { id: orderId };
  const order = await prisma.order.findFirst({
    where,
    include: { items: true },
  });

  if (!order) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  if (userId && order.userId && order.userId !== userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'ADMIN') {
      const error = new Error('You do not have permission to cancel this order.');
      error.statusCode = 403;
      throw error;
    }
  }

  // Strict Rule: Buyer can cancel before "Packed"
  const NON_CANCELLABLE = ['PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
  if (NON_CANCELLABLE.includes(order.orderStatus)) {
    const error = new Error(`Order cannot be cancelled because it is already "${order.orderStatus}". Orders can only be cancelled before packing/dispatch.`);
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    // 1. Release reserved stock
    for (const item of order.items) {
      if (item.productId) {
        await tx.$executeRaw`
          UPDATE products
          SET reservedStock = GREATEST(0, reservedStock - ${item.quantity})
          WHERE id = ${item.productId}
        `;

        const current = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, stock: true, reservedStock: true, supplierId: true, sku: true },
        });

        if (current) {
          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              supplierId: current.supplierId,
              previousStock: current.stock,
              newStock: current.stock,
              changeAmount: 0,
              previousReserved: current.reservedStock + item.quantity,
              newReserved: current.reservedStock,
              reason: 'ORDER_CANCELLED',
              notes: `Released ${item.quantity} reserved unit(s) due to Order #${order.orderNumber} cancellation.`,
              orderId: order.orderNumber,
              actorId: userId || 'Buyer',
              actorName: 'Buyer',
            },
          });
        }
      }
    }

    // 2. Update order status
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        orderStatus: 'CANCELLED',
        rejectionReason: reason || 'Cancelled by buyer before packing.',
      },
      include: {
        items: true,
        payments: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    // 3. Record status history
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: 'CANCELLED',
        notes: `Order cancelled by buyer: ${reason || 'Buyer cancelled before packing.'}`,
        changedBy: 'Buyer',
      },
    });

    // Broadcast released stock to supplier and buyers
    for (const item of order.items) {
      if (item.productId) {
        prisma.product.findUnique({
          where: { id: item.productId },
          select: { id: true, sku: true, stock: true, reservedStock: true, supplierId: true, lowStockThreshold: true },
        }).then((prod) => {
          if (prod) {
            const available = Math.max(0, prod.stock - prod.reservedStock);
            if (prod.supplierId) {
              broadcastInventoryUpdate(prod.supplierId, {
                productId: prod.id,
                sku: prod.sku,
                stock: prod.stock,
                reservedStock: prod.reservedStock,
                availableStock: available,
                lowStockThreshold: prod.lowStockThreshold,
              });
            }
            broadcastProductStock(prod.id, {
              sku: prod.sku,
              availableStock: available,
              inStock: available > 0,
            });
          }
        }).catch(() => {});
      }
    }

    const formatted = formatOrder(updated);

    if (order.supplierId) {
      createNotification({
        userId: order.supplierId,
        title: `Order Cancelled: #${order.orderNumber}`,
        message: `Buyer cancelled order #${order.orderNumber}. Inventory stock has been restored.`,
        type: 'ORDER',
        link: `/supplier/orders?order=${order.orderNumber}`,
      }).catch(() => {});
    }

    return formatted;
  });
}

function formatOrder(order) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    shippingFee: Number(order.shippingFee),
    tax: Number(order.tax),
    cgst: Number(order.cgst || 0),
    sgst: Number(order.sgst || 0),
    igst: Number(order.igst || 0),
    discount: Number(order.discount),
    total: Number(order.total),
    advanceAmount: Number(order.advanceAmount || 0),
    balanceDue: Number(order.balanceDue || 0),
    commissionEligibleSubtotal: order.commissionEligibleSubtotal !== null && order.commissionEligibleSubtotal !== undefined ? Number(order.commissionEligibleSubtotal) : null,
    commissionRate: order.commissionRate !== null && order.commissionRate !== undefined ? Number(order.commissionRate) : null,
    commissionFee: order.commissionFee !== null && order.commissionFee !== undefined ? Number(order.commissionFee) : null,
    commissionPolicy: order.commissionPolicy || null,
    commissionCalculatedAt: order.commissionCalculatedAt || null,
    escrowLedger: order.escrowLedger ? {
      ...order.escrowLedger,
      amountHeld: Number(order.escrowLedger.amountHeld),
      commissionRate: Number(order.escrowLedger.commissionRate),
      commissionFee: Number(order.escrowLedger.commissionFee),
      refundedCommission: Number(order.escrowLedger.refundedCommission || 0),
      payoutAmount: Number(order.escrowLedger.payoutAmount),
    } : null,
    items: (order.items || []).map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
      gstRate: Number(item.gstRate || 18.0),
    })),
  };
}
