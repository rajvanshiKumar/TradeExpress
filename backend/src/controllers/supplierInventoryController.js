import * as inventoryService from '../services/inventoryService.js';

export async function listInventory(req, res, next) {
  try {
    const result = await inventoryService.listSupplierInventory(req.user, req.query);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function adjustStock(req, res, next) {
  try {
    const { productId } = req.params;
    const result = await inventoryService.adjustProductStock(req.user, productId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getInventoryHistory(req, res, next) {
  try {
    const { productId } = req.params;
    const result = await inventoryService.getProductInventoryHistory(req.user, productId, req.query);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const { productId } = req.params;
    const result = await inventoryService.updateInventorySettings(req.user, productId, req.body);
    res.json({
      success: true,
      message: 'Inventory settings updated successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

