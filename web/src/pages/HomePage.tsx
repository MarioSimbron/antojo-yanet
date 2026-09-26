import { useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery, gql } from '@apollo/client';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ChatIcon from '@mui/icons-material/Chat';
import ProductCard, { type Producto } from '../components/ProductCard';

/**
 * GraphQL query that loads available (non-encargo) products for the featured carousel.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const FEATURED_QUERY = gql`
  query Featured {
    menu(soloDisponibles: true) {
      id
      nombre
      precio
      imagenUrl
      categoria
      stockDisponible
      requiereEncargo
      activo
      descripcion
    }
  }
`;

/**
 * Featured categories shown on the home page, each with its Unsplash background image.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const CATEGORIAS = [
  { nombre: 'Conchas',  img: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&fit=crop&q=80' },
  { nombre: 'Cuernos',  img: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&fit=crop&q=80' },
  { nombre: 'Roles',    img: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&fit=crop&q=80' },
  { nombre: 'Encargos', img: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&fit=crop&q=80' },
];

/**
 * Home page: hero with food-photo background, featured products carousel,
 * photo-backed category cards and a custom-order prompt pointing to the chatbot.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The home page.
 */
export default function HomePage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data, loading } = useQuery<{ menu: Producto[] }>(FEATURED_QUERY);

  const featured = (data?.menu ?? [])
    .filter((p) => !p.requiereEncargo)
    .slice(0, 8);

  /**
   * Scrolls the featured products carousel by the given pixel offset.
   * @author Mario Simbron Gonzalez <simbron420@gmail.com>
   * @param {number} offset - Positive scrolls right, negative scrolls left.
   * @returns {void}
   */
  const scroll = (offset: number) => {
    scrollRef.current?.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <Stack spacing={6}>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          textAlign: 'center',
          py: { xs: 6, md: 10 },
          px: 2,
          borderRadius: 4,
          background: `
            linear-gradient(135deg, rgba(120,53,15,0.84) 0%, rgba(180,83,9,0.74) 100%),
            url(https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1400&fit=crop&q=80)
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: { xs: '55vh', md: '60vh' },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'primary.contrastText',
        }}
      >
        <Typography variant="h2" component="h1" gutterBottom sx={{ fontSize: { xs: '2.5rem', md: '3.75rem' } }}>
          Pan con alma
        </Typography>
        <Typography variant="h6" sx={{ mb: 4, maxWidth: 520, mx: 'auto', opacity: 0.9, fontWeight: 400 }}>
          Conchas, cuernos, roles y encargos especiales. Horneados con amor cada día.
        </Typography>
        <Button variant="contained" color="secondary" size="large" component={RouterLink} to="/menu" sx={{ px: 5, borderRadius: 8 }}>
          Ver menú
        </Button>
      </Paper>

      {/* ── Featured products carousel ─────────────────────────────────────── */}
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h5" component="h2">
            Productos destacados
          </Typography>
          <Stack direction="row" spacing={0.5}>
            <IconButton onClick={() => scroll(-240)} size="small" aria-label="Anterior">
              <ArrowBackIosNewIcon fontSize="small" />
            </IconButton>
            <IconButton onClick={() => scroll(240)} size="small" aria-label="Siguiente">
              <ArrowForwardIosIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress color="secondary" />
          </Box>
        ) : (
          <Box
            ref={scrollRef}
            sx={{
              display: 'flex',
              overflowX: 'auto',
              gap: 2,
              pb: 1,
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {featured.map((p) => (
              <Box key={p.id} sx={{ minWidth: 220, flexShrink: 0 }}>
                <ProductCard producto={p} />
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* ── Category cards ────────────────────────────────────────────────── */}
      <Box>
        <Typography variant="h5" component="h2" gutterBottom>
          Categorías
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          {CATEGORIAS.map(({ nombre, img }) => (
            <Card key={nombre} sx={{ overflow: 'hidden' }}>
              <CardActionArea component={RouterLink} to={`/menu?categoria=${nombre}`}>
                <Box
                  sx={{
                    position: 'relative',
                    height: 160,
                    backgroundImage: `
                      linear-gradient(to top, rgba(0,0,0,0.68) 0%, transparent 60%),
                      url(${img})
                    `,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    alignItems: 'flex-end',
                    p: 2,
                  }}
                >
                  <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1 }}>
                    {nombre}
                  </Typography>
                </Box>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </Box>

      {/* ── Custom order CTA ──────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ bgcolor: 'secondary.light', p: 4, textAlign: 'center', borderRadius: 4 }}>
        <ChatIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
        <Typography variant="h6" component="h2" gutterBottom>
          ¿Necesitas un encargo especial?
        </Typography>
        <Typography>Pasteles, roscas, cajitas… ¡pregúntale a DulceBot en el chat de abajo a la derecha!</Typography>
      </Paper>
    </Stack>
  );
}
