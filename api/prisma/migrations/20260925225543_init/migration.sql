-- CreateTable
CREATE TABLE `usuario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NULL,
    `rol` ENUM('ADMIN', 'MAESTRO_PANADERO', 'CAJERO', 'REPARTIDOR', 'CLIENTE') NOT NULL DEFAULT 'CLIENTE',
    `puntos_saldo` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `usuario_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `producto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sku` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `precio` DECIMAL(10, 2) NOT NULL,
    `categoria` VARCHAR(191) NOT NULL,
    `imagen_url` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `stock_disponible` INTEGER NOT NULL DEFAULT 0,
    `requiere_encargo` BOOLEAN NOT NULL DEFAULT false,
    `temporada_inicio` DATETIME(3) NULL,
    `temporada_fin` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `producto_sku_key`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pedido` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NULL,
    `guest_token` VARCHAR(36) NULL,
    `nombre_cliente` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NOT NULL,
    `tipo_entrega` ENUM('MOSTRADOR', 'DOMICILIO') NOT NULL,
    `direccion` TEXT NULL,
    `forma_pago` ENUM('EFECTIVO', 'TARJETA') NOT NULL,
    `estatus` ENUM('PENDIENTE', 'ESPERANDO_CONFIRMACION', 'EN_PREPARACION', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'SOLICITUD_CANCELACION', 'CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `costo_envio` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `descuento_puntos` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `monto_deposito` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `porcentaje_deposito` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(10, 2) NOT NULL,
    `fecha_entrega_estimada` DATETIME(3) NULL,
    `repartidor_id` INTEGER NULL,
    `tiempo_estimado_minutos` INTEGER NULL,
    `cancelacion_motivo` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `pedido_guest_token_idx`(`guest_token`),
    INDEX `pedido_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_pedido` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pedido_id` INTEGER NOT NULL,
    `producto_id` INTEGER NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `precio_unitario` DECIMAL(10, 2) NOT NULL,
    `es_encargo` BOOLEAN NOT NULL,
    `mensaje_personalizado` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historial_estatus_pedido` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pedido_id` INTEGER NOT NULL,
    `estatus` ENUM('PENDIENTE', 'ESPERANDO_CONFIRMACION', 'EN_PREPARACION', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'SOLICITUD_CANCELACION', 'CANCELADO') NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actor_id` INTEGER NULL,
    `nota` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `factura_cfdi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pedido_id` INTEGER NOT NULL,
    `rfc` VARCHAR(13) NOT NULL,
    `razon_social` VARCHAR(191) NOT NULL,
    `uso_cfdi` VARCHAR(10) NOT NULL,

    UNIQUE INDEX `factura_cfdi_pedido_id_key`(`pedido_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cupon` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(20) NOT NULL,
    `usuario_id` INTEGER NULL,
    `monto_original` DECIMAL(10, 2) NOT NULL,
    `saldo_disponible` DECIMAL(10, 2) NOT NULL,
    `fecha_expiracion` DATETIME(3) NOT NULL,
    `usado` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `cupon_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pedido` ADD CONSTRAINT `pedido_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedido` ADD CONSTRAINT `pedido_repartidor_id_fkey` FOREIGN KEY (`repartidor_id`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_pedido` ADD CONSTRAINT `item_pedido_pedido_id_fkey` FOREIGN KEY (`pedido_id`) REFERENCES `pedido`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_pedido` ADD CONSTRAINT `item_pedido_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_estatus_pedido` ADD CONSTRAINT `historial_estatus_pedido_pedido_id_fkey` FOREIGN KEY (`pedido_id`) REFERENCES `pedido`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_estatus_pedido` ADD CONSTRAINT `historial_estatus_pedido_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `factura_cfdi` ADD CONSTRAINT `factura_cfdi_pedido_id_fkey` FOREIGN KEY (`pedido_id`) REFERENCES `pedido`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
