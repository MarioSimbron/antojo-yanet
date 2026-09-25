import { Box, Button, Card, CardActions, CardContent, CardMedia, Chip, Stack, Typography } from '@mui/material';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import EventIcon from '@mui/icons-material/Event';
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
 * description, price, stock and an add-to-cart button (disabled when a stock product
 * is sold out).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {object} props - Component props.
 * @param {Producto} props.producto - Product to display.
 * @returns {JSX.Element} The product card.
 */
export default function ProductCard({ producto }: { producto: Producto }) {
  const agregarItem = useCarritoStore((s) => s.agregarItem);
  const disponible = producto.requiereEncargo || producto.stockDisponible > 0;

  /**
   * Adds this product to the cart (or increments its quantity).
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
        <Button
          fullWidth
          variant="contained"
          onClick={handleAgregar}
          disabled={!disponible}
          startIcon={producto.requiereEncargo ? <EventIcon /> : <AddShoppingCartIcon />}
        >
          {producto.requiereEncargo ? 'Encargar' : 'Agregar al carrito'}
        </Button>
      </CardActions>
    </Card>
  );
}
