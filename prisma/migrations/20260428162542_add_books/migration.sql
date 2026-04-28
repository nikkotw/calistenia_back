-- CreateTable
CREATE TABLE `books` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `author` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `coverUrl` VARCHAR(191) NULL,
    `fileUrl` VARCHAR(191) NULL,
    `previewUrl` VARCHAR(191) NULL,
    `price` DOUBLE NOT NULL,
    `pages` INTEGER NULL,
    `isbn` VARCHAR(191) NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `tags` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `books_isPublished_idx`(`isPublished`),
    INDEX `books_featured_idx`(`featured`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
