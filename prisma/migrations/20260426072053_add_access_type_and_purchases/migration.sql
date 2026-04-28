/*
  Warnings:

  - You are about to drop the column `routineId` on the `routine_steps` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[dayId,stepNumber]` on the table `routine_steps` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `dayId` to the `routine_steps` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `routine_steps` DROP FOREIGN KEY `routine_steps_routineId_fkey`;

-- DropIndex
DROP INDEX `routine_steps_routineId_stepNumber_key` ON `routine_steps`;

-- AlterTable
ALTER TABLE `challenges` ADD COLUMN `accessType` ENUM('FREE', 'SUBSCRIPTION', 'ONE_TIME') NOT NULL DEFAULT 'FREE',
    ADD COLUMN `price` DOUBLE NULL;

-- AlterTable
ALTER TABLE `routine_steps` DROP COLUMN `routineId`,
    ADD COLUMN `dayId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `routines` ADD COLUMN `accessType` ENUM('FREE', 'SUBSCRIPTION', 'ONE_TIME') NOT NULL DEFAULT 'FREE',
    ADD COLUMN `price` DOUBLE NULL;

-- CreateTable
CREATE TABLE `routine_days` (
    `id` VARCHAR(191) NOT NULL,
    `routineId` VARCHAR(191) NOT NULL,
    `dayNumber` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `routine_days_routineId_idx`(`routineId`),
    UNIQUE INDEX `routine_days_routineId_dayNumber_key`(`routineId`, `dayNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_purchases` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `itemType` VARCHAR(191) NOT NULL,
    `pricePaid` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_purchases_userId_idx`(`userId`),
    INDEX `user_purchases_itemId_idx`(`itemId`),
    UNIQUE INDEX `user_purchases_userId_itemId_itemType_key`(`userId`, `itemId`, `itemType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `routine_steps_dayId_idx` ON `routine_steps`(`dayId`);

-- CreateIndex
CREATE UNIQUE INDEX `routine_steps_dayId_stepNumber_key` ON `routine_steps`(`dayId`, `stepNumber`);

-- AddForeignKey
ALTER TABLE `routine_days` ADD CONSTRAINT `routine_days_routineId_fkey` FOREIGN KEY (`routineId`) REFERENCES `routines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routine_steps` ADD CONSTRAINT `routine_steps_dayId_fkey` FOREIGN KEY (`dayId`) REFERENCES `routine_days`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_purchases` ADD CONSTRAINT `user_purchases_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
