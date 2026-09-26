import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, gql } from '@apollo/client';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, Collapse, Divider, FormControlLabel,
  FormHelperText, IconButton, MenuItem, Paper, Snackbar, Stack, TextField, Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { useState } from 'react';
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

/** Minimum hours in advance required for a custom order (encargo). */
const ENCARGO_MIN_HOURS = 48;
/** Maximum days in advance allowed for a custom order. */
const ENCARGO_MAX_DAYS = 30;

/**
 * Builds a Yup validation schema for the checkout form.
 * Rules involving delivery date are only applied when the cart has encargo items.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {boolean} tieneEncargo - Whether the current cart contains encargo items.
 * @returns {Yup.ObjectSchema} Compiled validation schema.
 */
function buildSchema(tieneEncargo: boolean) {
  return Yup.object({
    nombre: Yup.string().trim().required('El nombre es requerido'),
    email: Yup.string().email('Correo inválido').required('El correo es requerido'),
    telefono: Yup.string()
      .matches(/^\d{10}$/, 'El teléfono debe tener 10 dígitos')
      .required('El teléfono es requerido'),
    tipoEntrega: Yup.string().required(),
    direccion: Yup.string().when('tipoEntrega', {
      is: 'DOMICILIO',
      then: (s) => s.trim().required('La dirección es requerida para envío a domicilio'),
      otherwise: (s) => s.optional(),
    }),
    formaPago: Yup.string().required(),
    fechaEntregaEstimada: tieneEncargo
      ? Yup.string()
          .required('La fecha de entrega es requerida')
          .test('min-48h', `La fecha debe ser al menos ${ENCARGO_MIN_HOURS}h desde ahora`, (v) => {
            if (!v) return false;
            const diff = new Date(v).getTime() - Date.now();
            return diff >= ENCARGO_MIN_HOURS * 60 * 60 * 1000;
          })
          .test('max-30d', `La fecha no puede ser más de ${ENCARGO_MAX_DAYS} días desde ahora`, (v) => {
            if (!v) return false;
            const diff = new Date(v).getTime() - Date.now();
            return diff <= ENCARGO_MAX_DAYS * 24 * 60 * 60 * 1000;
          })
      : Yup.string().optional(),
    solicitarFactura: Yup.boolean(),
    rfc: Yup.string().when('solicitarFactura', {
      is: true,
      then: (s) =>
        s
          .matches(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i, 'RFC inválido')
          .required('El RFC es requerido'),
      otherwise: (s) => s.optional(),
    }),
    razonSocial: Yup.string().when('solicitarFactura', {
      is: true,
      then: (s) => s.trim().required('La razón social es requerida'),
      otherwise: (s) => s.optional(),
    }),
    usoCFDI: Yup.string().when('solicitarFactura', {
      is: true,
      then: (s) => s.trim().required('El uso CFDI es requerido'),
      otherwise: (s) => s.optional(),
    }),
    notasEncargo: Yup.string().optional(),
    imagenRefUrl: Yup.string().optional(),
  });
}

/**
 * Checkout page: cart item list with quantity controls, customer data form, delivery and
 * payment options, custom-order date, optional invoice data and totals summary. Splits
 * mixed carts into two orders and shows a confirmation with tracking links after success.
 * Uses Formik + Yup for client-side validation; errors are surfaced via a floating Snackbar.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The checkout page (empty cart, form or confirmation).
 */
