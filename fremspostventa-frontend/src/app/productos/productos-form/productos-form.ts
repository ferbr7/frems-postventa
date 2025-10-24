import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProductosService } from '../../core/productos.service';

@Component({
  standalone: true,
  selector: 'app-productos-form',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './productos-form.html',
})
export class ProductosFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ProductosService);


  id = 0;
  isEdit = false;
  isView = false;

  categorias = [
    'Fragancia H Cítrica',
    'Fragancia H Amaderada',
    'Fragancia H Oriental',
    'Fragancia H Aromática',

    'Fragancia M Floral',
    'Fragancia M Frutal',
    'Fragancia M Oriental',
    'Fragancia M Gourmand',

    'Fragancia U Cítrica',
    'Fragancia U Amaderada',
    'Fragancia U Acuática',

    'Body Mist',
    'Aceite Roll-on',
    'Desodorante',
    'After Shave',
    'Hair Mist',
    'Cremas Corporales',
    'Set',
    'Otro'
  ];

  medidas = [
    // Fragancias
    '5ml', '7.5ml', '10ml', '15ml', '30ml', '50ml', '75ml', '90ml', '100ml', '125ml', '150ml', '200ml',
    '236ml', '250ml',
    '8ml', '12ml',
    '30ml', '50ml',
    '50ml', '75ml',
    '200g', '250g', '500ml',
    'set', 'unidad'
  ];


  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required]],
    sku: ['', [Validators.required]],
    descripcion: [''],
    categoria: ['', [Validators.required]],
    medida: ['', [Validators.required]],
    precioventa: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    activo: [true],
    duracionestimadodias: [null as number | null, []],
  });

  ngOnInit(): void {

    this.id = Number(this.route.snapshot.paramMap.get('id') || 0);
    const segs = this.route.snapshot.url;
    const last = segs.length ? segs[segs.length - 1].path : '';
    this.isView = last === 'ver';
    this.isEdit = last === 'editar';

    if (this.isEdit || this.isView) {
      this.api.get(this.id).subscribe({
        next: (res) => {
          const p = res?.producto;
          if (!p) return;
          this.form.patchValue({
            nombre: p.nombre,
            sku: p.sku,
            descripcion: p.descripcion ?? '',
            categoria: p.categoria ?? '',
            medida: p.medida ?? '',
            precioventa: Number(p.precioventa) || 0,
            stock: Number(p.stock) || 0,
            activo: !!p.activo,
            duracionestimadodias: (p as any).duracionestimadodias ?? null,
          });
          if (this.isEdit || this.isView) this.form.get('sku')?.disable({ emitEvent: false });
          if (this.isView) this.form.disable({ emitEvent: false });
          if (this.isEdit) {
            this.form.get('categoria')?.disable({ emitEvent: false });
            this.form.get('medida')?.disable({ emitEvent: false });
          }
        }
      });
    }
  }

  get title() {
    if (this.isEdit) return 'Editar producto';
    if (this.isView) return 'Vista de producto';
    return 'Nuevo producto';
  }
  get subtitle() {
    if (this.isEdit) return 'Actualiza la información del producto.';
    if (this.isView) return 'Consulta la información del producto.';
    return 'Completa los campos para agregar un nuevo producto al inventario.';
  }


  onPrecioInput(e: Event) {
    const el = e.target as HTMLInputElement;
    // Permite solo número positivo con hasta 2 decimales
    const val = el.value.replace(/[^\d.]/g, '');
    const parts = val.split('.');
    const safe = parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0];
    if (safe !== el.value) this.form.get('precioventa')?.setValue(Number(safe || 0), { emitEvent: false });
  }
  onStockInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const n = el.value.replace(/\D/g, '');
    if (n !== el.value) this.form.get('stock')?.setValue(Number(n || 0), { emitEvent: false });
  }
  onDuracionInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const n = el.value.replace(/\D/g, '');
    const num = n ? Number(n) : null;
    this.form.get('duracionestimadodias')?.setValue(num, { emitEvent: false });
  }

  save() {
    if (this.isView) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const raw = this.form.getRawValue();
    const payload: any = {
      nombre: raw.nombre.trim(),
      sku: raw.sku.trim(),
      descripcion: raw.descripcion?.trim() || null,
      categoria: raw.categoria || null,
      medida: raw.medida || null,
      precioventa: Number(raw.precioventa) || 0,
      stock: Number(raw.stock) || 0,
      activo: !!raw.activo,
    };
    if (raw.duracionestimadodias != null) {
      const d = Number(raw.duracionestimadodias);
      if (d >= 1 && d <= 3650) payload.duracionestimadodias = d;
    }

    if (this.isEdit) {
      delete payload.sku;
      delete payload.categoria;
      delete payload.medida;

      this.api.update(this.id, payload).subscribe({
        next: (res: any) => {
          if (!res?.ok) { alert(res?.message || 'No se pudo actualizar.'); return; }
          this.router.navigate(['/productos']);
        },
        error: (e) => {
          if (e?.status === 409) {
            alert(e?.error?.message || 'SKU en uso.');
            this.form.get('sku')?.setErrors({ duplicate: true });
            return;
          }
          alert('Ocurrió un error al actualizar.');
        }
      });
    } else {
      this.api.create(payload).subscribe({
        next: (res: any) => {
          if (!res?.ok) { alert(res?.message || 'No se pudo crear.'); return; }
          this.router.navigate(['/productos']);
        },
        error: (e) => {
          if (e?.status === 409) {
            alert(e?.error?.message || 'SKU en uso.');
            this.form.get('sku')?.setErrors({ duplicate: true });
            return;
          }
          alert('Ocurrió un error al crear.');
        }
      });
    }
  }
  returnTo: string | null =
    (typeof history.state?.returnTo === 'string' && history.state.returnTo.startsWith('/'))
      ? history.state.returnTo
      : this.route.snapshot.queryParamMap.get('returnTo');
}
