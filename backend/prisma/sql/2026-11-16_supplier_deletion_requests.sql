-- Supplier account deletion approval workflow (additive only: one new table; no existing table or column changes).
-- Review, then apply once. Matches model SupplierDeletionRequest in schema.prisma.

-- CreateTable
CREATE TABLE `supplier_deletion_requests` (
    `id` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `requesterId` VARCHAR(191) NOT NULL,
    `activeKey` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `reason` TEXT NULL,
    `decisionNote` TEXT NULL,
    `decidedById` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `graceEndsAt` DATETIME(3) NULL,
    `hiddenProductIds` JSON NULL,
    `obligations` JSON NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `completedAt` DATETIME(3) NULL,
    `history` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `supplier_deletion_requests_activeKey_key`(`activeKey`),
    INDEX `supplier_deletion_requests_status_idx`(`status`),
    INDEX `supplier_deletion_requests_supplierId_idx`(`supplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `supplier_deletion_requests` ADD CONSTRAINT `supplier_deletion_requests_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
