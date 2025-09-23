import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { LoginComponent } from './auth/login/login';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password';
import { ClientesComponent } from './clientes/clientes';
import { ClienteNuevoComponent } from './cliente-nuevo/cliente-nuevo';
import { UsuarioNuevoComponent } from './usuario-nuevo/usuario-nuevo';
import { VentaNuevaComponent } from './ventas/venta-nueva/venta-nueva';
import { ProductoNuevoComponent } from './productos/producto-nuevo/producto-nuevo';
import { ReportesComponent } from './reportes/reportes';
import { ResetPasswordComponent } from './auth/recuperar-reset/recuperar-reset';
import { UsuariosListComponent } from './usuarios/usuarios-list/usuarios-list';
import { UsuariosFormComponent } from './usuarios/usuarios-form/usuarios-form';


export const routes: Routes = [
  { path: 'login',  component: LoginComponent },
  { path: 'home',  component: HomeComponent },

  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent},

  // Clientes
  { path: 'clientes', component: ClientesComponent },
  { path: 'cliente/nuevo', component: ClienteNuevoComponent },
  { path: 'clientes/:id', component: ClientesComponent },
  { path: 'clientes/:id/editar', component: ClientesComponent },

  // Usuarios
  {path: 'usuario/nuevo', component: UsuarioNuevoComponent},
  {path: 'usuarios', component: UsuariosListComponent},
  {path: 'usuarios/nuevo', component: UsuariosFormComponent},
  {path: 'usuarios:is/editar', component: UsuariosFormComponent},

  // Ventas
  {path: 'venta/nueva', component: VentaNuevaComponent},

  // Productos
  {path: 'producto/nuevo', component: ProductoNuevoComponent},

  // Reportes
  {path: 'reportes', component: ReportesComponent},

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