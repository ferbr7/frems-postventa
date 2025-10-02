import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BehaviorSubject, Subscription, combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { VentasService, VentaListRow } from '../../core/ventas.service';

@Component({
  standalone: true,
  selector: 'app-ventas-list',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ventas-list.html',
})
export class VentasListComponent implements OnInit, OnDestroy {
  private api = inject(VentasService);
  private router = inject(Router);

  // UI state
  loading = false;
  total = 0;

  // filtros
  search = '';
  page = 1;
  size = 5;

  // subjects
  private search$ = new BehaviorSubject<string>('');
  private page$   = new BehaviorSubject<number>(1);
  private size$   = new BehaviorSubject<number>(5);

  private auxSubs: Subscription[] = [];

  // stream
  items$ = combineLatest([
    this.search$.pipe(debounceTime(300), distinctUntilChanged()),
    this.page$.pipe(distinctUntilChanged()),
    this.size$.pipe(distinctUntilChanged()),
  ]).pipe(
    tap(() => (this.loading = true)),
    switchMap(([search, page, size]) =>
      this.api.list({ page, size, search: search || undefined })
    ),
    tap(res => {
      this.total = res?.total ?? 0;
      this.loading = false;
    }),
    map(res => res?.items ?? [] as VentaListRow[]),
    shareReplay(1),
  );

  ngOnInit(): void {
    this.search$.next(this.search);
    this.page$.next(this.page);
    this.size$.next(this.size);
  }
  ngOnDestroy(): void {
    this.auxSubs.forEach(s => s.unsubscribe());
  }

  // handlers
  onSearchChange() {
    this.page = 1;
    this.page$.next(this.page);
    this.search$.next(this.search.trim());
  }
  nextPage() {
    if (this.page < this.pageCount()) { this.page++; this.page$.next(this.page); }
  }
  prevPage() {
    if (this.page > 1) { this.page--; this.page$.next(this.page); }
  }
  changePageSize() {
    this.page = 1;
    this.page$.next(this.page);
    this.size$.next(this.size);
  }
  pageCount(): number {
    return Math.max(1, Math.ceil(this.total / this.size));
  }

  // acciones
  nueva()  { this.router.navigate(['/ventas/nueva']); }
  ver(v: VentaListRow) { this.router.navigate(['/ventas', v.idventa, 'ver']); }
  imprimir(v: VentaListRow) { this.router.navigate(['/ventas', v.idventa, 'imprimir']); } // placeholder
}
