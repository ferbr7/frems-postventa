import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BehaviorSubject, Subscription, combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { ProductosService, Producto } from '../../core/productos.service';

interface ListResp {
  ok: boolean;
  page: number;
  size: number;
  total: number;
  items: Producto[];
}

@Component({
  standalone: true,
  selector: 'app-productos-list',
  imports: [CommonModule, FormsModule, RouterModule, CurrencyPipe],
  templateUrl: './productos-list.html',
})
export class ProductosListComponent implements OnInit, OnDestroy {
  private api = inject(ProductosService);
  private router = inject(Router);

  // Estado UI
  loading = false;
  total = 0;

  // filtros
  search = '';
  page = 1;
  limit = 5;
  order: 'recientes' | 'antiguos' | 'mod' = 'mod';

  // Subjects
  private search$ = new BehaviorSubject<string>('');
  private page$ = new BehaviorSubject<number>(1);
  private limit$ = new BehaviorSubject<number>(5);
  private order$ = new BehaviorSubject<'recientes' | 'antiguos'| 'mod'>('mod');

  private auxSubs: Subscription[] = [];

  // Stream items
  items$ = combineLatest<[string, number, number, 'recientes' | 'antiguos' | 'mod']>([
    this.search$.pipe(debounceTime(300), distinctUntilChanged()),
    this.page$.pipe(distinctUntilChanged()),
    this.limit$.pipe(distinctUntilChanged()),
    this.order$.pipe(distinctUntilChanged()),
  ]).pipe(
    tap(() => (this.loading = true)),
    switchMap(([search, page, limit, order]) =>
      this.api.list({ search: search || undefined, page, limit, order })
    ),
    tap((res: ListResp) => {
      this.total = res?.total ?? 0;
      this.page = res?.page ?? this.page;
      this.limit = res?.size ?? this.limit;
      this.loading = false;
    }),
    map((res: ListResp) => res?.items ?? []),
    shareReplay(1)
  );

  ngOnInit() {
    this.search$.next(this.search);
    this.page$.next(this.page);
    this.limit$.next(this.limit);
    this.order$.next(this.order);
  }
  ngOnDestroy() { this.auxSubs.forEach(s => s.unsubscribe()); }

  // Handlers
  onSearchChange() { this.page = 1; this.page$.next(this.page); this.search$.next(this.search.trim()); }
  nextPage() { if (this.page < this.pageCount()) { this.page++; this.page$.next(this.page); } }
  prevPage() { if (this.page > 1) { this.page--; this.page$.next(this.page); } }
  changePageSize() { this.page = 1; this.page$.next(this.page); this.limit$.next(this.limit); }
  toggleOrder() { this.order = this.order === 'recientes' ? 'antiguos' : 'recientes'; this.order$.next(this.order); }

  pageCount(): number { return Math.max(1, Math.ceil(this.total / this.limit)); }
  get showingFrom() { return this.total === 0 ? 0 : (this.page - 1) * this.limit + 1; }
  get showingTo() { return Math.min(this.page * this.limit, this.total); }

  // Acciones
  nuevo() { this.router.navigate(['/productos/nuevo']); }
  ver(p: Producto) { this.router.navigate(['/productos', p.idproducto, 'ver']); }
  editar(p: Producto) { this.router.navigate(['/productos', p.idproducto, 'editar']); }
  entrada(p: any) {
    this.router.navigate(['/inventario/entrada/nuevo'], { queryParams: { producto: p.idproducto } });
  }

  toggleEstado(p: Producto) {
    const nuevo = !p.activo;
    // optimista
    p.activo = nuevo;
    const sub = this.api.setEstado(p.idproducto, nuevo).subscribe({
      error: () => (p.activo = !nuevo),
    });
    this.auxSubs.push(sub);
  }
}
