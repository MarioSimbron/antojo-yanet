import { useEffect } from 'react';
import { Box, Button, Card, CardActions, CardContent, CardMedia, Chip, IconButton, Stack, Typography } from '@mui/material';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import EventIcon from '@mui/icons-material/Event';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useCarritoStore } from '../store/carrito.store';

/**
 * Product data displayed by the card.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {number} id - Product ID.
 * @property {string} nombre - Product name.
 * @property {string} [descripcion] - Short description.
 * @property {string} precio - Price in MXN (decimal string from the API).
 * @property {string} categoria - Category name.
 * @property {string} [imagenUrl] - Image URL.
 * @property {number} stockDisponible - Units in stock.
 * @property {boolean} requiereEncargo - Whether the product is made-to-order.
 * @property {boolean} activo - Whether the product is active.
 */
export interface Producto {
  id: number;
  nombre: string;
  descripcion?: string;
  precio: string;
  categoria: string;
  imagenUrl?: string;
  stockDisponible: number;
  requiereEncargo: boolean;
  activo: boolean;
}

/**
 * Menu product card: image (or a bread icon placeholder), name, "Encargo" chip,
 * description, price, stock and quantity controls. Shows an add-to-cart button when
 * the product is not in the cart yet; switches to a -/N/+ stepper once added. The "+"
 * is disabled when stock is exhausted (not applicable to made-to-order products).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {object} props - Component props.
 * @param {Producto} props.producto - Product to display.
 * @returns {JSX.Element} The product card.
 */
export default function ProductCard({ producto }: { producto: Producto }) {
  const agregarItem = useCarritoStore((s) => s.agregarItem);
  const actualizarCantidad = useCarritoStore((s) => s.actualizarCantidad);
  const actualizarStock = useCarritoStore((s) => s.actualizarStock);
  const cantidadEnCarrito = useCarritoStore(
    (s) => s.items.find((i) => i.productoId === producto.id)?.cantidad ?? 0,
  );

  const disponible = producto.requiereEncargo || producto.stockDisponible > 0;
  const maxStock = producto.requiereEncargo ? 9999 : producto.stockDisponible;
  const enMaximo = !producto.requiereEncargo && cantidadEnCarrito >= producto.stockDisponible;

  // Sync real stock into the cart item whenever the card renders. This fixes items
  // persisted in localStorage before stockDisponible was introduced (they have no cap
  // and may carry a quantity that exceeds the actual stock).
  useEffect(() => {
    if (cantidadEnCarrito > 0) actualizarStock(producto.id, maxStock);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto.id, maxStock]);

  /**
   * Adds this product to the cart with its stock limit.
   * @author Mario Simbron Gonzalez <simbron420@gmail.com>
   * @returns {void}
   */
  const handleAgregar = () => {
    agregarItem({
      productoId: producto.id,
      nombre: producto.nombre,
      precio: Number(producto.precio),
      esEncargo: producto.requiereEncargo,
      imagenUrl: producto.imagenUrl,
      stockDisponible: maxStock,
    });
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'box-shadow .2s', '&:hover': { boxShadow: 4 } }}>
      {producto.imagenUrl ? (
        <CardMedia component="img" height="140" image={producto.imagenUrl} alt={producto.nombre} />
      ) : (
        <Box sx={{ height: 140, bgcolor: 'background.default', display: 'grid', placeItems: 'center' }}>
          <BakeryDiningIcon sx={{ fontSize: 64, color: 'secondary.main' }} />
        </Box>
      )}
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {producto.nombre}
          </Typography>
          {producto.requiereEncargo && <Chip label="Encargo" size="small" color="secondary" />}
        </Stack>
        {producto.descripcion && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {producto.descripcion}
          </Typography>
        )}
        <Typography variant="h6" color="primary" sx={{ mt: 1 }}>
          ${producto.precio} MXN
        </Typography>
        {!producto.requiereEncargo && (
          <Typography variant="caption" color={producto.stockDisponible > 0 ? 'text.secondary' : 'error'}>
            {producto.stockDisponible > 0 ? `${producto.stockDisponible} disponibles` : 'Sin stock'}
          </Typography>
        )}
      </CardContent>
      <CardActions sx={{ p: 2, pt: 0 }}>
        {cantidadEnCarrito === 0 ? (
          <Button
            fullWidth
            variant="contained"
            onClick={handleAgregar}
            disabled={!disponible}
            startIcon={producto.requiereEncargo ? <EventIcon /> : <AddShoppingCartIcon />}
          >
            {producto.requiereEncargo ? 'Encargar' : 'Agregar al carrito'}
          </Button>
        ) : (
          <Stack direction="row" sx={{ width: '100%', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => actualizarCantidad(producto.id, cantidadEnCarrito - 1)}
              color="primary"
              aria-label="Quitar uno"
              sx={{ border: 1, borderColor: 'primary.main' }}
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
            <Typography variant="body1" sx={{ minWidth: 32, textAlign: 'center', fontWeight: 600 }}>
              {cantidadEnCarrito}
            </Typography>
            <IconButton
              size="small"
              onClick={() => actualizarCantidad(producto.id, cantidadEnCarrito + 1)}
              color="primary"
              disabled={enMaximo}
              aria-label="Agregar uno"
              sx={{ border: 1, borderColor: enMaximo ? 'divider' : 'primary.main' }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </CardActions>
    </Card>
  );
}
