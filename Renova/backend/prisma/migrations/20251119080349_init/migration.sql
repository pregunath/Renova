-- AlterTable
ALTER TABLE `Moodboard` ADD COLUMN `generations` JSON NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `avatarUrl` VARCHAR(191) NULL,
    ADD COLUMN `bgImageUrl` VARCHAR(191) NULL;
