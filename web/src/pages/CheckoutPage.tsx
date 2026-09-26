import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, gql } from '@apollo/client';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, Collapse, Divider, FormControlLabel,
  IconButton, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { useCarritoStore, separarCarrito } from '../store/carrito.store';
import { useAuthStore } from '../store/auth.store';

/**
 * GraphQL mutation that creates an order.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const CREAR_PEDIDO = gql`
  mutation CrearPedido($input: CrearPedidoInput!) {
    crearPedido(input: $input) { id guestToken total estatus notasEncargo }
  }
`;

/**
 * Checkout page: cart item list with quantity controls, customer data form, delivery and
 * payment options, custom-order date, optional invoice data and totals summary. Splits
 * mixed carts into two orders and shows a confirmation with tracking links after success.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The checkout page (empty cart, form or confirmation).
 */
export default function CheckoutPage() {
  const { items, limpiarCarrito, calcularSubtotal, actualizarCantidad, quitarItem } = useCarritoStore();
  const { usuario } = useAuthStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nombre: usuario?.nombre ?? '',
    email: usuario?.email ?? '',
    telefono: '',
    tipoEntrega: 'MOSTRADOR',
    direccion: '',
    formaPago: 'EFECTIVO',
    fechaEntregaEstimada: '',
    solicitarFactura: false,
    rfc: '',
    razonSocial: '',
    usoCFDI: 'G03',
    notasEncargo: '',
    imagenRefUrl: '',
  });
  const [error, setError] = useState('');
  const [pedidosCreados, setPedidosCreados] = useState<{ id: number; token?: string }[]>([]);

  const [crearPedido, { loading }] = useMutation(CREAR_PEDIDO);

  const { itemsStock, itemsEncargo } = separarCarrito(items);
  const hayMezcla = itemsStock.length > 0 && itemsEncargo.length > 0;
  const subtotal = calcularSubtotal();
  const costoEnvio = form.tipoEntrega === 'DOMICILIO' ? 30 : 0;
  const total = subtotal + costoEnvio;

  if (items.length === 0 && pedidosCreados.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <ShoppingCartOutlinedIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Tu carrito está vacío
        </Typography>
        <Button variant="contained" onClick={() => navigate('/menu')}>
          Ver menú
        </Button>
      </Box>
    );
  }

  if (pedidosCreados.length > 0) {
    return (
      <Paper variant="outlined" sx={{ maxWidth: 480, mx: 'auto', textAlign: 'center', p: 5 }}>
        <CheckCircleIcon color="success" sx={{ fontSize: 72, mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          ¡Pedido confirmado!
        </Typography>
        <Stack spacing={2} sx={{ mt: 3 }}>
          {pedidosCreados.map((p) => (
            <Stack key={p.id} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography>Folio #{p.id}</Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate(`/seguimiento/${p.id}${p.token ? `?token=${p.token}` : ''}`)}
              >
                Ver seguimiento
              </Button>
            </Stack>
          ))}
        </Stack>
      </Paper>
    );
  }

  /**
   * Submits the order(s): one crearPedido call, or two when the cart mixes stock and
   * custom items. Empties the cart only if every call succeeds.
   * @author Mario Simbron Gonzalez <simbron420@gmail.com>
   * @param {React.FormEvent} e - Form submit event.
   * @returns {Promise<void>}
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const pedidosSets = hayMezcla
      ? [
          { items: itemsStock, esEncargo: false },
          { items: itemsEncargo, esEncargo: true },
        ]
      : [{ items, esEncargo: itemsEncargo.length > 0 }];

    const resultados: { id: number; token?: string }[] = [];
    try {
      for (const set of pedidosSets) {
        const r = await crearPedido({
          variables: {
            input: {
              items: set.items.map((i) => ({
                productoId: i.productoId,
                cantidad: i.cantidad,
              })),
              tipoEntrega: form.tipoEntrega,
              direccion: form.tipoEntrega === 'DOMICILIO' ? form.direccion : undefined,
              formaPago: form.formaPago,
              fechaEntregaEstimada:
                set.esEncargo && form.fechaEntregaEstimada
                  ? form.fechaEntregaEstimada
                  : undefined,
              nombreCliente: form.nombre,
              email: form.email,
              telefono: form.telefono,
              notasEncargo: set.esEncargo && form.notasEncargo ? form.notasEncargo : undefined,
              imagenRefUrl: set.esEncargo && form.imagenRefUrl ? form.imagenRefUrl : undefined,
            },
          },
        });
        const pedido = r.data?.crearPedido;
        resultados.push({ id: pedido.id, token: pedido.guestToken ?? undefined });
      }
      limpiarCarrito();
      setPedidosCreados(resultados);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message ?? 'Error al procesar el pedido');
    }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Checkout
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Tu carrito
          </Typography>
          <Stack divider={<Divider flexItem />} spacing={1.5}>
            {items.map((item) => (
              <Stack key={item.productoId} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography sx={{ fontWeight: 500 }}>
                    {item.nombre} {item.esEncargo && <Chip label="Encargo" size="small" color="secondary" sx={{ ml: 1 }} />}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ${item.precio.toFixed(2)} c/u
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => actualizarCantidad(item.productoId, item.cantidad - 1)} aria-label="Quitar uno">
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <Typography sx={{ minWidth: 24, textAlign: 'center' }}>{item.cantidad}</Typography>
                <IconButton size="small" onClick={() => actualizarCantidad(item.productoId, item.cantidad + 1)} aria-label="Agregar uno">
                  <AddIcon fontSize="small" />
                </IconButton>
                <Typography sx={{ minWidth: 80, textAlign: 'right', fontWeight: 500 }}>
                  ${(item.precio * item.cantidad).toFixed(2)}
                </Typography>
                <IconButton size="small" color="error" onClick={() => quitarItem(item.productoId)} aria-label="Eliminar">
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {hayMezcla && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Tu pedido se dividirá en 2 órdenes (productos de stock + encargos).
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Datos de entrega
          </Typography>
          <Stack component="form" onSubmit={handleSubmit} spacing={2}>
            <TextField
              label="Nombre completo"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                type="email"
                label="Correo electrónico"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <TextField
                type="tel"
                label="Teléfono"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                required
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Entrega"
                value={form.tipoEntrega}
                onChange={(e) => setForm({ ...form, tipoEntrega: e.target.value })}
              >
                <MenuItem value="MOSTRADOR">Recoger en mostrador</MenuItem>
                <MenuItem value="DOMICILIO">Envío a domicilio (+$30)</MenuItem>
              </TextField>
              <TextField
                select
                label="Forma de pago"
                value={form.formaPago}
                onChange={(e) => setForm({ ...form, formaPago: e.target.value })}
              >
                <MenuItem value="EFECTIVO">Efectivo</MenuItem>
                <MenuItem value="TARJETA">Tarjeta</MenuItem>
              </TextField>
            </Stack>

            {form.tipoEntrega === 'DOMICILIO' && (
              <TextField
                label="Dirección de entrega"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                required
              />
            )}

            {itemsEncargo.length > 0 && (
              <TextField
                type="datetime-local"
                label="Fecha y hora de entrega del encargo"
                value={form.fechaEntregaEstimada}
                onChange={(e) => setForm({ ...form, fechaEntregaEstimada: e.target.value })}
                required
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}

            {itemsEncargo.length > 0 && (
              <>
                <TextField
                  multiline
                  minRows={3}
                  label="Detalles del encargo"
                  placeholder="Describe el diseño, sabor, relleno, mensaje en el pastel, colores, etc."
                  value={form.notasEncargo}
                  onChange={(e) => setForm({ ...form, notasEncargo: e.target.value })}
                />
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Imagen de referencia (opcional)
                  </Typography>
                  {form.imagenRefUrl ? (
                    <Stack spacing={1}>
                      <Box
                        component="img"
                        src={form.imagenRefUrl}
                        alt="Referencia del encargo"
                        sx={{ maxHeight: 180, maxWidth: '100%', borderRadius: 2, objectFit: 'contain', border: '1px solid', borderColor: 'divider' }}
                      />
                      <Button size="small" color="error" variant="outlined" onClick={() => setForm({ ...form, imagenRefUrl: '' })}>
                        Quitar imagen
                      </Button>
                    </Stack>
                  ) : (
                    <Button
                      component="label"
                      variant="outlined"
                      startIcon={<UploadFileIcon />}
                      size="small"
                    >
                      Subir imagen
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            alert('La imagen debe pesar menos de 2 MB.');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => setForm((f) => ({ ...f, imagenRefUrl: reader.result as string }));
                          reader.readAsDataURL(file);
                        }}
                      />
                    </Button>
                  )}
                </Box>
              </>
            )}

            <FormControlLabel
              control={
                <Checkbox
                  checked={form.solicitarFactura}
                  onChange={(e) => setForm({ ...form, solicitarFactura: e.target.checked })}
                />
              }
              label="Solicitar factura"
            />

            <Collapse in={form.solicitarFactura} unmountOnExit>
              <Stack spacing={2}>
                <TextField
                  label="RFC"
                  value={form.rfc}
                  onChange={(e) => setForm({ ...form, rfc: e.target.value })}
                  required
                />
                <TextField
                  label="Razón social"
                  value={form.razonSocial}
                  onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                  required
                />
                <TextField
                  label="Uso CFDI"
                  helperText="Ej. G03"
                  value={form.usoCFDI}
                  onChange={(e) => setForm({ ...form, usoCFDI: e.target.value })}
                  required
                />
              </Stack>
            </Collapse>

            <Paper elevation={0} sx={{ bgcolor: 'background.default', p: 2 }}>
              <Stack spacing={0.5}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', color: 'text.secondary' }}>
                  <Typography>Subtotal</Typography>
                  <Typography>${subtotal.toFixed(2)}</Typography>
                </Stack>
                {costoEnvio > 0 && (
                  <Stack direction="row" sx={{ justifyContent: 'space-between', color: 'text.secondary' }}>
                    <Typography>Envío</Typography>
                    <Typography>$30.00</Typography>
                  </Stack>
                )}
                <Divider />
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="h6">Total</Typography>
                  <Typography variant="h6">${total.toFixed(2)} MXN</Typography>
                </Stack>
                {itemsEncargo.length > 0 && (
                  <Typography variant="caption" color="secondary.dark">
                    * Requiere depósito del 50% al confirmar
                  </Typography>
                )}
              </Stack>
            </Paper>

            <Button type="submit" variant="contained" size="large" disabled={loading} loading={loading}>
              Confirmar pedido
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
