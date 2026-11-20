import test from 'node:test';
import assert from 'node:assert/strict';
import { aadhaarHolderDetails } from '../../src/services/superAdminService.js';

const reply = {
  success: true,
  status: 'VERIFIED',
  data: {
    full_name: 'Ravi Kumar',
    aadhaar_number: '234123412346',
    dob: '1990-05-14',
    gender: 'M',
    care_of: 'S/O: Mohan Kumar',
    zip: '395002',
    profile_image: '/9j/4AAQSkZJRg==',
    mobile_verified: true,
    address: { house: 'Shop 12', street: 'Ring Road', landmark: '', loc: 'Ring Road Market', vtc: 'Surat', po: 'Surat', subdist: 'Surat', dist: 'Surat', state: 'Gujarat', country: 'India' },
  },
};

test('Super Admin user details: Aadhaar holder details', async (t) => {
  await t.test('name, date of birth, gender, care-of and a one-line address are returned', () => {
    const details = aadhaarHolderDetails(JSON.stringify(reply));
    assert.deepEqual(details, {
      aadhaarNumber: '234123412346',
      fullName: 'Ravi Kumar',
      dateOfBirth: '1990-05-14',
      gender: 'M',
      careOf: 'S/O: Mohan Kumar',
      address: 'Shop 12, Ring Road, Ring Road Market, Surat, Gujarat, 395002, India',
      mobileVerified: true,
      photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    });
  });

  await t.test('a masked number (UAT test reply) is not shown as a number', () => {
    const masked = { ...reply, data: { ...reply.data, aadhaar_number: 'XXXXXXXX2346' } };
    assert.equal(aadhaarHolderDetails(JSON.stringify(masked)).aadhaarNumber, null);
  });

  await t.test('the photo is returned only when it is a JPEG/PNG image', () => {
    const png = { ...reply, data: { ...reply.data, profile_image: 'iVBORw0KGgoAAAA=' } };
    assert.equal(aadhaarHolderDetails(JSON.stringify(png)).photo, 'data:image/png;base64,iVBORw0KGgoAAAA=');
    for (const bad of ['', 'aW1hZ2UtZGF0YQ==', '/9j/"><script>', null]) {
      const r = { ...reply, data: { ...reply.data, profile_image: bad } };
      assert.equal(aadhaarHolderDetails(JSON.stringify(r)).photo, null);
    }
  });

  await t.test('missing or unreadable data gives null instead of an error', () => {
    assert.equal(aadhaarHolderDetails(null), null);
    assert.equal(aadhaarHolderDetails('not json'), null);
  });
});
