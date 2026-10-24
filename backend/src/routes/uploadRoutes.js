import { Router } from 'express';
import { upload } from '../middleware/uploadMiddleware.js';

const router = Router();

router.post('/', (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'File upload failed.' });
    }
    const uploadedFile = req.file || (req.files && req.files[0]);
    if (!uploadedFile) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    // Construct relative and full URL
    const fileUrl = `/uploads/${uploadedFile.filename}`;
    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    const fullUrl = `${protocol}://${host}${fileUrl}`;

    res.json({
      success: true,
      data: {
        fileName: uploadedFile.originalname,
        savedName: uploadedFile.filename,
        fileUrl,
        url: fullUrl,
        size: uploadedFile.size,
        mimetype: uploadedFile.mimetype,
      },
      url: fullUrl,
      fileUrl,
    });
  });
});

export default router;
