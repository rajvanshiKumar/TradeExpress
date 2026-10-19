import * as supplierProductService from '../services/supplierProductService.js';

export async function createProduct(req, res, next) {
  try {
    const product = await supplierProductService.createSupplierProduct(req.user, req.body);
    res.status(201).json({
      success: true,
      message: 'Product listed successfully.',
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const product = await supplierProductService.updateSupplierProduct(req.user, req.params.id, req.body);
    res.json({
      success: true,
      message: 'Product updated successfully.',
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const product = await supplierProductService.deleteSupplierProduct(req.user, req.params.id);
    res.json({
      success: true,
      message: 'Product deactivated successfully.',
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

export async function listProducts(req, res, next) {
  try {
    const products = await supplierProductService.listSupplierProducts(req.user);
    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadBulkTemplate(req, res, next) {
  try {
    const buffer = supplierProductService.generateBulkUploadTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="TradeSphere_Bulk_Products_Template.xlsx"');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function handleBulkUpload(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Please upload an Excel or CSV file.' });
    }
    const report = await supplierProductService.processBulkUpload(req.user, req.file.buffer);
    res.json({
      success: true,
      message: `Bulk upload completed: ${report.successCount} of ${report.totalRows} products imported.`,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}
