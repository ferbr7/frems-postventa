import {
  Component, OnInit, inject, PLATFORM_ID, ApplicationRef, NgZone, ChangeDetectorRef
} from '@angular/core';
import { isPlatformBrowser, CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { RecsService } from '../../core/recs.service';
import { of, EMPTY } from 'rxjs';
import { map, switchMap, catchError, filter, take } from 'rxjs/operators';

@Component({
  standalone: true,
  selector: 'app-recs-print',
  imports: [CommonModule, RouterModule, CurrencyPipe],
  templateUrl: './recs-print.html',
})
export class RecsPrintComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api    = inject(RecsService);
  private platformId = inject(PLATFORM_ID);
  private appRef = inject(ApplicationRef);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  private isBrowser = isPlatformBrowser(this.platformId);

  id = 0;
  loading = true;
  err = '';

  // VM
  rec: any = null;        // detalle crudo (por si querés mostrar más)
  cliente: any = null;
  opciones: any[] = [];   // productos recomendados (nombre, sku, precio)
  mensaje = '';           // justificación COMPLETA (tal cual viene)
  fecha = '';             // dd/MM/yyyy

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
            this.err = err?.error?.message || 'Error cargando recomendación';
            return of(null);
          })
        );
      })
    ).subscribe((res: any) => {
      if (res?.ok && res.rec) {
        this.rec = res.rec;
        this.cliente = res.rec.clientes || null;
        this.opciones = (res.rec.recomendaciones_detalle || [])
          .map((d: any) => d?.productos)
          .filter(Boolean);
        this.mensaje = (res.rec.justificacion || '').toString();
        this.fecha = new Date(res.rec.fechageneracion).toLocaleDateString('es-GT', { timeZone: 'UTC' });
      } else if (!this.err) {
        this.err = res?.message || 'Recomendación no encontrada';
      }

      this.loading = false;
      this.cdr.detectChanges();

      if (this.isBrowser && !this.err) {
        this.appRef.isStable.pipe(filter(st => st), take(1)).subscribe(() => {
          setTimeout(() => window.print(), 50);
        });
      }
    });
  }

  volver() {
    if (this.isBrowser && window.history.length > 1) window.history.back();
    else this.router.navigate(['/recomendaciones', this.id]);
  }

  reimprimir() {
    if (this.isBrowser) window.print();
  }
}
