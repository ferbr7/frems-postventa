import { Component, OnInit, inject, PLATFORM_ID, ApplicationRef, NgZone, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser, CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { VentasService } from '../../core/ventas.service';
import { of, EMPTY } from 'rxjs';
import { map, switchMap, catchError, filter, take } from 'rxjs/operators';

@Component({
  standalone: true,
  selector: 'app-ventas-print',
  imports: [CommonModule, RouterModule, DatePipe, CurrencyPipe],
  templateUrl: './ventas-print.html',
})
export class VentasPrintComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api    = inject(VentasService);
  private platformId = inject(PLATFORM_ID);
  private appRef = inject(ApplicationRef);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  // SSR guard
  private isBrowser = isPlatformBrowser(this.platformId);

  id = 0;
  loading = true;
  err = '';

  venta: any = null;
  detalles: any[] = [];

  ngOnInit(): void {
    this.route.paramMap.pipe(
      map(pm => Number(pm.get('id') || 0)),
      switchMap(id => {
        this.id = id;
        if (!Number.isFinite(id) || id <= 0) {
          this.err = 'ID inválido';
          return EMPTY;
        }
        return this.api.get(id).pipe(
          catchError(err => {
            this.err = err?.error?.message || 'Error cargando venta';
            return of(null);
          })
        );
      })
    ).subscribe((res: any) => {
      if (res && res.ok && res.venta) {
        this.venta = res.venta;
        this.detalles = res.detalles || [];
      } else if (!this.err) {
        this.err = res?.message || 'Venta no encontrada';
      }

      // marcar fin de carga y forzar cambio antes de esperar estabilidad
      this.loading = false;
      this.cdr.detectChanges();

      // Solo en navegador, y solo cuando Angular quede estable
      if (this.isBrowser && !this.err) {
        // Espera a que la app esté estable (vista pintada) y luego imprime
        this.appRef.isStable.pipe(
          filter(stable => stable),
          take(1)
        ).subscribe(() => {
          // Un pequeño delay garantiza layout listo en navegadores lentos
          setTimeout(() => window.print(), 50);
        });
      }
    });
  }

  volver() {
    if (this.isBrowser && window.history.length > 1) window.history.back();
    else this.router.navigate(['/ventas']);
  }

  reimprimir() {
    if (this.isBrowser) window.print();
  }
}
