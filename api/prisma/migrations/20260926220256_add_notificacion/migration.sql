-- CreateTable
CREATE TABLE `notificacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NULL,
    `guest_token` VARCHAR(36) NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `cuerpo` TEXT NOT NULL,
    `url` VARCHAR(500) NULL,
    `leida` BOOLEAN NOT NULL DEFAULT false,
    `creada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notificacion_usuario_id_idx`(`usuario_id`),
    INDEX `notificacion_guest_token_idx`(`guest_token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notificacion` ADD CONSTRAINT `notificacion_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
