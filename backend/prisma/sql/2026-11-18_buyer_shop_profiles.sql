-- Buyer shop verification captured at signup (additive only: one new table; no existing table or column changes).
-- Review, then apply once. Matches model BuyerShopProfile in schema.prisma.

-- CreateTable
CREATE TABLE `buyer_shop_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `shopName` VARCHAR(191) NULL,
    `photoUrl` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `accuracyMeters` DOUBLE NULL,
    `address` TEXT NULL,
    `addressDetails` JSON NULL,
    `capturedAt` DATETIME(3) NOT NULL,
    `socialLinks` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `buyer_shop_profiles_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `buyer_shop_profiles` ADD CONSTRAINT `buyer_shop_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
