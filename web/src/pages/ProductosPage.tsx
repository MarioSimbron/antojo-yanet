import { useRef, useState } from 'react';
import { useQuery, useLazyQuery, useMutation, gql } from '@apollo/client';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, FormControlLabel, Grid, IconButton, InputAdornment,
  InputLabel, List, ListItem, ListItemText, MenuItem, Select, Snackbar, Stack,
  Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import UploadIcon from '@mui/icons-material/Upload';
import AssignmentIcon from '@mui/icons-material/Assignment';
import MenuBookIcon from '@mui/icons-material/MenuBook';

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

/**
 * GraphQL query to fetch all registered raw-material ingredients.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const INSUMOS = gql`
  query InsumosParaReceta {
    insumos { id nombre unidad }
  }
`;

/**
 * GraphQL query to fetch the Bill-of-Materials (recipe) for one product.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const RECETA = gql`
  query RecetaProducto($productoId: Int!) {
    receta(productoId: $productoId) {
      id insumoId cantidadPorUnidad
      insumo { id nombre unidad }
    }
  }
`;

/**
 * GraphQL mutation that replaces all recipe items for a product atomically.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const GUARDAR_RECETA = gql`
  mutation GuardarReceta($productoId: Int!, $items: [RecetaItemInput!]!) {
    guardarReceta(productoId: $productoId, items: $items)
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

/** A recipe row as shown in the "Editar receta" dialog. */
type RecetaItemRow = {
  insumoId: number;
  cantidadPorUnidad: number;
  insumoNombre: string;
  insumoUnidad: string;
};

type InsumoGql = { id: number; nombre: string; unidad: string };

const EMPTY_FORM: FormState = {
  sku: '', nombre: '', descripcion: '', precio: '', categoria: '',
  imagenUrl: '', activo: true, stockDisponible: '0',
  requiereEncargo: false, temporadaInicio: '', temporadaFin: '',
};

/**
 * Admin page for managing the product catalog. Shows all products (active and inactive)
 * in a table. Provides a create/edit dialog with image upload, and a delete confirmation.
 * Also includes an "Editar receta" dialog (US-D1) where ADMIN configures the Bill-of-
 * Materials (insumos + quantities) for each product; the recipe is used to deduct raw
 * material stock automatically when a production task reaches EN_PROCESO.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The products management page.
 */
