-- AlterTable
ALTER TABLE `tarea_produccion` MODIFY `estatus` ENUM('PROPUESTA', 'PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA', 'RECHAZADA') NOT NULL DEFAULT 'PENDIENTE';

-- CreateTable
CREATE TABLE `insumo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `unidad` VARCHAR(30) NOT NULL,
    `stock_actual` DECIMAL(10, 3) NOT NULL DEFAULT 0,
    `stock_minimo` DECIMAL(10, 3) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receta_item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `producto_id` INTEGER NOT NULL,
    `insumo_id` INTEGER NOT NULL,
    `cantidad_por_unidad` DECIMAL(10, 3) NOT NULL,

    UNIQUE INDEX `receta_item_producto_id_insumo_id_key`(`producto_id`, `insumo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lista_compra` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `cantidad` DECIMAL(10, 3) NOT NULL,
    `unidad` VARCHAR(30) NOT NULL,
    `prioridad` ENUM('ALTA', 'MEDIA', 'BAJA') NOT NULL DEFAULT 'MEDIA',
    `notas` TEXT NULL,
    `estatus` ENUM('PENDIENTE', 'EN_PROCESO', 'SURTIDO') NOT NULL DEFAULT 'PENDIENTE',
    `creado_por_id` INTEGER NOT NULL,
    `insumo_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `lista_compra_creado_por_id_idx`(`creado_por_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `receta_item` ADD CONSTRAINT `receta_item_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receta_item` ADD CONSTRAINT `receta_item_insumo_id_fkey` FOREIGN KEY (`insumo_id`) REFERENCES `insumo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lista_compra` ADD CONSTRAINT `lista_compra_creado_por_id_fkey` FOREIGN KEY (`creado_por_id`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lista_compra` ADD CONSTRAINT `lista_compra_insumo_id_fkey` FOREIGN KEY (`insumo_id`) REFERENCES `insumo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
