-- PAN–Aadhaar link check history (additive only: one new table; no existing table or column changes).
-- Review, then apply once. Matches model PanAadhaarLinkCheck in schema.prisma. Needs aadhaar_verifications.

-- CreateTable
CREATE TABLE `pan_aadhaar_link_checks` (
    `id` VARCHAR(191) NOT NULL,
    `aadhaarVerificationId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `pan` VARCHAR(191) NOT NULL,
    `aadhaarLast4` VARCHAR(191) NOT NULL,
    `maskedPan` VARCHAR(191) NULL,
    `linkingStatus` BOOLEAN NULL,
    `result` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `environment` VARCHAR(191) NOT NULL,
    `responseData` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pan_aadhaar_link_checks_aadhaarVerificationId_idx`(`aadhaarVerificationId`),
    INDEX `pan_aadhaar_link_checks_userId_idx`(`userId`),
    INDEX `pan_aadhaar_link_checks_pan_idx`(`pan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pan_aadhaar_link_checks` ADD CONSTRAINT `pan_aadhaar_link_checks_aadhaarVerificationId_fkey` FOREIGN KEY (`aadhaarVerificationId`) REFERENCES `aadhaar_verifications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pan_aadhaar_link_checks` ADD CONSTRAINT `pan_aadhaar_link_checks_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
