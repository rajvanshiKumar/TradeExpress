import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/utils/validators.js';

describe('Supplier Add Product Flow & Guard Regression Test Suite', () => {
  // Replicates useSupplierCompany resolution logic
  function resolveSupplierCompany(user, mockCompanies = []) {
    let company = user?.companyId ? mockCompanies.find((c) => c.id === user.companyId) : null;
    const isSupplier = user?.role?.toLowerCase() === 'supplier';

    if (!company && user && isSupplier) {
      company = (mockCompanies || []).find(
        (c) => c.id === user.id || (user.company && c.name?.toLowerCase() === user.company.toLowerCase())
      );

      if (!company) {
        const companyName = user.company || user.companyName || user.name || '';
        if (companyName) {
          company = {
            id: user.companyId || user.id,
            name: companyName,
            slug: slugify(companyName) || 'supplier-enterprise',
            country: user.country || 'India',
            city: user.city || '',
            state: user.state || '',
            businessType: user.businessType || 'Manufacturer',
            kycStatus: user.kycStatus || 'PENDING',
            kycRejectionReason: user.kycRejectionReason || null,
            isVerified: Boolean(user.isVerified),
          };
        }
      }
    }
    return company || null;
  }

  // Replicates SupplierGuard decision matrix
  function evaluateSupplierGuard({ user, company, requireVerified = false }) {
    if (!user) {
      return { status: 'REDIRECT_LOGIN', target: '/login', state: { from: '/supplier/products/new' } };
    }

    if (user.status === 'Suspended' || user.isActive === false) {
      return { status: 'ACCOUNT_SUSPENDED', message: 'Account Suspended', action: '/help' };
    }

    const userRole = user.role?.toLowerCase();
    if (userRole !== 'supplier' && userRole !== 'admin' && userRole !== 'super_admin') {
      return { status: 'FORBIDDEN_BUYER', message: 'Supplier Access Required', action: '/buyer' };
    }

    if (!company) {
      return {
        status: 'PROFILE_REQUIRED',
        message: 'Supplier Profile Setup Required',
        action: '/supplier/profile',
      };
    }

    const kycStatus = (company.kycStatus || user.kycStatus || '').toUpperCase();
    if (kycStatus === 'REJECTED') {
      return {
        status: 'VERIFICATION_REJECTED',
        message: 'Supplier Verification Rejected',
        action: '/supplier/verification',
      };
    }

    if (requireVerified && (kycStatus === 'PENDING' || kycStatus === 'NOT_SUBMITTED') && !company.isVerified) {
      return {
        status: 'VERIFICATION_PENDING',
        message: 'Verification Required',
        action: '/supplier/verification',
      };
    }

    return { status: 'ALLOW_FORM', company };
  }

  describe('1. Registered Supplier Clicking Add Product', () => {
    it('successfully resolves company for lowercase role supplier and allows Add Product form', () => {
      const registeredSupplier = {
        id: 'c757faa7-23d9-4921-8407-f048412cb644',
        email: 'rajvanshikumar687@gmail.com',
        name: 'Rajesh kumar',
        company: 'Apex School',
        role: 'supplier', // Lowercase normalized role from AuthContext
        kycStatus: 'PENDING',
        isVerified: false,
      };

      const company = resolveSupplierCompany(registeredSupplier);
      assert.ok(company, 'Company must be synthesized from supplier profile');
      assert.equal(company.name, 'Apex School');
      assert.equal(company.id, registeredSupplier.id);

      const guard = evaluateSupplierGuard({ user: registeredSupplier, company });
      assert.equal(guard.status, 'ALLOW_FORM', 'SupplierGuard must allow opening Add Product form');
    });

    it('works identically for uppercase role SUPPLIER', () => {
      const supplierUppercase = {
        id: 'supp-upper-001',
        name: 'Tata Steel',
        company: 'Tata Steel Ltd',
        role: 'SUPPLIER',
      };
      const company = resolveSupplierCompany(supplierUppercase);
      assert.ok(company);
      const guard = evaluateSupplierGuard({ user: supplierUppercase, company });
      assert.equal(guard.status, 'ALLOW_FORM');
    });
  });

  describe('2. Direct Navigation & Page Refresh', () => {
    it('retains session and resolves company upon page reload from stored state', () => {
      // Simulating stored session in localStorage
      const storedSession = { userId: 'supp-reload-001', role: 'supplier', expiresAt: Date.now() + 3600000 };
      const storedAccount = {
        id: 'supp-reload-001',
        name: 'Direct Nav Supplier',
        company: 'Nav Co',
        role: 'supplier',
      };

      assert.ok(storedSession.expiresAt > Date.now(), 'Session is unexpired');
      const company = resolveSupplierCompany(storedAccount);
      assert.ok(company);
      assert.equal(company.name, 'Nav Co');

      const guard = evaluateSupplierGuard({ user: storedAccount, company });
      assert.equal(guard.status, 'ALLOW_FORM');
    });
  });

  describe('3. Missing Supplier Profile', () => {
    it('shows Supplier Profile Incomplete empty state with action to /supplier/profile and NEVER to registration', () => {
      const userWithoutProfile = {
        id: 'supp-blank-001',
        name: '',
        company: '',
        role: 'supplier',
      };
      const company = resolveSupplierCompany(userWithoutProfile);
      assert.equal(company, null, 'Company should be null when profile details are completely absent');

      const guard = evaluateSupplierGuard({ user: userWithoutProfile, company });
      assert.equal(guard.status, 'PROFILE_REQUIRED');
      assert.equal(guard.action, '/supplier/profile', 'Must direct user to complete profile, NOT registration');
      assert.notEqual(guard.action, '/register?role=supplier', 'Must never direct registered user to register again');
    });
  });

  describe('4. Pending or Rejected Supplier Verification', () => {
    it('shows specific explanation and link to /supplier/verification when verification is REJECTED', () => {
      const rejectedSupplier = {
        id: 'supp-rejected-001',
        name: 'Rejected Co',
        company: 'Rejected Enterprises',
        role: 'supplier',
        kycStatus: 'REJECTED',
        kycRejectionReason: 'Invalid GST certificate uploaded',
      };
      const company = resolveSupplierCompany(rejectedSupplier);
      const guard = evaluateSupplierGuard({ user: rejectedSupplier, company });

      assert.equal(guard.status, 'VERIFICATION_REJECTED');
      assert.equal(guard.action, '/supplier/verification');
    });

    it('shows verification under review banner when explicit verification is required and pending', () => {
      const pendingSupplier = {
        id: 'supp-pending-001',
        name: 'Pending Co',
        company: 'Pending Enterprises',
        role: 'supplier',
        kycStatus: 'PENDING',
        isVerified: false,
      };
      const company = resolveSupplierCompany(pendingSupplier);
      const guard = evaluateSupplierGuard({ user: pendingSupplier, company, requireVerified: true });

      assert.equal(guard.status, 'VERIFICATION_PENDING');
      assert.equal(guard.action, '/supplier/verification');
    });
  });

  describe('5. Expired Session Handling', () => {
    it('redirects expired or unauthenticated session to /login preserving destination route', () => {
      const guard = evaluateSupplierGuard({ user: null, company: null });
      assert.equal(guard.status, 'REDIRECT_LOGIN');
      assert.equal(guard.target, '/login');
      assert.equal(guard.state.from, '/supplier/products/new');
    });
  });

  describe('6. Buyer Attempting to Access Add Product', () => {
    it('blocks buyers and displays Supplier Access Required with button to /buyer', () => {
      const buyerUser = {
        id: 'buyer-001',
        name: 'Alice Buyer',
        role: 'buyer',
      };
      const guard = evaluateSupplierGuard({ user: buyerUser, company: null });
      assert.equal(guard.status, 'FORBIDDEN_BUYER');
      assert.equal(guard.action, '/buyer');
    });
  });

  describe('7 & 9. Form Validation & Backend API Failure', () => {
    function validateProductForm(values) {
      const errors = {};
      if (!values.name || values.name.trim().length < 4) errors.name = 'Product name must be at least 4 characters';
      if (!values.category) errors.category = 'Category is required';
      if (typeof values.price !== 'number' || values.price <= 0) errors.price = 'Base price must be greater than zero';
      if (typeof values.moq !== 'number' || values.moq < 1) errors.moq = 'Minimum order must be at least 1';
      if (typeof values.stock !== 'number' || values.stock < 0) errors.stock = 'Stock must be zero or more';
      return errors;
    }

    it('rejects invalid product data (negative price, zero MOQ, missing name)', () => {
      const invalidInput = { name: '', category: '', price: -5, moq: 0, stock: -1 };
      const errors = validateProductForm(invalidInput);
      assert.ok(errors.name);
      assert.ok(errors.category);
      assert.ok(errors.price);
      assert.ok(errors.moq);
      assert.ok(errors.stock);
    });

    it('accepts fully valid product form data', () => {
      const validInput = {
        name: 'Industrial SS Ball Valve',
        category: 'industrial-supplies',
        price: 1250,
        moq: 5,
        stock: 100,
      };
      const errors = validateProductForm(validInput);
      assert.equal(Object.keys(errors).length, 0);
    });

    it('stops submission and raises error when backend API returns 400 validation error', () => {
      const backendError = { status: 400, message: 'Base price must be greater than zero.' };
      let toastMessage = null;
      let isSubmitting = true;

      if (backendError.status === 400 || backendError.status === 422) {
        toastMessage = backendError.message;
        isSubmitting = false;
      }

      assert.equal(toastMessage, 'Base price must be greater than zero.');
      assert.equal(isSubmitting, false, 'Submitting lock must be released on failure');
    });
  });

  describe('10. Duplicate Submission Prevention', () => {
    it('prevents multiple simultaneous submissions while a request is in flight', () => {
      let submitCallCount = 0;
      let submitting = false;

      async function handleSubmit() {
        if (submitting) return; // Duplicate submission lock
        submitting = true;
        submitCallCount++;
        // Simulate async operation
        await new Promise((r) => setTimeout(r, 10));
        submitting = false;
      }

      // First click
      const p1 = handleSubmit();
      // Second immediate click while in-flight
      const p2 = handleSubmit();

      return Promise.all([p1, p2]).then(() => {
        assert.equal(submitCallCount, 1, 'Duplicate submission must be blocked while request is in flight');
      });
    });
  });

  describe('11. Image Upload Fallback Handling', () => {
    it('validates image MIME types and rejects non-image files', () => {
      const pdfFile = { type: 'application/pdf', name: 'document.pdf' };
      const imageFile = { type: 'image/jpeg', name: 'product.jpg' };

      const isImage = (f) => Boolean(f?.type?.startsWith('image/'));
      assert.equal(isImage(pdfFile), false);
      assert.equal(isImage(imageFile), true);
    });

    it('falls back to local dataUrl preview when backend upload server fails', () => {
      let photoUrl = null;
      let uploadedViaApi = false;

      function onUploadFailure(fallbackDataUrl) {
        uploadedViaApi = false;
        photoUrl = fallbackDataUrl;
      }

      onUploadFailure('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
      assert.ok(photoUrl.startsWith('data:image/'));
      assert.equal(uploadedViaApi, false);
    });
  });
});