export default function CheckoutPage() {
  const { items, limpiarCarrito, calcularSubtotal, actualizarCantidad, quitarItem } = useCarritoStore();
  const { usuario } = useAuthStore();
  const navigate = useNavigate();

  const [pedidosCreados, setPedidosCreados] = useState<{ id: number; token?: string }[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'error' | 'success' }>({
    open: false,
    message: '',
    severity: 'error',
  });

  const [crearPedido, { loading }] = useMutation(CREAR_PEDIDO);

  const { itemsStock, itemsEncargo } = separarCarrito(items);
  const hayMezcla = itemsStock.length > 0 && itemsEncargo.length > 0;
  const tieneEncargo = itemsEncargo.length > 0;

  /**
   * Ref pointing to the hidden file input so it can be reset after clearing the image.
   * @author Mario Simbron Gonzalez <simbron420@gmail.com>
   */
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formik = useFormik({
    initialValues: {
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
    },
    validationSchema: buildSchema(tieneEncargo),
    validateOnBlur: true,
    validateOnChange: false,
    /**
     * Handles form submission: creates one or two orders depending on whether the cart
     * mixes stock and encargo items. Clears the cart only when all calls succeed.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {typeof formik.values} values - Validated form values.
     * @returns {Promise<void>}
     */
    onSubmit: async (values) => {
      const pedidosSets = hayMezcla
        ? [
            { items: itemsStock, esEncargo: false },
            { items: itemsEncargo, esEncargo: true },
          ]
        : [{ items, esEncargo: tieneEncargo }];

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
                tipoEntrega: values.tipoEntrega,
                direccion: values.tipoEntrega === 'DOMICILIO' ? values.direccion : undefined,
                formaPago: values.formaPago,
                fechaEntregaEstimada:
                  set.esEncargo && values.fechaEntregaEstimada ? values.fechaEntregaEstimada : undefined,
                nombreCliente: values.nombre,
                email: values.email,
                telefono: values.telefono,
                notasEncargo: set.esEncargo && values.notasEncargo ? values.notasEncargo : undefined,
                imagenRefUrl: set.esEncargo && values.imagenRefUrl ? values.imagenRefUrl : undefined,
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
        setSnackbar({ open: true, message: err?.message ?? 'Error al procesar el pedido', severity: 'error' });
      }
    },
  });

  const subtotal = calcularSubtotal();
  const costoEnvio = formik.values.tipoEntrega === 'DOMICILIO' ? 30 : 0;
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

  /** Helper: returns Formik error text for a field only when it has been touched. */
  const fe = (field: keyof typeof formik.values) =>
    formik.touched[field] && formik.errors[field] ? String(formik.errors[field]) : undefined;

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
                    {item.nombre}{' '}
                    {item.esEncargo && <Chip label="Encargo" size="small" color="secondary" sx={{ ml: 1 }} />}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ${item.precio.toFixed(2)} c/u
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => actualizarCantidad(item.productoId, item.cantidad - 1)}
                  aria-label="Quitar uno"
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <Typography sx={{ minWidth: 24, textAlign: 'center' }}>{item.cantidad}</Typography>
                <IconButton
                  size="small"
                  onClick={() => actualizarCantidad(item.productoId, item.cantidad + 1)}
                  aria-label="Agregar uno"
                  disabled={!item.esEncargo && item.cantidad >= (item.stockDisponible ?? Infinity)}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
                <Typography sx={{ minWidth: 80, textAlign: 'right', fontWeight: 500 }}>
                  ${(item.precio * item.cantidad).toFixed(2)}
                </Typography>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => quitarItem(item.productoId)}
                  aria-label="Eliminar"
                >
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

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Datos de entrega
          </Typography>
          <Stack component="form" onSubmit={formik.handleSubmit} spacing={2}>
            <TextField
              label="Nombre completo"
              {...formik.getFieldProps('nombre')}
              error={!!fe('nombre')}
              helperText={fe('nombre')}
              required
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                type="email"
                label="Correo electrónico"
                {...formik.getFieldProps('email')}
                error={!!fe('email')}
                helperText={fe('email')}
                required
              />
              <TextField
                type="tel"
                label="Teléfono"
                {...formik.getFieldProps('telefono')}
                error={!!fe('telefono')}
                helperText={fe('telefono')}
                required
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Entrega"
                {...formik.getFieldProps('tipoEntrega')}
              >
                <MenuItem value="MOSTRADOR">Recoger en mostrador</MenuItem>
                <MenuItem value="DOMICILIO">Envío a domicilio (+$30)</MenuItem>
              </TextField>
              <TextField
                select
                label="Forma de pago"
                {...formik.getFieldProps('formaPago')}
              >
                <MenuItem value="EFECTIVO">Efectivo</MenuItem>
                <MenuItem value="TARJETA">Tarjeta</MenuItem>
              </TextField>
            </Stack>

            {formik.values.tipoEntrega === 'DOMICILIO' && (
              <TextField
                label="Dirección de entrega"
                {...formik.getFieldProps('direccion')}
                error={!!fe('direccion')}
                helperText={fe('direccion')}
                required
              />
            )}

            {tieneEncargo && (
              <TextField
                type="datetime-local"
                label="Fecha y hora de entrega del encargo"
                {...formik.getFieldProps('fechaEntregaEstimada')}
                error={!!fe('fechaEntregaEstimada')}
                helperText={fe('fechaEntregaEstimada') ?? `Mínimo 48 h desde ahora, máximo 30 días`}
                required
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}

            {tieneEncargo && (
              <>
                <TextField
                  multiline
                  minRows={3}
                  label="Detalles del encargo"
                  placeholder="Describe el diseño, sabor, relleno, mensaje en el pastel, colores, etc."
                  {...formik.getFieldProps('notasEncargo')}
                />
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Imagen de referencia (opcional)
                  </Typography>
                  {formik.values.imagenRefUrl ? (
                    <Stack spacing={1}>
                      <Box
                        component="img"
                        src={formik.values.imagenRefUrl}
                        alt="Referencia del encargo"
                        sx={{
                          maxHeight: 180,
                          maxWidth: '100%',
                          borderRadius: 2,
                          objectFit: 'contain',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      />
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={() => {
                          formik.setFieldValue('imagenRefUrl', '');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        Quitar imagen
                      </Button>
                    </Stack>
                  ) : (
                    <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} size="small">
                      Subir imagen
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            setSnackbar({ open: true, message: 'La imagen debe pesar menos de 2 MB.', severity: 'error' });
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () =>
                            formik.setFieldValue('imagenRefUrl', reader.result as string);
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
                  checked={formik.values.solicitarFactura}
                  onChange={(e) => formik.setFieldValue('solicitarFactura', e.target.checked)}
                />
              }
              label="Solicitar factura"
            />

            <Collapse in={formik.values.solicitarFactura} unmountOnExit>
              <Stack spacing={2}>
                <TextField
                  label="RFC"
                  {...formik.getFieldProps('rfc')}
                  error={!!fe('rfc')}
                  helperText={fe('rfc')}
                  required
                />
                <TextField
                  label="Razón social"
                  {...formik.getFieldProps('razonSocial')}
                  error={!!fe('razonSocial')}
                  helperText={fe('razonSocial')}
                  required
                />
                <TextField
                  label="Uso CFDI"
                  helperText={fe('usoCFDI') ?? 'Ej. G03'}
                  {...formik.getFieldProps('usoCFDI')}
                  error={!!fe('usoCFDI')}
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
                {tieneEncargo && (
                  <Typography variant="caption" color="secondary.dark">
                    * Requiere depósito del 50% al confirmar
                  </Typography>
                )}
              </Stack>
            </Paper>

            {/* Show field-level validation summary when the user hits submit with errors */}
            {formik.submitCount > 0 && Object.keys(formik.errors).length > 0 && (
              <FormHelperText error sx={{ fontSize: '0.85rem' }}>
                Por favor corrige los campos marcados antes de continuar.
              </FormHelperText>
            )}

            <Button type="submit" variant="contained" size="large" disabled={loading} loading={loading}>
              Confirmar pedido
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Floating error/success Snackbar — visible regardless of scroll position */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
