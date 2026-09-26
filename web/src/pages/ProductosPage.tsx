import { useRef, useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControlLabel, Grid, InputAdornment, Snackbar, Stack,
  Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import UploadIcon from '@mui/icons-material/Upload';
import AssignmentIcon from '@mui/icons-material/Assignment';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace('/graphql', '') ?? 'http://localhost:4000';

/**
 * GraphQL query to fetch all products (active and inactive) for admin management.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const PRODUCTOS = gql`
  query Productos {
    productos {
      id sku nombre descripcion precio categoria imagenUrl
      activo stockDisponible requiereEncargo temporadaInicio temporadaFin
    }
  }
`;

/**
 * GraphQL mutation to create a new product. Requires ADMIN role.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const CREAR_PRODUCTO = gql`
  mutation CrearProducto($input: ProductoInput!) {
    crearProducto(input: $input) { id sku nombre activo }
  }
`;

/**
 * GraphQL mutation to update an existing product. Requires ADMIN role.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const ACTUALIZAR_PRODUCTO = gql`
  mutation ActualizarProducto($id: Int!, $input: ActualizarProductoInput!) {
    actualizarProducto(id: $id, input: $input) { id sku nombre activo }
  }
`;

/**
 * GraphQL mutation to hard-delete a product. Requires ADMIN role.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const ELIMINAR_PRODUCTO = gql`
  mutation EliminarProducto($id: Int!) {
    eliminarProducto(id: $id)
  }
`;

type Producto = {
  id: number;
  sku: string;
  nombre: string;
  descripcion?: string;
  precio: string;
  categoria: string;
  imagenUrl?: string;
  activo: boolean;
  stockDisponible: number;
  requiereEncargo: boolean;
  temporadaInicio?: string;
  temporadaFin?: string;
};

type FormState = {
  sku: string;
  nombre: string;
  descripcion: string;
  precio: string;
  categoria: string;
  imagenUrl: string;
  activo: boolean;
  stockDisponible: string;
  requiereEncargo: boolean;
  temporadaInicio: string;
  temporadaFin: string;
};

const EMPTY_FORM: FormState = {
  sku: '', nombre: '', descripcion: '', precio: '', categoria: '',
  imagenUrl: '', activo: true, stockDisponible: '0',
  requiereEncargo: false, temporadaInicio: '', temporadaFin: '',
};

/**
 * Admin page for managing the product catalog. Shows all products (active and inactive)
 * in a table. Provides a create/edit dialog with image upload, and a delete confirmation.
 * When a product requires an encargo, the dialog highlights that section so the admin
 * can fill in the description with requirements and lead-time information.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The products management page.
 */
export default function ProductosPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Producto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Producto | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, loading, error, refetch } = useQuery(PRODUCTOS, { fetchPolicy: 'cache-and-network' });
  const [crearProducto, { loading: creating }] = useMutation(CREAR_PRODUCTO);
  const [actualizarProducto, { loading: updating }] = useMutation(ACTUALIZAR_PRODUCTO);
  const [eliminarProducto, { loading: deleting }] = useMutation(ELIMINAR_PRODUCTO);

  const showSnack = (msg: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, msg, severity });

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleOpen = (p?: Producto) => {
    if (p) {
      setEditTarget(p);
      setForm({
        sku: p.sku,
        nombre: p.nombre,
        descripcion: p.descripcion ?? '',
        precio: p.precio,
        categoria: p.categoria,
        imagenUrl: p.imagenUrl ?? '',
        activo: p.activo,
        stockDisponible: String(p.stockDisponible),
        requiereEncargo: p.requiereEncargo,
        temporadaInicio: p.temporadaInicio ? p.temporadaInicio.slice(0, 10) : '',
        temporadaFin: p.temporadaFin ? p.temporadaFin.slice(0, 10) : '',
      });
    } else {
      setEditTarget(null);
      setForm(EMPTY_FORM);
    }
    setDialogOpen(true);
  };

  const handleClose = () => { setDialogOpen(false); setUploading(false); };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('imagen', file);
    setUploading(true);
    try {
      const res = await fetch(`${API_BASE}/upload-imagen`, { method: 'POST', body: formData });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Error al subir');
      setField('imagenUrl', json.url);
    } catch (err: unknown) {
      showSnack(err instanceof Error ? err.message : 'No se pudo subir la imagen.', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    const input = {
      nombre: form.nombre,
      descripcion: form.descripcion || undefined,
      precio: form.precio,
      categoria: form.categoria,
      imagenUrl: form.imagenUrl || undefined,
      activo: form.activo,
      stockDisponible: parseInt(form.stockDisponible, 10) || 0,
      requiereEncargo: form.requiereEncargo,
      temporadaInicio: form.temporadaInicio || undefined,
      temporadaFin: form.temporadaFin || undefined,
    };
    try {
      if (editTarget) {
        await actualizarProducto({ variables: { id: editTarget.id, input } });
        showSnack('Producto actualizado correctamente.', 'success');
      } else {
        await crearProducto({ variables: { input: { ...input, sku: form.sku } } });
        showSnack('Producto creado correctamente.', 'success');
      }
      await refetch();
      handleClose();
    } catch (e: unknown) {
      showSnack(e instanceof Error ? e.message : 'Ocurrió un error inesperado.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await eliminarProducto({ variables: { id: deleteTarget.id } });
      showSnack('Producto eliminado.', 'success');
      await refetch();
    } catch (e: unknown) {
      showSnack(e instanceof Error ? e.message : 'No se pudo eliminar el producto.', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const productos: Producto[] = data?.productos ?? [];
  const isSaving = creating || updating;
  const canSave =
    form.sku.trim() !== '' &&
    form.nombre.trim() !== '' &&
    form.precio.trim() !== '' &&
    form.categoria.trim() !== '';

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">Productos</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Nuevo producto
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          No se pudo cargar el catálogo. Inténtalo de nuevo.
        </Alert>
      )}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Categoría</TableCell>
              <TableCell align="right">Precio</TableCell>
              <TableCell align="right">Stock</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {productos.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{p.sku}</TableCell>
                <TableCell>{p.nombre}</TableCell>
                <TableCell>{p.categoria}</TableCell>
                <TableCell align="right">${p.precio}</TableCell>
                <TableCell align="right">{p.stockDisponible}</TableCell>
                <TableCell>
                  <Chip
                    label={p.activo ? 'Activo' : 'Inactivo'}
                    color={p.activo ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Button size="small" startIcon={<EditIcon />} onClick={() => handleOpen(p)}>
                      Editar
                    </Button>
                    <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => setDeleteTarget(p)}>
                      Eliminar
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {productos.length === 0 && !error && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Sin productos registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Create / Edit dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editTarget ? `Editar — ${editTarget.nombre}` : 'Nuevo producto'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>

            {/* Basic info */}
            <Box>
              <Typography variant="overline" color="text.secondary">Información básica</Typography>
              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="SKU"
                    value={form.sku}
                    onChange={(e) => setField('sku', e.target.value)}
                    fullWidth
                    required
                    disabled={!!editTarget}
                    size="small"
                    helperText={editTarget ? 'No se puede modificar' : undefined}
                  />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField
                    label="Nombre"
                    value={form.nombre}
                    onChange={(e) => setField('nombre', e.target.value)}
                    fullWidth
                    required
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Categoría"
                    value={form.categoria}
                    onChange={(e) => setField('categoria', e.target.value)}
                    fullWidth
                    required
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Precio"
                    value={form.precio}
                    onChange={(e) => setField('precio', e.target.value)}
                    fullWidth
                    required
                    size="small"
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Stock"
                    value={form.stockDisponible}
                    onChange={(e) => setField('stockDisponible', e.target.value)}
                    type="number"
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Descripción"
                    value={form.descripcion}
                    onChange={(e) => setField('descripcion', e.target.value)}
                    fullWidth
                    multiline
                    rows={form.requiereEncargo ? 3 : 2}
                    size="small"
                    helperText={
                      form.requiereEncargo
                        ? 'Describe los requisitos del encargo: tiempo de anticipación, tallas, sabores, depósito, etc.'
                        : undefined
                    }
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* Image */}
            <Box>
              <Typography variant="overline" color="text.secondary">Imagen del producto</Typography>
              <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mt: 1 }}>
                <Box
                  sx={{
                    width: 100, height: 100, flexShrink: 0, borderRadius: 2,
                    border: '1px solid', borderColor: 'divider',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', bgcolor: 'action.hover',
                  }}
                >
                  {form.imagenUrl ? (
                    <Box
                      component="img"
                      src={form.imagenUrl}
                      alt="preview"
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <ImageIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
                  )}
                </Box>
                <Stack spacing={1} sx={{ flex: 1 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageUpload}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<UploadIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    fullWidth
                  >
                    {uploading ? 'Subiendo...' : 'Subir imagen'}
                  </Button>
                  <TextField
                    label="O pega una URL"
                    value={form.imagenUrl}
                    onChange={(e) => setField('imagenUrl', e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="https://..."
                  />
                </Stack>
              </Stack>
            </Box>

            <Divider />

            {/* Settings */}
            <Box>
              <Typography variant="overline" color="text.secondary">Configuración</Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.activo}
                      onChange={(e) => setField('activo', e.target.checked)}
                      color="success"
                    />
                  }
                  label="Activo (visible en el menú)"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.requiereEncargo}
                      onChange={(e) => setField('requiereEncargo', e.target.checked)}
                    />
                  }
                  label="Requiere encargo"
                />

                {form.requiereEncargo && (
                  <Box
                    sx={{
                      mt: 1, p: 2, borderRadius: 2,
                      bgcolor: 'warning.light', border: '1px solid', borderColor: 'warning.main',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <AssignmentIcon sx={{ color: 'warning.dark', mt: 0.25, flexShrink: 0 }} />
                      <Box>
                        <Typography variant="subtitle2" color="warning.dark" gutterBottom>
                          Producto de encargo
                        </Typography>
                        <Typography variant="body2" color="warning.dark">
                          El cliente deberá proporcionar fecha de entrega y notas al hacer el pedido.
                          Usa el campo <strong>Descripción</strong> de arriba para indicar el tiempo
                          mínimo de anticipación, opciones de personalización y si requiere depósito.
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Box>

            <Divider />

            {/* Season */}
            <Box>
              <Typography variant="overline" color="text.secondary">Temporada (opcional)</Typography>
              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Inicio"
                    value={form.temporadaInicio}
                    onChange={(e) => setField('temporadaInicio', e.target.value)}
                    type="date"
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Fin"
                    value={form.temporadaFin}
                    onChange={(e) => setField('temporadaFin', e.target.value)}
                    type="date"
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </Box>

          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleClose} disabled={isSaving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={isSaving || !canSave || uploading}>
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirmation ───────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar producto</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Eliminar <strong>{deleteTarget?.nombre}</strong> permanentemente? Esta acción no se
            puede deshacer. Si el producto tiene pedidos asociados, la operación fallará.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ width: '100%' }}
        >
          {snackbar.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
