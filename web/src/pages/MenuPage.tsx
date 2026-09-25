import { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, Chip, CircularProgress, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import ProductCard, { type Producto } from '../components/ProductCard';

/**
 * GraphQL query for the menu products and the list of categories.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const MENU_QUERY = gql`
  query Menu($categoria: String, $soloDisponibles: Boolean) {
    menu(categoria: $categoria, soloDisponibles: $soloDisponibles) {
      id sku nombre descripcion precio categoria imagenUrl activo
      stockDisponible requiereEncargo
    }
    categorias
  }
`;

/**
 * Menu page: category chips (initialised from the `?categoria=` query param), an
 * "available only" switch and a grid of ProductCards, with loading and error states.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The menu page.
 */
export default function MenuPage() {
  const [searchParams] = useSearchParams();
  const [categoria, setCategoria] = useState(searchParams.get('categoria') ?? '');
  const [soloDisponibles, setSoloDisponibles] = useState(false);

  const { data, loading, error } = useQuery(MENU_QUERY, {
    variables: { categoria: categoria || undefined, soloDisponibles },
  });

  const categorias: string[] = ['', ...(data?.categorias ?? [])];

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Nuestro Menú
      </Typography>

      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {categorias.map((cat) => (
          <Chip
            key={cat || 'todos'}
            label={cat || 'Todos'}
            color="primary"
            variant={categoria === cat ? 'filled' : 'outlined'}
            onClick={() => setCategoria(cat)}
          />
        ))}
      </Stack>

      <FormControlLabel
        control={<Switch checked={soloDisponibles} onChange={(e) => setSoloDisponibles(e.target.checked)} />}
        label="Solo productos disponibles"
        sx={{ mb: 3 }}
      />

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error">Error al cargar el menú.</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 3 }}>
        {((data?.menu ?? []) as Producto[]).map((producto) => (
          <ProductCard key={producto.id} producto={producto} />
        ))}
      </Box>
    </Box>
  );
}
