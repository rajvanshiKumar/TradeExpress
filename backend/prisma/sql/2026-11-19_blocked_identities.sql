-- Identities of suspended accounts that may not sign up again (additive only: one new table; no existing table or
-- column changes). Review, then apply once. Matches model BlockedIdentity in schema.prisma.

-- CreateTable
CREATE TABLE `blocked_identities` (
    `id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `valueHash` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `blocked_identities_userId_idx`(`userId`),
    UNIQUE INDEX `blocked_identities_kind_valueHash_key`(`kind`, `valueHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
