import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProductosService } from '../../core/productos.service';
import { InventarioService } from '../../core/inventario.service';

@Component({
  standalone: true,
  selector: 'app-entrada-inventario-form',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './entrada-form.html',
})
export class EntradaInventarioFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productosApi = inject(ProductosService);
  private invApi = inject(InventarioService);

  private todayLocal(): string {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  productos: Array<{ id: number; label: string }> = [];
  productoBloqueado = false;

  form = this.fb.nonNullable.group({
    idproducto: [0, [Validators.required, Validators.min(1)]],
    cantidad: [0, [Validators.required, Validators.min(1)]],
    preciocosto: [0, [Validators.required, Validators.min(0)]],
    fechaentrada: [this.todayLocal(), [Validators.required]],
    proveedor: [''],
  });

  ngOnInit(): void {
    // Cargar productos básicos para el select
    this.productosApi.list({ page: 1, limit: 1000, order: 'recientes' })
      .subscribe(resp => {
        const items = (resp as any)?.items || [];
        this.productos = items.map((p: any) => ({
          id: p.idproducto,
          label: `${p.nombre} (${p.sku})`
        }));

        const qid = Number(this.route.snapshot.queryParamMap.get('producto') || 0);
        if (qid) {
          this.form.get('idproducto')?.setValue(qid);
          this.productoBloqueado = true;
          this.form.get('idproducto')?.disable({ emitEvent: false });
        }
      });
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();

    this.invApi.crearEntrada({
      idproducto: raw.idproducto,
      cantidad: Number(raw.cantidad),
      preciocosto: Number(raw.preciocosto),
      fechaentrada: raw.fechaentrada, // yyyy-MM-dd
      proveedor: raw.proveedor?.trim() || undefined,
      // idusuario: ... // si luego atan al login
    }).subscribe({
      next: (res: any) => {
        if (!res?.ok) { alert(res?.message || 'No se pudo registrar la entrada.'); return; }
        this.router.navigate(['/productos']); // vuelve a productos
      },
      error: () => alert('Ocurrió un error al registrar la entrada.')
    });
  }
  nuevo() { this.router.navigate(['/productos/nuevo']); }
}
