import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, Grid, InputAdornment, Snackbar, Stack, Switch,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

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
 * Admin page for managing the product catalog. Shows a table of all products
 * (including inactive ones) with their stock and status. Provides dialogs to
 * create or fully edit a product, and a delete action with confirmation.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The products management page.
 */
export default function ProductosPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Producto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Producto | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });

  const { data, loading, error, refetch } = useQuery(PRODUCTOS, { fetchPolicy: 'cache-and-network' });
  const [crearProducto, { loading: creating }] = useMutation(CREAR_PRODUCTO);
  const [actualizarProducto, { loading: updating }] = useMutation(ACTUALIZAR_PRODUCTO);
  const [eliminarProducto, { loading: deleting }] = useMutation(ELIMINAR_PRODUCTO);

  const showSnack = (msg: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, msg, severity });

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
        temporadaInicio: p.temporadaInicio ?? '',
        temporadaFin: p.temporadaFin ?? '',
      });
    } else {
      setEditTarget(null);
      setForm(EMPTY_FORM);
    }
    setDialogOpen(true);
  };

  const handleClose = () => setDialogOpen(false);

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
  const canSave = form.sku.trim() !== '' && form.nombre.trim() !== '' && form.precio.trim() !== '' && form.categoria.trim() !== '';

  const field = (key: keyof FormState) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
  });

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
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setDeleteTarget(p)}
                    >
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

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{editTarget ? `Editar — ${editTarget.nombre}` : 'Nuevo producto'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="SKU"
                {...field('sku')}
                fullWidth
                required
                disabled={!!editTarget}
                helperText={editTarget ? 'El SKU no se puede cambiar' : undefined}
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField label="Nombre" {...field('nombre')} fullWidth required />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Descripción" {...field('descripcion')} fullWidth multiline rows={2} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Precio"
                {...field('precio')}
                fullWidth
                required
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Categoría" {...field('categoria')} fullWidth required />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Stock disponible" {...field('stockDisponible')} type="number" fullWidth />
            </Grid>
            <Grid item xs={12}>
              <TextField label="URL de imagen" {...field('imagenUrl')} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Temporada inicio"
                {...field('temporadaInicio')}
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Temporada fin"
                {...field('temporadaFin')}
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.activo}
                    onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  />
                }
                label="Activo (visible en el menú)"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.requiereEncargo}
                    onChange={(e) => setForm({ ...form, requiereEncargo: e.target.checked })}
                  />
                }
                label="Requiere encargo"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isSaving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={isSaving || !canSave}>
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar producto</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Eliminar <strong>{deleteTarget?.nombre}</strong> permanentemente? Esta acción no se puede
            deshacer. Si el producto tiene pedidos asociados, la operación fallará.
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
