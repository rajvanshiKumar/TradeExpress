import * as cartService from '../services/cartService.js';

// Every handler works on the signed-in buyer's own cart (req.user from the verified token); no user id is read from the request.
const handle = (fn) => async (req, res, next) => {
  try {
    res.json({ success: true, data: await fn(req) });
  } catch (error) {
    next(error);
  }
};

export const getCart = handle((req) => cartService.getCart(req.user.id));
export const addItem = handle((req) => cartService.addItem(req.user.id, req.body || {}));
export const updateItem = handle((req) => cartService.updateItem(req.user.id, req.params.itemId, req.body || {}));
export const removeItem = handle((req) => cartService.removeItem(req.user.id, req.params.itemId));
export const clearCart = handle((req) => cartService.clearCart(req.user.id));
export const mergeItems = handle((req) => cartService.mergeItems(req.user.id, req.body?.items));
