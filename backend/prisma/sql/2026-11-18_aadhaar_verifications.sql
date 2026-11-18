-- Aadhaar OTP (OKYC) verification records (additive only: one new table; no existing table or column changes).
-- Review, then apply once. Matches model AadhaarVerification in schema.prisma.

-- CreateTable
CREATE TABLE `aadhaar_verifications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `aadhaarHash` VARCHAR(191) NOT NULL,
    `aadhaarLast4` VARCHAR(191) NOT NULL,
    `referenceId` VARCHAR(191) NOT NULL,
    `environment` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OTP_SENT',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `providerRequestId` VARCHAR(191) NULL,
    `lastError` TEXT NULL,
    `responseData` LONGTEXT NULL,
    `verifiedAt` DATETIME(3) NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `aadhaar_verifications_aadhaarHash_createdAt_idx`(`aadhaarHash`, `createdAt`),
    INDEX `aadhaar_verifications_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `aadhaar_verifications` ADD CONSTRAINT `aadhaar_verifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
