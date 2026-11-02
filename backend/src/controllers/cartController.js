import prisma from '../config/db.js';

export async function getCart(req, res, next) {
  try {
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'] || null;

    if (!userId && !sessionId) {
      return res.json({ success: true, data: { items: [] } });
    }

    const cart = await prisma.cart.findFirst({
      where: userId ? { userId } : { sessionId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                slug: true,
                price: true,
                photo: true,
                unit: true,
                moq: true,
                stock: true,
                priceTiers: true,
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: cart || { items: [] },
    });
  } catch (error) {
    next(error);
  }
}

export async function syncCart(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const sessionId = req.headers['x-session-id'] || `sess_${Date.now()}`;
    const { items = [] } = req.body;

    const cart = await prisma.cart.upsert({
      where: userId ? { userId } : { sessionId },
      update: {},
      create: {
        userId,
        sessionId: userId ? null : sessionId,
      },
    });

    // Replace items
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    if (items.length > 0) {
      await prisma.cartItem.createMany({
        data: items.map((item) => ({
          cartId: cart.id,
          productId: item.productId || item.product?.id,
          quantity: item.quantity,
          variant: item.variant || null,
        })),
      });
    }

    res.json({
      success: true,
      message: 'Cart synchronized.',
      data: { sessionId },
    });
  } catch (error) {
    next(error);
  }
}
