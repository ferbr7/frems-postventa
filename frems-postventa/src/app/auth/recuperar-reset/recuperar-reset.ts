import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './recuperar-reset.html'
})
export class ResetPasswordComponent {
  form: FormGroup;

  constructor(private fb: FormBuilder, private router: Router) {
    this.form = this.fb.group({
      codigo: ['', [Validators.required, Validators.minLength(6)]],
      nuevaContrasena: ['', [Validators.required, Validators.minLength(6)]],
      confirmarContrasena: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  restablecer() {
    if (this.form.valid) {
      const { nuevaContrasena, confirmarContrasena } = this.form.value;

      if (nuevaContrasena !== confirmarContrasena) {
        alert('Las contraseñas no coinciden');
        return;
      }

      // Aquí llamas a tu backend para validar el código y cambiar la contraseña
      console.log('Contraseña actualizada:', nuevaContrasena);

      alert('Contraseña actualizada con éxito');
      this.router.navigate(['/login']);
    }
  }
    backToLogin() {
    this.router.navigate(['/login']);
  }
}
