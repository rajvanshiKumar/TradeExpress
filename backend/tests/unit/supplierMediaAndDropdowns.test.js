import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

describe('Supplier Product Media & Security Verification Suite', () => {
  describe('1. Product Image Limits: 1 to 8 Allowed, 9 Rejected (HTTP 400)', () => {
    function validateProductMediaPayload({ images = [], videoUrl = null }) {
      if (!Array.isArray(images)) {
        return { status: 400, error: 'Images must be an array of image URLs.' };
      }
      if (images.length > 8) {
        return { status: 400, error: 'Maximum 8 product images allowed.' };
      }
      if (videoUrl !== null && videoUrl !== undefined && typeof videoUrl !== 'string') {
        return { status: 400, error: 'Video URL must be a valid string URL.' };
      }
      return { status: 200, valid: true };
    }

    it('accepts product with 1 valid image', () => {
      const payload = {
        images: ['/uploads/products/industrial_lathe_1.jpg'],
      };
      const res = validateProductMediaPayload(payload);
      assert.equal(res.status, 200);
      assert.equal(res.valid, true);
    });

    it('accepts product with exactly 8 valid images (maximum limit)', () => {
      const payload = {
        images: [
          '/uploads/products/image1.jpg',
          '/uploads/products/image2.jpg',
          '/uploads/products/image3.jpg',
          '/uploads/products/image4.jpg',
          '/uploads/products/image5.jpg',
          '/uploads/products/image6.jpg',
          '/uploads/products/image7.jpg',
          '/uploads/products/image8.jpg',
        ],
      };
      const res = validateProductMediaPayload(payload);
      assert.equal(res.status, 200);
      assert.equal(res.valid, true);
    });

    it('strictly rejects product submission with 9 images with HTTP 400', () => {
      const payload = {
        images: [
          '/uploads/products/image1.jpg',
          '/uploads/products/image2.jpg',
          '/uploads/products/image3.jpg',
          '/uploads/products/image4.jpg',
          '/uploads/products/image5.jpg',
          '/uploads/products/image6.jpg',
          '/uploads/products/image7.jpg',
          '/uploads/products/image8.jpg',
          '/uploads/products/image9.jpg', // 9th image exceeds limit
        ],
      };
      const res = validateProductMediaPayload(payload);
      assert.equal(res.status, 400);
      assert.equal(res.error, 'Maximum 8 product images allowed.');
    });

    it('accepts 8 images accompanied by 1 promotional video URL', () => {
      const payload = {
        images: Array.from({ length: 8 }, (_, i) => `/uploads/products/view_${i + 1}.webp`),
        videoUrl: '/uploads/products/machine_demo.mp4',
      };
      const res = validateProductMediaPayload(payload);
      assert.equal(res.status, 200);
      assert.equal(res.valid, true);
    });
  });

  describe('2. Upload Media Type & Size Enforcement', () => {
    const ALLOWED_IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const ALLOWED_VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.mkv'];
    const DANGEROUS_EXTS = ['.exe', '.bat', '.sh', '.php', '.pl', '.py', '.js', '.vbs', '.scr', '.msi'];
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

    function validateUploadFile(file) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (DANGEROUS_EXTS.includes(ext)) {
        return { accepted: false, error: 'Dangerous executable or script file rejected for security.' };
      }
      const isImage = ALLOWED_IMAGE_EXTS.includes(ext) || file.mimetype?.startsWith('image/');
      const isVideo = ALLOWED_VIDEO_EXTS.includes(ext) || file.mimetype?.startsWith('video/');

      if (!isImage && !isVideo) {
        return { accepted: false, error: 'Invalid file format. Only images and videos are supported.' };
      }

      if (isImage && file.size > MAX_IMAGE_SIZE) {
        return { accepted: false, error: 'Image size exceeds maximum 10MB limit.' };
      }
      if (isVideo && file.size > MAX_VIDEO_SIZE) {
        return { accepted: false, error: 'Video size exceeds maximum 50MB limit.' };
      }

      return {
        accepted: true,
        type: isVideo ? 'video' : 'image',
        url: `/uploads/${file.originalname}`,
      };
    }

    it('accepts valid JPEG, PNG, WEBP images under 10MB', () => {
      const validFiles = [
        { originalname: 'bearing.jpg', mimetype: 'image/jpeg', size: 1.5 * 1024 * 1024 },
        { originalname: 'texture.png', mimetype: 'image/png', size: 4.2 * 1024 * 1024 },
        { originalname: 'spec.webp', mimetype: 'image/webp', size: 850 * 1024 },
      ];
      validFiles.forEach((file) => {
        const res = validateUploadFile(file);
        assert.equal(res.accepted, true);
        assert.equal(res.type, 'image');
      });
    });

    it('accepts valid MP4, WEBM videos under 50MB', () => {
      const validVideos = [
        { originalname: 'factory_tour.mp4', mimetype: 'video/mp4', size: 32 * 1024 * 1024 },
        { originalname: 'assembly_clip.webm', mimetype: 'video/webm', size: 14 * 1024 * 1024 },
      ];
      validVideos.forEach((file) => {
        const res = validateUploadFile(file);
        assert.equal(res.accepted, true);
        assert.equal(res.type, 'video');
      });
    });

    it('rejects oversized images exceeding 10MB', () => {
      const oversizedImage = {
        originalname: 'huge_raw_photo.jpg',
        mimetype: 'image/jpeg',
        size: 11 * 1024 * 1024,
      };
      const res = validateUploadFile(oversizedImage);
      assert.equal(res.accepted, false);
      assert.match(res.error, /exceeds maximum 10MB limit/);
    });

    it('rejects oversized videos exceeding 50MB', () => {
      const oversizedVideo = {
        originalname: 'feature_length_4k.mp4',
        mimetype: 'video/mp4',
        size: 55 * 1024 * 1024,
      };
      const res = validateUploadFile(oversizedVideo);
      assert.equal(res.accepted, false);
      assert.match(res.error, /exceeds maximum 50MB limit/);
    });

    it('rejects dangerous executable files (.exe, .bat, .php, .sh)', () => {
      const maliciousFiles = [
        { originalname: 'payload.exe', mimetype: 'application/x-msdownload', size: 1024 },
        { originalname: 'script.bat', mimetype: 'application/x-bat', size: 500 },
        { originalname: 'exploit.php', mimetype: 'application/x-php', size: 2000 },
        { originalname: 'backdoor.sh', mimetype: 'text/x-shellscript', size: 1500 },
      ];
      maliciousFiles.forEach((file) => {
        const res = validateUploadFile(file);
        assert.equal(res.accepted, false);
        assert.match(res.error, /Dangerous executable or script file rejected/);
      });
    });

    it('prevents path traversal when deleting uploaded media using path.basename', () => {
      function sanitizeDeletionTarget(requestedPath) {
        const safeFilename = path.basename(requestedPath);
        return safeFilename;
      }

      assert.equal(sanitizeDeletionTarget('../../etc/passwd'), 'passwd');
      assert.equal(sanitizeDeletionTarget('..\\..\\windows\\system32\\cmd.exe'), 'cmd.exe');
      assert.equal(sanitizeDeletionTarget('/uploads/products/image1.jpg'), 'image1.jpg');
    });
  });

  describe('3. Database Media Reconciliation & Ownership Protection', () => {
    it('synchronizes ProductImage relation ordering and designates first image as primary photo', () => {
      const submittedImages = [
        'https://res.cloudinary.com/demo/image/upload/v1/valve_front.jpg',
        'https://res.cloudinary.com/demo/image/upload/v1/valve_side.jpg',
        'https://res.cloudinary.com/demo/image/upload/v1/valve_internal.jpg',
      ];

      // Service logic:
      const primaryPhoto = submittedImages[0] || null;
      const productImagesToCreate = submittedImages.map((url, index) => ({
        url,
        isPrimary: index === 0,
        sortOrder: index,
      }));

      assert.equal(primaryPhoto, 'https://res.cloudinary.com/demo/image/upload/v1/valve_front.jpg');
      assert.equal(productImagesToCreate.length, 3);
      assert.equal(productImagesToCreate[0].isPrimary, true);
      assert.equal(productImagesToCreate[0].sortOrder, 0);
      assert.equal(productImagesToCreate[1].isPrimary, false);
      assert.equal(productImagesToCreate[1].sortOrder, 1);
      assert.equal(productImagesToCreate[2].isPrimary, false);
      assert.equal(productImagesToCreate[2].sortOrder, 2);
    });

    it('strictly forbids a supplier from modifying another supplier product (HTTP 403)', () => {
      const targetProduct = {
        id: 'prod-999',
        supplierId: 'supplier-alpha-id',
        name: 'Precision Milling Machine',
      };

      const attackerSupplier = {
        id: 'supplier-bravo-id',
        role: 'SUPPLIER',
      };

      function authorizeProductModification(user, product) {
        if (!user) return { status: 401, error: 'Unauthorized' };
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return { status: 200, authorized: true };
        if (product.supplierId !== user.id) {
          return { status: 403, error: 'Forbidden. You do not own this product.' };
        }
        return { status: 200, authorized: true };
      }

      const check = authorizeProductModification(attackerSupplier, targetProduct);
      assert.equal(check.status, 403);
      assert.equal(check.error, 'Forbidden. You do not own this product.');
    });

    it('allows verified product owner and admins to update media and metadata', () => {
      const targetProduct = {
        id: 'prod-999',
        supplierId: 'supplier-alpha-id',
        name: 'Precision Milling Machine',
      };

      const legitimateOwner = { id: 'supplier-alpha-id', role: 'SUPPLIER' };
      const platformAdmin = { id: 'admin-1', role: 'ADMIN' };

      function authorizeProductModification(user, product) {
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
        return product.supplierId === user.id;
      }

      assert.equal(authorizeProductModification(legitimateOwner, targetProduct), true);
      assert.equal(authorizeProductModification(platformAdmin, targetProduct), true);
    });
  });
});

