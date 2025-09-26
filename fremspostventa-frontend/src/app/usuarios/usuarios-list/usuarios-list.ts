import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UsersService } from '../../core/users.service';
import {
  BehaviorSubject,
  Subscription,
  combineLatest,
} from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs/operators';

type RolNombre = 'Admin' | 'Vendedor' | string;

export interface UsuarioRow {
  idusuario: number;
  nombre: string;
  apellido: string;
  email: string;
  username: string;
  fechaalta: string; // ISO
  idrol: number;
  activo: boolean;
  roles?: { nombre: RolNombre };
}

interface ListResp {
  ok: boolean;
  page: number;
  limit: number;
  total: number;
  items: UsuarioRow[];
}

@Component({
  standalone: true,
  selector: 'app-usuarios-list',
  imports: [CommonModule, FormsModule, RouterModule, DatePipe],
  templateUrl: './usuarios-list.html',
})
export class UsuariosListComponent implements OnInit, OnDestroy {
  private api = inject(UsersService);
  private router = inject(Router);

  /** Estado UI */
  loading = false;
  total = 0;

  /** Estado de filtros enlazado a la vista */
  search = '';
  page = 1;
  limit = 5;

  /** Subjects para producir cambios (1 sola petición por cambio) */
  private search$ = new BehaviorSubject<string>('');
  private page$ = new BehaviorSubject<number>(1);
  private limit$ = new BehaviorSubject<number>(5);

  /** Para limpiar subscripciones auxiliares */
  private auxSubs: Subscription[] = [];

  /**
   * Stream de items que la plantilla consume con | async.
   * - Debounce de la búsqueda
   * - Distinct para no repetir valores iguales
   * - Manejo de loading y total dentro de tap()
   */
  items$ = combineLatest([
    this.search$.pipe(debounceTime(300), distinctUntilChanged()),
    this.page$.pipe(distinctUntilChanged()),
    this.limit$.pipe(distinctUntilChanged()),
  ]).pipe(
    tap(() => (this.loading = true)),
    switchMap(([search, page, limit]) =>
      this.api.list({ page, limit, search: search || undefined }) as unknown as import('rxjs').Observable<ListResp>
    ),
    tap((res: ListResp) => {
      this.total = res?.total ?? 0;
      this.loading = false;
    }),
    map((res: ListResp) => res?.items ?? []),
    shareReplay(1)
  );

  ngOnInit(): void {
    // Inicializar subjects con los valores actuales de los inputs
    this.search$.next(this.search);
    this.page$.next(this.page);
    this.limit$.next(this.limit);
  }

  ngOnDestroy(): void {
    this.auxSubs.forEach(s => s.unsubscribe());
  }

  /** Handlers de UI -> actualizan subjects */

  onSearchChange(): void {
    this.page = 1;            // al buscar, vuelve a página 1
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

  /** Acciones */

  toggleEstado(u: UsuarioRow): void {
    const nuevo = !u.activo;
    // Optimista
    u.activo = nuevo;
    const sub = this.api.setEstado(u.idusuario, nuevo).subscribe({
      error: () => (u.activo = !nuevo),
    });
    this.auxSubs.push(sub);
  }

  nuevo(): void {
    this.router.navigate(['/usuarios/nuevo']);
  }
  editar(u: UsuarioRow): void {
    this.router.navigate(['/usuarios', u.idusuario, 'editar']);
  }
  ver(u: UsuarioRow): void {
    this.router.navigate(['/usuarios', u.idusuario, 'ver']);
  }
}
