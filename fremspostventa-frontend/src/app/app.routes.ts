import { Routes } from '@angular/router';

import { HomeComponent } from './home/home';
import { LoginComponent } from './auth/login/login';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password';
import { ProductoNuevoComponent } from './productos/producto-nuevo/producto-nuevo';
import { ReportesComponent } from './reportes/reportes';
import { ResetPasswordComponent } from './auth/recuperar-reset/recuperar-reset';
import { UsuariosListComponent } from './usuarios/usuarios-list/usuarios-list';
import { UsuariosFormComponent } from './usuarios/usuarios-form/usuarios-form';
import { ClientesListComponent } from './clientes/clientes-list/clientes-list';
import { ClientesFormComponent } from './clientes/clientes-form/clientes-form';
import { ProductosListComponent } from './productos/productos-list/productos-list';
import { ProductosFormComponent } from './productos/productos-form/productos-form';
import { EntradaInventarioFormComponent } from './inventario/entrada-form/entrada-form';
import { VentasFormComponent } from './ventas/ventas-form/ventas-form';
import { VentasListComponent } from './ventas/ventas-list/ventas-list';
import { VentasPrintComponent } from './ventas/ventas-print/ventas-print';
import { RecsListComponent } from './recomendaciones/recs-list/recs-list';
import { RecsDetailComponent } from './recomendaciones/recs-detail/recs-detail';
import { RecsPrintComponent } from './recomendaciones/recs-print/recs-print';

import { authGuard } from './core/auth.guard';
import { roleGuard } from './core/role.guard';
import { guestGuard } from './core/guest.guard';

export const routes: Routes = [
  // Público solo para invitados
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPasswordComponent, canActivate: [guestGuard] },
  { path: 'reset-password', component: ResetPasswordComponent, canActivate: [guestGuard] },

  // Protegidos (requieren sesión)
  { path: 'home', component: HomeComponent, canActivate: [authGuard] },

  // Clientes (ambos roles)
  { path: 'clientes', component: ClientesListComponent, canActivate: [authGuard] },
  { path: 'clientes/nuevo', component: ClientesFormComponent, canActivate: [authGuard] },
  { path: 'clientes/:id/editar', component: ClientesFormComponent, canActivate: [authGuard] },
  { path: 'clientes/:id/ver', component: ClientesFormComponent, canActivate: [authGuard] },

  // Usuarios (sólo admin)
  { path: 'usuarios', component: UsuariosListComponent, canActivate: [authGuard, roleGuard(['admin'])] },
  { path: 'usuarios/nuevo', component: UsuariosFormComponent, canActivate: [authGuard, roleGuard(['admin'])] },
  { path: 'usuarios/:id/editar', component: UsuariosFormComponent, canActivate: [authGuard, roleGuard(['admin'])] },
  { path: 'usuarios/:id/ver', component: UsuariosFormComponent, canActivate: [authGuard, roleGuard(['admin'])] },

  // Ventas (ambos)
  { path: 'ventas', component: VentasListComponent, canActivate: [authGuard] },
  { path: 'ventas/nueva', component: VentasFormComponent, canActivate: [authGuard] },
  { path: 'ventas/:id/imprimir', component: VentasPrintComponent, canActivate: [authGuard] },
  { path: 'ventas/:id/ver', component: VentasFormComponent, canActivate: [authGuard] },

  // Productos (ambos; si quieres que crear/editar sea solo admin, aplica roleGuard allí)
  { path: 'productos', component: ProductosListComponent, canActivate: [authGuard] },
  { path: 'productos/nuevo', component: ProductosFormComponent, canActivate: [authGuard] },
  { path: 'productos/:id/editar', component: ProductosFormComponent, canActivate: [authGuard] },
  { path: 'productos/:id/ver', component: ProductosFormComponent, canActivate: [authGuard] },
  { path: 'producto/nuevo', component: ProductoNuevoComponent, canActivate: [authGuard] },

  // Inventario (ambos; si quieres que sea admin, agrega roleGuard)
  { path: 'inventario/entrada/nuevo', component: EntradaInventarioFormComponent, canActivate: [authGuard] },

  // Reportes (sólo admin)
  { path: 'reportes', component: ReportesComponent, canActivate: [authGuard, roleGuard(['admin'])] },

  // Recomendaciones (ambos)
  { path: 'recomendaciones', component: RecsListComponent, canActivate: [authGuard] },
  { path: 'recomendaciones/:id/ver', component: RecsDetailComponent, canActivate: [authGuard] },
  { path: 'recomendaciones/:id', component: RecsDetailComponent, canActivate: [authGuard] },
  { path: 'recomendaciones/:id/imprimir', component: RecsPrintComponent, canActivate: [authGuard] },

  // redirect por defecto
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  // SIEMPRE el último
  { path: '**', redirectTo: 'home' },
];
