import { Router } from 'express';
import { upload } from '../middleware/uploadMiddleware.js';

const router = Router();

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }

  // Construct absolute/relative URL
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    data: {
      fileName: req.file.originalname,
      savedName: req.file.filename,
      fileUrl,
      size: req.file.size,
      mimetype: req.file.mimetype,
    },
  });
});

export default router;
