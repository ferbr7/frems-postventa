import { Component, ElementRef, HostListener, ViewChild, OnInit, computed, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService, Role } from '../core/auth.service';
import { HomeService } from '../core/home.service';

type KPI = { label: string; value: number; suffix?: string; trend?: string };
type QuickAction = { label: string; icon: 'cart' | 'userPlus' | 'bottle' | 'users' | 'chart'; link: string; roles: Role[]; };
type Activity = { what: string; who: string; when: string };
type TopProduct = { name: string; sales: number; amount?: number };
type MenuItem = { label: string; link: string; icon: 'home' | 'cart' | 'users' | 'bottle' | 'chart' | 'bell' | 'settings' | 'ai'; roles: Role[]; soon?: boolean; };

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
})
export class HomeComponent implements OnInit {

  @ViewChild('userMenu', { static: false }) userMenuRef!: ElementRef<HTMLElement>;
  userMenuOpen = false;

  toggleUserMenu() {
    this.userMenuOpen = !this.userMenuOpen;
  }
  closeUserMenu() { this.userMenuOpen = false; }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    if (!this.userMenuRef) return;
    const inside = this.userMenuRef.nativeElement.contains(ev.target as Node);
    if (!inside) this.userMenuOpen = false;
  }

  @ViewChild('sidebar', { static: true }) sidebarRef!: ElementRef<HTMLElement>;

  constructor(
    private router: Router,
    public auth: AuthService,
    private home: HomeService,
  ) {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.activeLink = e.urlAfterRedirects.split('?')[0].split('#')[0] || '/home');
    this.activeLink = (this.router.url || '').split('?')[0].split('#')[0] || '/home';
  }


  // ====== Estado UI ======
  hoveredLink: string | null = null;
  menuHover = false;
  activeLink = '/home';
  private leaveTimer: ReturnType<typeof setTimeout> | null = null;

  // ====== Datos dinámicos ======
  kpis = signal<KPI[]>([
    { label: 'Ventas hoy', value: 0, trend: '—' },
    { label: 'Clientes activos', value: 0, trend: '✓' },
    { label: 'Alertas', value: 0, trend: '✓'},
  ]);
  loadingKpis = signal<boolean>(true);

  activity = signal<Activity[]>([]);
  loadingActivity = signal<boolean>(true);
  topProducts = signal<TopProduct[]>([]);
  topLoading = signal<boolean>(false);

  ngOnInit(): void {
    // cargar KPIs
    this.loadingKpis.set(true);
    this.home.kpis().subscribe({
      next: (res) => {
        const k = res.kpis;
        this.kpis.set([
          { label: 'Ventas hoy', value: k.ventasHoy, trend: k.ventasTrend || '—' },
          { label: 'Clientes activos', value: k.clientesActivos, trend: '✓' },
          { label: 'Alertas', value: k.alertasPendientes, trend: '✓' },
        ]);
        this.loadingKpis.set(false);
      },
      error: () => this.loadingKpis.set(false),
    });

    // cargar actividad
    this.loadingActivity.set(true);
    this.home.activity(5).subscribe({
      next: (res) => {
        const items = (res.items || []).map(r => ({
          what: r.what,
          who: r.who,
          when: new Intl.DateTimeFormat('es-GT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(r.when)),
        }));
        this.activity.set(items);
        this.loadingActivity.set(false);
      },
      error: () => this.loadingActivity.set(false),
    });
    if (this.role === 'admin') {
      this.home.topProducts({ days: 90, limit: 5, by: 'units' }).subscribe({
        next: ({ items }) => {
          this.topProducts.set((items ?? []).map(r => ({
            name: r.nombre,
            sales: r.unidades,
          })));
          this.topLoading.set(false);
        },
        error: () => { /* opcional: manejar error */
          this.topProducts.set([]);
          this.topLoading.set(false);
        }

      });
    }
  }

  // ====== Rol y UI derivados ======
  get role(): Role { return this.auth.role; }

  setRole(r: Role) {
    const u = this.auth.user;
    if (!u) return;
    this.auth.setUser({ ...u, rol: r });
  }

  get initials(): string { return this.auth.initials; }

  menu: MenuItem[] = [
    { label: 'Inicio', link: '/home', icon: 'home', roles: ['admin', 'vendedor'] },
    { label: 'Ventas', link: '/ventas', icon: 'cart', roles: ['admin', 'vendedor'] },
    { label: 'Clientes', link: '/clientes', icon: 'users', roles: ['admin', 'vendedor'] },
    { label: 'Productos', link: '/productos', icon: 'bottle', roles: ['admin', 'vendedor'] },
    { label: 'Usuarios', link: '/usuarios', icon: 'users', roles: ['admin'] },
    { label: 'Reportes', link: '/reportes', icon: 'chart', roles: ['admin'] },
    { label: 'Recs IA', link: '/recomendaciones', icon: 'ai', roles: ['admin', 'vendedor'] },
    { label: 'Configuración', link: '/config', icon: 'settings', roles: ['admin', 'vendedor'], soon: true },
  ];

  quickActions: QuickAction[] = [
    { label: 'Nueva venta', icon: 'cart', link: '/ventas/nueva', roles: ['admin', 'vendedor'] },
    { label: 'Nuevo cliente', icon: 'userPlus', link: '/clientes/nuevo', roles: ['admin', 'vendedor'] },
    { label: 'Nuevo producto', icon: 'bottle', link: '/productos/nuevo', roles: ['admin', 'vendedor'] },
    { label: 'Nuevo usuario', icon: 'users', link: '/usuarios/nuevo', roles: ['admin'] },
  ];

  // === hover sidebar ===
  onEnter(link: string) { this.hoveredLink = link; }

  @HostListener('document:mousemove', ['$event'])
  onDocMousemove(ev: MouseEvent) {
    const inside = this.sidebarRef?.nativeElement?.contains(ev.target as Node);
    if (inside) {
      this.menuHover = true;
      if (this.leaveTimer) clearTimeout(this.leaveTimer);
    } else {
      if (this.leaveTimer) clearTimeout(this.leaveTimer);
      this.leaveTimer = setTimeout(() => { this.menuHover = false; this.hoveredLink = null; }, 7);
    }
  }

  isOn(link: string): boolean {
    if (this.menuHover) return this.hoveredLink === link;
    return this.activeLink === link || this.activeLink.startsWith(link + '/');
  }

  goOrSoon(item: MenuItem, $event: MouseEvent) {
    if (item.soon) { $event.preventDefault(); alert('Próximamente disponible'); return; }
    this.router.navigate([item.link]);
  }
}
