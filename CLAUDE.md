# TradeExpress - Project Instructions

## 1. Project Overview
TradeExpress is a B2B Wholesale Marketplace & Fulfillment platform developed by TradeExpress B2B Private Limited.

The platform connects buyers and suppliers for wholesale product discovery, product purchasing, order management, communication and fulfillment.

Main user roles:
- Buyer
- Supplier
- Super Admin

This is an existing project. Always understand the current implementation before making changes.

## 2. Technology Stack
Frontend:
- React.js
- Vite
- JavaScript
- Tailwind CSS (verify current version and configuration)

Backend:
- Node.js
- Express.js
- REST APIs

Database:
- MySQL
- Prisma ORM

Deployment:
- Frontend: Render Static Site
- Backend: Render Web Service
- Database: Aiven MySQL

Verify the actual installed packages and configuration before making assumptions.

## 3. Project Architecture
Maintain a clear separation between:

Frontend:
- Components
- Pages
- Layouts
- Context / State Management
- API Services
- Authentication
- Utilities

Backend:
- Routes
- Controllers
- Middleware
- Services
- Database / Prisma
- Validation
- Authentication / Authorization
- Socket.IO (where implemented)

Follow the existing folder structure. Do not create duplicate architecture unnecessarily.

## 4. Business Rules

### Buyer
- Buyers can register and log in.
- Buyers can browse and search products.
- Buyers can view products listed by registered TradeExpress suppliers.
- Buyers can compare similar products and supplier offers.
- Buyers can manage orders and communicate with suppliers.
- Buyers can access only their authorized data.

### Supplier
- Suppliers can register and log in.
- Suppliers can manage their company profile.
- Suppliers can add, edit and manage products.
- Approved and active products should be discoverable by eligible buyers.
- Suppliers can manage orders and communicate with buyers.
- Suppliers must not access another supplier's private data.

### Super Admin
- Super Admin must have a separate login route.
- Public Buyer/Supplier login must not expose Super Admin registration or access.
- Super Admin access must be protected by backend authentication and authorization.
- Only authorized Super Admins can access administrative operations.
- Admin permissions must be enforced on the backend.

## 5. Product Marketplace Rules
- Product data must come from the database.
- Do not use hardcoded demo products in production.
- Product visibility must respect approval and active status.
- Buyers should see eligible TradeExpress suppliers only.
- Product prices, MOQ, quantity and delivery details must be accurate.
- Product creation and editing must update the correct supplier's records.
- Do not break existing product search or filtering.

## 6. Authentication and Security
- Never trust frontend role information alone.
- Verify authentication on protected backend routes.
- Enforce role-based authorization.
- Validate all incoming API data.
- Protect OTP verification and password reset workflows.
- Never expose passwords, OTP secrets, API keys or tokens.
- Never hardcode production credentials.
- Use environment variables for sensitive configuration.
- Apply proper ownership checks to all private records.
- Never bypass existing security middleware.

## 7. Database Rules
- Prisma is used for database access.
- Understand existing Prisma models and relationships before modifying database logic.
- Avoid duplicate records.
- Preserve referential integrity.
- Use transactions for operations that require multiple database changes.
- Never drop or reset production database tables.
- Never run destructive migrations without approval.
- Keep frontend, backend and database schemas consistent.

## 8. UI / UX Standards
- Maintain the existing TradeExpress branding.
- Use a premium B2B marketplace design.
- Emerald green and champagne gold are preferred brand colors.
- Keep layouts responsive on desktop, tablet and mobile.
- Maintain consistent spacing, typography and components.
- Avoid unnecessary animations.
- Do not use default browser UI when a polished custom component is appropriate.
- Include loading, empty, success and error states.
- Prevent duplicate submissions.
- Display meaningful validation messages.

## 9. Coding Standards
- Write clean, readable and maintainable code.
- Follow existing coding conventions.
- Use reusable components and functions.
- Avoid unnecessary dependencies.
- Avoid duplicate API calls.
- Handle errors properly.
- Avoid memory leaks and unnecessary re-renders.
- Use async/await consistently where appropriate.
- Keep business logic out of UI components when the existing architecture supports separation.
- Do not leave unused imports or dead code.

## 10. API Standards
- Follow existing REST API conventions.
- Use appropriate HTTP methods and status codes.
- Validate request parameters and request bodies.
- Return consistent API response structures.
- Handle unauthorized and forbidden requests correctly.
- Avoid breaking existing API contracts.
- Update frontend API integration when an API changes.

## 11. Testing Requirements
Before completing any task:
1. Inspect the existing implementation.
2. Identify affected frontend files.
3. Identify affected backend files.
4. Check database dependencies.
5. Implement the requested changes.
6. Run available lint checks.
7. Run frontend production build.
8. Run relevant backend tests.
9. Test affected API endpoints.
10. Check Buyer, Supplier and Super Admin permissions.
11. Check for regressions in existing functionality.

Never claim that a test passed unless it was executed successfully.

If automated tests are unavailable, explain what was checked and what still requires manual testing.

## 12. Important Restrictions
NEVER:
- Rewrite the entire project unnecessarily.
- Delete existing working features.
- Change database structure without understanding dependencies.
- Modify production environment variables without approval.
- Expose secret credentials.
- Replace real database functionality with mock data.
- Introduce unnecessary packages.
- Change unrelated files.
- Remove authentication or authorization checks.
- Claim completion without verification.

## 13. Working Procedure
For every new task:

STEP 1: Understand the requirement.
STEP 2: Inspect existing implementation.
STEP 3: Identify affected files and dependencies.
STEP 4: Explain the implementation plan.
STEP 5: Make the smallest safe changes.
STEP 6: Test the implementation.
STEP 7: Check existing functionality for regressions.
STEP 8: Report the final result.

## 14. Final Reporting Format
After every task, report:
- What was changed?
- Which files were modified?
- What functionality was added or fixed?
- What tests were executed?
- Which tests passed or failed?
- Are there any remaining issues?
- Is manual testing required?

## 15. Golden Rule
Treat TradeExpress as an existing real-world B2B marketplace, not a demo project.

Understand first.
Plan second.
Code third.
Test fourth.

Preserve existing working functionality at all times.