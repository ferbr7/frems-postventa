import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

type KPI = { label: string; value: number; suffix?: string; trend?: string };
type QuickAction = {
  label: string;
  icon: 'cart' | 'userPlus' | 'bottle' | 'users' | 'chart';
  link: string;
  roles: ('admin' | 'vendedor')[];
};
type Activity = { what: string; who: string; when: string };
type TopProduct = { name: string; sales: number };

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
})
export class HomeComponent {
  @ViewChild('sidebar', { static: true }) sidebarRef!: ElementRef<HTMLElement>;

  // --- estado del menú
  hoveredLink: string | null = null; // item bajo cursor
  menuHover = false;                 // el mouse está dentro del sidebar
  activeLink = '/home';              // activo real (fallback: inicio)

  private leaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private router: Router) {
    // activo real por navegación
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.activeLink = e.urlAfterRedirects.split('?')[0].split('#')[0] || '/home';
      });

    // activo real al cargar (por si no hubo navegación todavía)
    const now = (this.router.url || '').split('?')[0].split('#')[0];
    this.activeLink = now || '/home';
  }

  // --- hover por item
  onEnter(link: string) {
    this.hoveredLink = link;
  }

  // --- detector global: si el mouse está fuera del sidebar, se apaga hover
  @HostListener('document:mousemove', ['$event'])
  onDocMousemove(ev: MouseEvent) {
    const inside = this.sidebarRef?.nativeElement?.contains(ev.target as Node);
    if (inside) {
      this.menuHover = true;
      if (this.leaveTimer) clearTimeout(this.leaveTimer);
    } else {
      // pequeño debounce para evitar parpadeo al pasar por bordes
      if (this.leaveTimer) clearTimeout(this.leaveTimer);
      this.leaveTimer = setTimeout(() => {
        this.menuHover = false;
        this.hoveredLink = null; // ← vuelve a pintar el activo real (Inicio si estás en /home)
      }, 7);
    }
  }

  // decide si el link se pinta “activo” (verde)
  isOn(link: string): boolean {
    if (this.menuHover) return this.hoveredLink === link; // mientras esté dentro, manda el hover
    // activo real (incluye subrutas)
    return this.activeLink === link || this.activeLink.startsWith(link + '/');
  }

  // ====== DATA DE LA MAQUETA ======
  role: 'admin' | 'vendedor' = 'vendedor';
  setRole(r: 'admin' | 'vendedor') { this.role = r; }

  menu = [
    { label: 'Inicio',        link: '/home',          icon: 'home' },
    { label: 'Ventas',        link: '/ventas',        icon: 'cart' },
    { label: 'Clientes',      link: '/clientes',      icon: 'users' },
    { label: 'Productos',     link: '/productos',     icon: 'bottle' },
    { label: 'Usuarios',      link: '/usuarios',      icon: 'users' },
    { label: 'Reportes',      link: '/reportes',      icon: 'chart' },
    { label: 'Recordatorios', link: '/recordatorios', icon: 'bell' },
    { label: 'Configuración', link: '/config',        icon: 'settings' },
  ];

  kpis: KPI[] = [
    { label: 'Ventas hoy',        value: 18,  trend: '+12%' },
    { label: 'Clientes activos',  value: 126, trend: '+8%'  },
    { label: 'Alertas',           value: 3,   trend: '−1'   },
  ];

  quickActions: QuickAction[] = [
    { label: 'Nueva venta',   icon: 'cart',     link: '/ventas/nueva',   roles: ['admin','vendedor'] },
    { label: 'Nuevo cliente', icon: 'userPlus', link: '/clientes/nuevo', roles: ['admin','vendedor'] },
    { label: 'Producto',      icon: 'bottle',   link: '/productos',      roles: ['admin','vendedor'] },
    { label: 'Usuarios',      icon: 'users',    link: '/usuarios',       roles: ['admin'] },
    { label: 'Reportes',      icon: 'chart',    link: '/reportes',       roles: ['admin'] },
  ];

  activity: Activity[] = [
    { what: 'Vendiste Perfume Aurora 50ml', who: 'Tú',   when: 'hace 10 min' },
    { what: 'Nuevo cliente: Luis M.',       who: 'Ana',  when: 'hace 1 h'    },
    { what: 'Seguimiento posventa agendado',who: 'Karla',when: 'ayer'        },
  ];

  topProducts: TopProduct[] = [
    { name: 'Aurora 50ml',        sales: 42 },
    { name: 'Citrus Bloom 100ml', sales: 31 },
    { name: 'Noir Intense 30ml',  sales: 27 },
  ];
}