export default function ProductosPage() {
  // ── Product dialog state ───────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Producto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Producto | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Recipe dialog state (US-D1) ────────────────────────────────────────────
  const [recetaDialogOpen, setRecetaDialogOpen] = useState(false);
  const [recetaTarget, setRecetaTarget] = useState<Producto | null>(null);
  const [recetaItems, setRecetaItems] = useState<RecetaItemRow[]>([]);
  const [newInsumoId, setNewInsumoId] = useState<number | ''>('');
  const [newCantidad, setNewCantidad] = useState('');

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data, loading, error, refetch } = useQuery(PRODUCTOS, { fetchPolicy: 'cache-and-network' });
  const { data: insumosData } = useQuery<{ insumos: InsumoGql[] }>(INSUMOS);
  const [fetchReceta, { loading: loadingReceta }] = useLazyQuery(RECETA, { fetchPolicy: 'network-only' });

  const [crearProducto, { loading: creating }] = useMutation(CREAR_PRODUCTO);
  const [actualizarProducto, { loading: updating }] = useMutation(ACTUALIZAR_PRODUCTO);
  const [eliminarProducto, { loading: deleting }] = useMutation(ELIMINAR_PRODUCTO);
  const [guardarReceta, { loading: savingReceta }] = useMutation(GUARDAR_RECETA);

  const insumos: InsumoGql[] = insumosData?.insumos ?? [];

  const showSnack = (msg: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, msg, severity });

  // ── Product dialog handlers ────────────────────────────────────────────────

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

  // ── Recipe dialog handlers (US-D1) ─────────────────────────────────────────

  /**
   * Opens the recipe dialog for the given product and loads its current BOM.
   * @author Mario Simbron Gonzalez <simbron420@gmail.com>
   * @param {Producto} p - The product whose recipe will be edited.
   */
  const handleOpenReceta = async (p: Producto) => {
    setRecetaTarget(p);
    setRecetaItems([]);
    setNewInsumoId('');
    setNewCantidad('');
    setRecetaDialogOpen(true);
    const { data: recetaData } = await fetchReceta({ variables: { productoId: p.id } });
    if (recetaData?.receta) {
      setRecetaItems(
        (recetaData.receta as { insumoId: number; cantidadPorUnidad: number; insumo: InsumoGql }[])
          .map((r) => ({
            insumoId: r.insumoId,
            cantidadPorUnidad: r.cantidadPorUnidad,
            insumoNombre: r.insumo.nombre,
            insumoUnidad: r.insumo.unidad,
          })),
      );
    }
  };

  /** Closes and resets the recipe dialog. */
  const handleCloseReceta = () => {
    setRecetaDialogOpen(false);
    setRecetaTarget(null);
    setRecetaItems([]);
    setNewInsumoId('');
    setNewCantidad('');
  };

  /**
   * Adds (or replaces) an ingredient row in the working recipe list.
   * If the same insumo already exists it is updated in place.
   * @author Mario Simbron Gonzalez <simbron420@gmail.com>
   */
  const handleAddRecetaItem = () => {
    if (newInsumoId === '' || !newCantidad || parseFloat(newCantidad) <= 0) return;
    const insumo = insumos.find((i) => i.id === newInsumoId);
    if (!insumo) return;
    setRecetaItems((prev) => [
      ...prev.filter((r) => r.insumoId !== newInsumoId),
      {
        insumoId: newInsumoId as number,
        cantidadPorUnidad: parseFloat(newCantidad),
        insumoNombre: insumo.nombre,
        insumoUnidad: insumo.unidad,
      },
    ]);
    setNewInsumoId('');
    setNewCantidad('');
  };

  /**
   * Persists the working recipe list to the server via guardarReceta.
   * The mutation replaces all RecetaItems for the product atomically.
   * @author Mario Simbron Gonzalez <simbron420@gmail.com>
   */
  const handleSaveReceta = async () => {
    if (!recetaTarget) return;
    try {
      await guardarReceta({
        variables: {
          productoId: recetaTarget.id,
          items: recetaItems.map((r) => ({
            insumoId: r.insumoId,
            cantidadPorUnidad: r.cantidadPorUnidad,
          })),
        },
      });
      showSnack('Receta guardada correctamente.', 'success');
      handleCloseReceta();
    } catch (e: unknown) {
      showSnack(e instanceof Error ? e.message : 'No se pudo guardar la receta.', 'error');
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────

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
                  <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                    <Button size="small" startIcon={<MenuBookIcon />} onClick={() => void handleOpenReceta(p)}>
                      Receta
                    </Button>
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

      {/* ── Editar receta dialog (US-D1) ─────────────────────────────────── */}
      <Dialog open={recetaDialogOpen} onClose={handleCloseReceta} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MenuBookIcon fontSize="small" />
          {recetaTarget ? `Receta — ${recetaTarget.nombre}` : 'Receta'}
        </DialogTitle>
        <DialogContent dividers>
          {loadingReceta ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Stack spacing={3}>
              {/* Current ingredients */}
              <Box>
                <Typography variant="overline" color="text.secondary">
                  Ingredientes actuales
                </Typography>
                {recetaItems.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Sin ingredientes. Agrega al menos uno abajo.
                  </Typography>
                ) : (
                  <List dense disablePadding sx={{ mt: 0.5 }}>
                    {recetaItems.map((item) => (
                      <ListItem
                        key={item.insumoId}
                        disableGutters
                        secondaryAction={
                          <IconButton
                            edge="end"
                            size="small"
                            color="error"
                            onClick={() => setRecetaItems((prev) => prev.filter((r) => r.insumoId !== item.insumoId))}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={item.insumoNombre}
                          secondary={`${item.cantidadPorUnidad} ${item.insumoUnidad} por unidad producida`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>

              <Divider />

              {/* Add ingredient row */}
              <Box>
                <Typography variant="overline" color="text.secondary">
                  Agregar ingrediente
                </Typography>
                {insumos.length === 0 ? (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    No hay materias primas registradas. Agrégalas primero en la página de Inventario.
                  </Alert>
                ) : (
                  <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'flex-start' }}>
                    <FormControl size="small" sx={{ flex: 2 }}>
                      <InputLabel>Insumo</InputLabel>
                      <Select
                        label="Insumo"
                        value={newInsumoId}
                        onChange={(e) => setNewInsumoId(e.target.value as number | '')}
                      >
                        {insumos.map((ins) => (
                          <MenuItem key={ins.id} value={ins.id}>
                            {ins.nombre} <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>({ins.unidad})</Typography>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="Cantidad"
                      size="small"
                      type="number"
                      value={newCantidad}
                      onChange={(e) => setNewCantidad(e.target.value)}
                      sx={{ flex: 1 }}
                      slotProps={{ htmlInput: { min: 0, step: 0.001 } }}
                    />
                    <Button
                      variant="outlined"
                      size="medium"
                      startIcon={<AddIcon />}
                      onClick={handleAddRecetaItem}
                      disabled={newInsumoId === '' || !newCantidad || parseFloat(newCantidad) <= 0}
                      sx={{ whiteSpace: 'nowrap', height: 40 }}
                    >
                      Agregar
                    </Button>
                  </Stack>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseReceta} disabled={savingReceta}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => void handleSaveReceta()}
            disabled={savingReceta || loadingReceta}
          >
            {savingReceta ? 'Guardando...' : 'Guardar receta'}
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
