import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cliente-nuevo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './cliente-nuevo.html',
})
export class ClienteNuevoComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  form: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', Validators.required],
    direccion: [''],
    fechaIngreso: ['', Validators.required],
    ultimaCompra: ['']
  });

  guardar() {
    if (this.form.valid) {
      console.log('Cliente nuevo:', this.form.value);
      alert('Cliente registrado exitosamente');
      this.router.navigate(['/clientes']);
    } else {
      alert('Por favor, completa todos los campos obligatorios');
    }
  }

  volver() {
    this.router.navigate(['/clientes']);
  }
}
