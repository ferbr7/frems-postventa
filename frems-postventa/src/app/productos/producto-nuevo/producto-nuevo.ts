import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

type Categoria = { id: string; nombre: string };
type Medida = { id: string; nombre: string }; // ej. ml, g, unid

@Component({
  selector: 'app-producto-nuevo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './producto-nuevo.html',
})
export class ProductoNuevoComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  // Mocks (reemplazar por servicios cuando conectes back)
  categorias: Categoria[] = [
    { id: 'fragancias', nombre: 'Fragancias' },
    { id: 'set', nombre: 'Set / Kit' },
    { id: 'accesorios', nombre: 'Accesorios' },
  ];

  medidas: Medida[] = [
    { id: 'ml', nombre: 'Mililitros (ml)' },
    { id: 'g', nombre: 'Gramos (g)' },
    { id: 'unid', nombre: 'Unidades' },
  ];

  form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    descripcion: ['', [Validators.maxLength(1000)]],
    categoria: [this.categorias[0].id, Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    medida: [this.medidas[0].id, Validators.required],
    estado: [true],             // activo/inactivo
    sku: [''],                  // opcional
    imagenUrl: [''],            // opcional
  });

  get nombre() { return this.form.get('nombre'); }
  get categoria() { return this.form.get('categoria'); }
  get precio() { return this.form.get('precio'); }
  get stock() { return this.form.get('stock'); }
  get medida() { return this.form.get('medida'); }

  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      alert('Revisá los datos del producto.');
      return;
    }

    const payload = this.form.getRawValue();
    // TODO: reemplazar por productosService.create(payload)
    console.log('POST /productos', payload);
    alert('Producto registrado.');
    this.router.navigate(['/productos']);
  }
}
