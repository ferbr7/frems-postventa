import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BehaviorSubject, Subscription, combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { ClientesService } from '../../core/clientes.service';

export interface ClienteRow {
  idcliente: number;
  nombre: string;
  apellido: string;
  email: string | null;
  telefono: string;
  direccion: string | null;
  fechaingreso: string;     // ISO
  ultimacompra: string | null;
  compras: number;
}

interface ListResp {
  ok: boolean;
  page: number;
  size: number;           
  total: number;
  items: ClienteRow[];
}

@Component({
  standalone: true,
  selector: 'app-clientes-list',
  imports: [CommonModule, FormsModule, RouterModule, DatePipe],
  templateUrl: './clientes-list.html',
})
export class ClientesListComponent implements OnInit, OnDestroy {
  private api = inject(ClientesService);
  private router = inject(Router);

  // UI
  loading = false;
  total = 0;

  // Filtros enlazados
  search = '';
  page = 1;
  limit = 5;

  // Subjects
  private search$ = new BehaviorSubject<string>('');
  private page$   = new BehaviorSubject<number>(1);
  private limit$  = new BehaviorSubject<number>(5);

  private auxSubs: Subscription[] = [];

  // Stream de items
  items$ = combineLatest([
    this.search$.pipe(debounceTime(300), distinctUntilChanged()),
    this.page$.pipe(distinctUntilChanged()),
    this.limit$.pipe(distinctUntilChanged()),
  ]).pipe(
    tap(() => (this.loading = true)),
    switchMap(([search, page, size]) =>
      this.api.list({ page, size, search: search || undefined }) as unknown as import('rxjs').Observable<ListResp>
    ),
    tap((res: ListResp) => {
      this.total = res?.total ?? 0;
      this.loading = false;
    }),
    map((res: ListResp) => res?.items ?? []),
    shareReplay(1)
  );

  ngOnInit(): void {
    this.search$.next(this.search);
    this.page$.next(this.page);
    this.limit$.next(this.limit);
  }

  ngOnDestroy(): void {
    this.auxSubs.forEach(s => s.unsubscribe());
  }

  // Handlers
  onSearchChange(): void {
    this.page = 1;
    this.page$.next(this.page);
    this.search$.next(this.search.trim());
  }
  nextPage(): void {
    if (this.page < this.pageCount()) {
      this.page++;
      this.page$.next(this.page);
    }
  }
  prevPage(): void {
    if (this.page > 1) {
      this.page--;
      this.page$.next(this.page);
    }
  }
  changePageSize(): void {
    this.page = 1;
    this.page$.next(this.page);
    this.limit$.next(this.limit);
  }
  pageCount(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  get showingFrom(): number {
    return this.total === 0 ? 0 : (this.page - 1) * this.limit + 1;
  }
  get showingTo(): number {
    return Math.min(this.page * this.limit, this.total);
  }

  // Acciones
  nuevo(): void { this.router.navigate(['/clientes/nuevo']); }
  editar(c: ClienteRow): void { this.router.navigate(['/clientes', c.idcliente, 'editar']); }
  ver(c: ClienteRow): void { this.router.navigate(['/clientes', c.idcliente, 'ver']); }
  ia(c:ClienteRow): void {this.router.navigate(['/ia/recomendaciones'])}
}
