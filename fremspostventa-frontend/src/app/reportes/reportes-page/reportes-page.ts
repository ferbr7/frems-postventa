import { Component, inject, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { RouterModule } from '@angular/router'; 
import { ReportsService, SalesResp, SalesByCustomerResp, TopProductsResp, AIRecsResp } from '../../core/reports.service';

type TipoReporte = 'ventas' | 'clientes' | 'top' | 'ia';

@Component({
  standalone: true,
  selector: 'app-reportes',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reportes-page.html'
})
export class ReportesPage {
  private fb = inject(FormBuilder);
  private api = inject(ReportsService);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  filtros = this.fb.group({
    tipo: ['ventas' as TipoReporte],
    desde: [this.isoLocal(new Date(new Date().setDate(new Date().getDate() - 30)))],
    hasta: [this.isoLocal(new Date())],
    topN: [10]
  });

  private isoLocal(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private _loading = false;

  private dataVentas?: SalesResp;
  private dataClientes?: SalesByCustomerResp;
  private dataTop?: TopProductsResp;
  private dataIA?: AIRecsResp;

  private q(n: number | string) { return `Q ${Number(n ?? 0).toLocaleString('es-GT', { maximumFractionDigits: 0 })}`; }
  private pct(n: number) { return `${(Number(n || 0) * 100).toFixed(0)}%`; }

  generar() {
    const f = this.filtros.value;
    const from = f.desde!, to = f.hasta!, tipo = f.tipo!, n = Number(f.topN ?? 10) || 10;

    this.zone.run(() => {
      this._loading = true;
      this.dataVentas = this.dataClientes = this.dataTop = this.dataIA = undefined;
      this.cdr.markForCheck();
    });

    const done = () => this.zone.run(() => {
      this._loading = false;
      this.cdr.markForCheck();
    });

    if (tipo === 'ventas') {
      this.api.sales(from, to)
        .pipe(finalize(done))
        .subscribe({
          next: (d) => this.zone.run(() => { this.dataVentas = d; this.cdr.markForCheck(); }),
          error: (e) => this.zone.run(() => { console.error(e); this.cdr.markForCheck(); })
        });
      return;
    }

    if (tipo === 'clientes') {
      this.api.salesByCustomer(from, to)
        .pipe(finalize(done))
        .subscribe({
          next: (d) => this.zone.run(() => { this.dataClientes = d; this.cdr.markForCheck(); }),
          error: (e) => this.zone.run(() => { console.error(e); this.cdr.markForCheck(); })
        });
      return;
    }

    if (tipo === 'top') {
      this.api.topProducts(from, to, n)
        .pipe(finalize(done))
        .subscribe({
          next: (d) => this.zone.run(() => { this.dataTop = d; this.cdr.markForCheck(); }),
          error: (e) => this.zone.run(() => { console.error(e); this.cdr.markForCheck(); })
        });
      return;
    }

    this.api.aiRecs(from, to)
      .pipe(finalize(done))
      .subscribe({
        next: (d) => this.zone.run(() => { this.dataIA = d; this.cdr.markForCheck(); }),
        error: (e) => this.zone.run(() => { console.error(e); this.cdr.markForCheck(); })
      });
  }

  loading() { return this._loading; }

  svgH = 260;
  barW = 28;
  barGap = 12;
  labelPad = -8;
  labelPadTop = 5;
  tickPad = 16;
  get axisY() { return this.svgH - 64; }
  get labelY() { return this.svgH - 12; }

  kpis(): { label: string, value: string | number }[] {
    const t = this.filtros.value.tipo!;
    if (t === 'ventas' && this.dataVentas) {
      const k = this.dataVentas.kpis;
      return [
        { label: 'Total ventas', value: this.q(k.totalSales) },
        { label: 'Órdenes', value: k.orders },
        { label: 'Ticket promedio', value: this.q(k.avgTicket) },
      ];
    }
    if (t === 'clientes' && this.dataClientes) {
      const k = this.dataClientes.kpis;
      return [
        { label: 'Clientes nuevos', value: k.newCustomers },
        { label: 'Activos %', value: this.pct(k.activePct) },
        { label: 'Ticket prom. cliente', value: this.q(k.avgTicketPerCustomer) },
      ];
    }
    if (t === 'top' && this.dataTop) {
      const k = this.dataTop.kpis;
      return [
        { label: 'SKU vendidos', value: k.skuSold },
        { label: 'Top N', value: k.topN },
        { label: 'Participación top', value: this.pct(k.topParticipation) },
      ];
    }
    if (t === 'ia' && this.dataIA) {
      const k = this.dataIA.kpis;

      // si el back ya manda 'pending', úsalo; si no, lo calculamos de las filas
      const totals = (this.dataIA.rows || []).reduce(
        (a: any, r: any) => {
          a.g += Number(r.generated) || 0;
          a.c += Number(r.contacted) || 0;
          a.d += Number(r.discarded) || 0;
          return a;
        },
        { g: 0, c: 0, d: 0 }
      );
      const pendingCalc = Math.max(0, totals.g - (totals.c + totals.d));
      const pending = (k as any).pending ?? pendingCalc;

      return [
        { label: 'Recs generadas', value: k.generated },
        { label: 'Contactadas', value: k.contacted },
        { label: 'Pendientes', value: pending },
      ];
    }
    return [];
  }

  barHeight(v: any) {
    const val = Number(v);
    const safeVal = Number.isFinite(val) ? Math.max(0, val) : 0;
    const m = this.gMax();
    const pct = Math.max(0, Math.min(100, (safeVal / m) * 100));
    return pct.toFixed(2) + '%';
  }

  grafica(): { label: string; value: number }[] {
    const t = this.filtros.value.tipo!;
    if (t === 'ventas' && this.dataVentas) {
      return this.dataVentas.trend.map(p => ({
        label: String((p as any).date),
        value: Number((p as any).total) || 0
      }));
    }
    if (t === 'top' && this.dataTop) {
      return this.dataTop.rows.map(r => ({
        label: String((r as any).producto),
        value: Number((r as any).qty) || 0
      }));
    }
    if (t === 'ia' && this.dataIA) {
      return this.dataIA.trend.map(p => ({
        label: String((p as any).date),
        value: Number((p as any).generated) || 0
      }));
    }
    return [];
  }

  gMax(): number {
    const g = this.grafica();
    if (!g.length) return 1;
    const nums = g.map(x => {
      const n = Number(x.value);
      return Number.isFinite(n) ? n : 0;
    });
    const max = Math.max(...nums, 0);
    return max > 0 ? max : 1;
  }

  headers(): string[] {
    const t = this.filtros.value.tipo!;
    if (t === 'ventas' && this.dataVentas) return ['date', 'orders', 'total'];
    if (t === 'clientes' && this.dataClientes) return ['cliente', 'compras', 'total', 'last'];
    if (t === 'top' && this.dataTop) return ['producto', 'qty', 'amount'];
    if (t === 'ia' && this.dataIA) return ['date', 'generated', 'contacted', 'discarded'];
    return [];
  }

  tabla(): any[] {
    const t = this.filtros.value.tipo!;
    if (t === 'ventas' && this.dataVentas) return this.dataVentas.rows as any[];
    if (t === 'clientes' && this.dataClientes) return this.dataClientes.rows as any[];
    if (t === 'top' && this.dataTop) return this.dataTop.rows as any[];
    if (t === 'ia' && this.dataIA) return this.dataIA.rows as any[];
    return [];
  }

  exportCsv() {
    const rows = this.tabla(); if (!rows.length) return;
    const headers = this.headers();
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${this.filtros.value.tipo}_reporte.csv`; a.click();
  }
  print() { window.print(); }

  trackRow = (_: number, r: any) => JSON.stringify(r);
  trackHeader = (_: number, h: string) => h;

  svgWidth(): number {
    const n = this.grafica().length;
    if (!n) return 600;
    return n * (this.barW + this.barGap) + 16;
  }

  private yFor(val: number, max: number) {
    const chartH = this.axisY - 24; // altura útil por encima del eje
    const safeMax = max > 0 ? max : 1;
    const h = Math.max(0, Math.round((val / safeMax) * chartH));
    return { y: this.axisY - h, h: h || (val > 0 ? 2 : 0) };
  }

  private tickFor(label: string) {
    const t = String(label).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t.slice(5);
    return t.length > 12 ? t.slice(0, 12) + '…' : t;
  }

  // SVG: construye datos de barras usados en el template
  svgBars() {
    const data = this.grafica();
    const max = data.reduce((m, d) => Math.max(m, Number(d.value) || 0), 0);
    const isTop = this.filtros.value.tipo === 'top';

    const out: {
      x: number; cx: number; y: number; h: number; value: number;
      label: string; tick: string; short: string; lines: [string, string?]
    }[] = [];
    let x = 8;

    for (const d of data) {
      const val = Number(d.value) || 0;
      const { y, h } = this.yFor(val, max);
      const label = String(d.label);
      const tick = this.tickFor(label);
      out.push({
        x,
        cx: x + this.barW / 2,
        y, h,
        value: val,
        label,
        tick,
        short: tick,
        lines: isTop ? this.splitProductLabel(label) : [label]
      });
      x += this.barW + this.barGap;
    }
    return out;
  }

  private splitProductLabel(label: string): [string, string?] {
    const t = (label || '').trim();
    const MAX = 12;
    if (t.length <= MAX) return [t];
    const first = t.slice(0, MAX);
    const cutAt = first.lastIndexOf(' ');
    const l1 = (cutAt > 6 ? first.slice(0, cutAt) : first).trim();
    const rest = t.slice(l1.length).trim();
    const l2 = rest.length > MAX ? rest.slice(0, MAX - 1) + '…' : rest;
    return [l1, l2];
  }
}
