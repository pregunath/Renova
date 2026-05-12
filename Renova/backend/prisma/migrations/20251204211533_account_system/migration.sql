-- AlterTable
ALTER TABLE `user` ADD COLUMN `prefs` JSON NULL,
    ADD COLUMN `stripeCustomerId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Plan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `priceId` VARCHAR(191) NOT NULL,
    `interval` VARCHAR(191) NOT NULL,
    `price` INTEGER NOT NULL,
    `limits` JSON NOT NULL,
    `perks` JSON NOT NULL,

    UNIQUE INDEX `Plan_key_key`(`key`),
    UNIQUE INDEX `Plan_priceId_key`(`priceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
