import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import {
  upload,
  uploadDir,
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_VIDEO_EXTENSIONS,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
} from '../middleware/uploadMiddleware.js';

const router = Router();

router.post('/', (req, res) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'File upload failed.' });
    }

    const files = req.files || (req.file ? [req.file] : []);
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';

    // Validate size per specific media type
    for (const f of files) {
      const ext = path.extname(f.originalname).toLowerCase();
      if (ALLOWED_IMAGE_EXTENSIONS.has(ext) && f.size > MAX_IMAGE_SIZE) {
        try { fs.unlinkSync(f.path); } catch { /* ignore */ }
        return res.status(400).json({
          success: false,
          message: `Image "${f.originalname}" exceeds the 10 MB limit (${(f.size / (1024 * 1024)).toFixed(1)} MB).`,
        });
      }
      if (ALLOWED_VIDEO_EXTENSIONS.has(ext) && f.size > MAX_VIDEO_SIZE) {
        try { fs.unlinkSync(f.path); } catch { /* ignore */ }
        return res.status(400).json({
          success: false,
          message: `Video "${f.originalname}" exceeds the 50 MB limit (${(f.size / (1024 * 1024)).toFixed(1)} MB).`,
        });
      }
    }

    const results = files.map((f) => {
      const fileUrl = `/uploads/${f.filename}`;
      const fullUrl = `${protocol}://${host}${fileUrl}`;
      const ext = path.extname(f.originalname).toLowerCase();
      const isVideo = ALLOWED_VIDEO_EXTENSIONS.has(ext);
      const isImage = ALLOWED_IMAGE_EXTENSIONS.has(ext);

      return {
        fileName: f.originalname,
        savedName: f.filename,
        fileUrl,
        url: fullUrl,
        size: f.size,
        mimetype: f.mimetype,
        isVideo,
        isImage,
      };
    });

    const primary = results[0];
    res.json({
      success: true,
      message: 'Upload successful.',
      data: primary,
      url: primary.url,
      fileUrl: primary.fileUrl,
      files: results,
    });
  });
});

router.delete('/:filename', (req, res) => {
  try {
    const rawName = req.params.filename;
    const safeName = path.basename(rawName); // Prevent path traversal (e.g. ../)
    const targetPath = path.join(uploadDir, safeName);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }

    fs.unlinkSync(targetPath);
    return res.json({ success: true, message: 'File deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'File deletion failed.' });
  }
});

export default router;
