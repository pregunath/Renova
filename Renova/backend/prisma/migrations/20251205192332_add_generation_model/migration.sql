/*
  Warnings:

  - You are about to drop the column `generations` on the `Moodboard` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Moodboard` DROP COLUMN `generations`;

-- CreateTable
CREATE TABLE `Generation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `moodboardId` INTEGER NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `prompt` VARCHAR(191) NOT NULL,
    `baseImageUrl` VARCHAR(191) NULL,
    `inputItems` JSON NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Generation` ADD CONSTRAINT `Generation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Generation` ADD CONSTRAINT `Generation_moodboardId_fkey` FOREIGN KEY (`moodboardId`) REFERENCES `Moodboard`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
