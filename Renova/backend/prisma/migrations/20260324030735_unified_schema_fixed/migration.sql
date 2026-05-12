/*
  Warnings:

  - You are about to drop the column `prefs` on the `user` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `generation` DROP FOREIGN KEY `Generation_moodboardId_fkey`;

-- DropForeignKey
ALTER TABLE `generation` DROP FOREIGN KEY `Generation_userId_fkey`;

-- DropForeignKey
ALTER TABLE `moodboard` DROP FOREIGN KEY `Moodboard_userId_fkey`;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `prefs`,
    MODIFY `avatarUrl` VARCHAR(191) NULL,
    MODIFY `bgImageUrl` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `moodboard` ADD CONSTRAINT `moodboard_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation` ADD CONSTRAINT `generation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation` ADD CONSTRAINT `generation_moodboardId_fkey` FOREIGN KEY (`moodboardId`) REFERENCES `moodboard`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `plan` RENAME INDEX `Plan_key_key` TO `plan_key_key`;

-- RenameIndex
ALTER TABLE `plan` RENAME INDEX `Plan_priceId_key` TO `plan_priceId_key`;

-- RenameIndex
ALTER TABLE `user` RENAME INDEX `User_email_key` TO `user_email_key`;

-- RenameIndex
ALTER TABLE `user` RENAME INDEX `User_googleId_key` TO `user_googleId_key`;
