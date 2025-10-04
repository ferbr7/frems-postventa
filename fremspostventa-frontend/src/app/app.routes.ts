import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { LoginComponent } from './auth/login/login';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password';
import { VentaNuevaComponent } from './ventas/venta-nueva/venta-nueva';
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

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent },

  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },

  // Clientes
  { path: 'clientes', component: ClientesListComponent },
  { path: 'clientes/nuevo', component: ClientesFormComponent },
  { path: 'clientes/:id/editar', component: ClientesFormComponent },
  { path: 'clientes/:id/ver', component: ClientesFormComponent },

  // Usuarios
  { path: 'usuarios', component: UsuariosListComponent },
  { path: 'usuarios/nuevo', component: UsuariosFormComponent },
  { path: 'usuarios/:id/editar', component: UsuariosFormComponent },
  { path: 'usuarios/:id/ver', component: UsuariosFormComponent },

  // Ventas
  { path: 'venta/nueva', component: VentaNuevaComponent },
  { path: 'ventas', component: VentasListComponent },
  { path: 'ventas/nueva', component: VentasFormComponent },
  { path: 'ventas/:id/imprimir', component: VentasPrintComponent },
  { path: 'ventas/:id/ver', component: VentasFormComponent },


  // Productos
  { path: 'producto/nuevo', component: ProductoNuevoComponent },
  { path: 'inventario/entrada/nuevo', component: EntradaInventarioFormComponent },

  // Reportes
  { path: 'reportes', component: ReportesComponent },
  { path: 'productos', component: ProductosListComponent },
  { path: 'productos/nuevo', component: ProductosFormComponent },
  { path: 'productos/:id/editar', component: ProductosFormComponent },
  { path: 'productos/:id/ver', component: ProductosFormComponent },

  //Recs
  { path: 'recomendaciones', component: RecsListComponent},
  { path: 'recomendaciones/:id', component: RecsDetailComponent},

  // IA (lazy)
  {
    path: 'ia/recomendaciones',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./ia/ia-list/ia-list').then(m => m.IaListComponent),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./ia/ia-detail/ia-detail').then(m => m.IaDetailComponent),
      },
      {
        path: ':id/imprimir',
        loadComponent: () =>
          import('./ia/ia-print/ia-print').then(m => m.IaPrintComponent),
      },
    ],
  },

  // redirect por defecto
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // SIEMPRE el último
  { path: '**', redirectTo: 'login' },
];