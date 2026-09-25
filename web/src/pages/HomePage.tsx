import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardActionArea, CardContent, Paper, Stack, Typography } from '@mui/material';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import CakeIcon from '@mui/icons-material/Cake';
import CookieIcon from '@mui/icons-material/Cookie';
import BreakfastDiningIcon from '@mui/icons-material/BreakfastDining';
import ChatIcon from '@mui/icons-material/Chat';

/**
 * Featured categories shown on the home page, each with its icon.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const CATEGORIAS = [
  { nombre: 'Conchas', Icono: BakeryDiningIcon },
  { nombre: 'Cuernos', Icono: BreakfastDiningIcon },
  { nombre: 'Roles', Icono: CookieIcon },
  { nombre: 'Encargos', Icono: CakeIcon },
];

/**
 * Home page: hero with tagline and menu CTA, featured categories and a custom-order
 * prompt pointing to the chatbot.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The home page.
 */
export default function HomePage() {
  return (
    <Stack spacing={6}>
      <Paper
        elevation={0}
        sx={{
          textAlign: 'center',
          py: { xs: 6, md: 10 },
          px: 2,
          borderRadius: 4,
          background: 'linear-gradient(135deg, #78350f 0%, #b45309 100%)',
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

      <Box>
        <Typography variant="h5" component="h2" gutterBottom>
          Categorías destacadas
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          {CATEGORIAS.map(({ nombre, Icono }) => (
            <Card key={nombre}>
              <CardActionArea component={RouterLink} to={`/menu?categoria=${nombre}`}>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Icono sx={{ fontSize: 48, color: 'primary.light', mb: 1 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {nombre}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </Box>

      <Paper elevation={0} sx={{ bgcolor: 'secondary.light', p: 4, textAlign: 'center', borderRadius: 4 }}>
        <ChatIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
        <Typography variant="h6" component="h2" gutterBottom>
          ¿Necesitas un encargo especial?
        </Typography>
        <Typography>Pasteles, roscas, cajitas… ¡pregúntale a Yanet en el chat de abajo a la derecha!</Typography>
      </Paper>
    </Stack>
  );
}
