import * as inventoryService from '../services/inventoryService.js';
import { getInventoryReconciliation } from '../services/inventoryLifecycleService.js';

export async function getProductDetail(req, res, next) {
  try {
    const result = await inventoryService.getProductInventoryDetail(req.user, req.params.productId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getReconciliation(req, res, next) {
  try {
    res.json({ success: true, data: await getInventoryReconciliation() });
  } catch (error) {
    next(error);
  }
}

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

