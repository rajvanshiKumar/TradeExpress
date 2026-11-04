import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import {
  upload,
  uploadDir,
  uploaderTag,
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_DOC_EXTENSIONS,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MAX_DOC_SIZE,
} from '../middleware/uploadMiddleware.js';
import { authenticateJWT, optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Without a sign-in only supplier-signup files can be uploaded: certificates (images / PDF) and facility media
// (images / short MP4), a couple per request, rate-limited
const ANONYMOUS_EXTENSIONS = new Set([...ALLOWED_IMAGE_EXTENSIONS, '.pdf', '.mp4']);
const ANONYMOUS_MAX_FILES = 2;
const ANONYMOUS_MAX_VIDEO_SIZE = 25 * 1024 * 1024;
const anonymousUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => Boolean(req.user),
  message: { success: false, message: 'Too many uploads from this network. Please try again in an hour, or sign in.' },
});

const removeFiles = (files) => files.forEach((f) => { try { fs.unlinkSync(f.path); } catch { /* already gone */ } });

router.post('/', optionalAuth, anonymousUploadLimiter, (req, res) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'File upload failed.' });
    }

    const files = req.files || (req.file ? [req.file] : []);
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    if (!req.user) {
      const notAllowed = files.find((f) => !ANONYMOUS_EXTENSIONS.has(path.extname(f.originalname).toLowerCase()));
      if (notAllowed || files.length > ANONYMOUS_MAX_FILES) {
        removeFiles(files);
        return res.status(notAllowed ? 401 : 400).json({
          success: false,
          message: notAllowed
            ? 'Please sign in to upload this type of file. Before sign-in only images, PDF documents and MP4 videos can be uploaded.'
            : `Upload at most ${ANONYMOUS_MAX_FILES} files at a time.`,
        });
      }
      const bigVideo = files.find((f) => path.extname(f.originalname).toLowerCase() === '.mp4' && f.size > ANONYMOUS_MAX_VIDEO_SIZE);
      if (bigVideo) {
        removeFiles(files);
        return res.status(400).json({ success: false, message: `Video "${bigVideo.originalname}" is larger than 25 MB. Upload a shorter clip, or add it after signing in.` });
      }
    }

    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';

    // Validate size per specific media type
    for (const f of files) {
      const ext = path.extname(f.originalname).toLowerCase();
      const limit = ALLOWED_IMAGE_EXTENSIONS.has(ext) ? [MAX_IMAGE_SIZE, 'Image', '10 MB']
        : ALLOWED_VIDEO_EXTENSIONS.has(ext) ? [MAX_VIDEO_SIZE, 'Video', '50 MB']
          : ALLOWED_DOC_EXTENSIONS.has(ext) ? [MAX_DOC_SIZE, 'Document', '15 MB'] : null;
      if (limit && f.size > limit[0]) {
        removeFiles(files);
        return res.status(400).json({
          success: false,
          message: `${limit[1]} "${f.originalname}" exceeds the ${limit[2]} limit (${(f.size / (1024 * 1024)).toFixed(1)} MB).`,
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

/**
 * Deletes one of the signed-in user's own uploads (admins may delete any). Files uploaded before ownership tags
 * existed, or anonymously, can only be removed by an admin.
 */
router.delete('/:filename', authenticateJWT, (req, res) => {
  try {
    const safeName = path.basename(req.params.filename); // Prevent path traversal (e.g. ../)
    const isStaff = req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN';
    if (!isStaff && !safeName.startsWith(`${uploaderTag(req.user.id)}-`)) {
      return res.status(403).json({ success: false, message: 'You can only delete files you uploaded.' });
    }

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
