import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// Validador para que coincidan las contraseñas
function matchFields(field: string, confirmField: string) {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(field)?.value;
    const b = group.get(confirmField)?.value;
    return a && b && a !== b ? { fieldsNotMatch: true } : null;
  };
}

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.html',
})
export class ForgotPasswordComponent implements OnInit {
  // Estados de la UI
  step: 'request' | 'verify' | 'done' = 'request';
  isLoading = false;
  resendIn = 0;           // segundos de cooldown
  sentToEmail = '';       // correo al que se envió el código
  showPwd = false;
  showPwd2 = false;

  // Formularios
  requestForm!: FormGroup;  // { email }
  verifyForm!: FormGroup;   // { code, password, confirm }

  // Simulación (reemplazar por servicio real)
  private mockServerCode = ''; // código que "envía" el server

  constructor(private fb: FormBuilder, private router: Router) {}

  ngOnInit() {
    this.requestForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });

    this.verifyForm = this.fb.group(
      {
        code: [
          '',
          [
            Validators.required,
            Validators.pattern(/^\d{6}$/), // 6 dígitos
          ],
        ],
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
          ],
        ],
        confirm: ['', [Validators.required]],
      },
      { validators: matchFields('password', 'confirm') }
    );
  }

  // GETTERS
  get email() { return this.requestForm.get('email'); }
  get code() { return this.verifyForm.get('code'); }
  get password() { return this.verifyForm.get('password'); }
  get confirm() { return this.verifyForm.get('confirm'); }
  get fieldsNotMatch() {
    return this.verifyForm.hasError('fieldsNotMatch') && this.verifyForm.touched;
  }

  // PASO 1: Solicitar código
  async submitRequest() {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }
    this.isLoading = true;
    const emailValue = String(this.email?.value).trim();

    // Simula llamada a backend para enviar el código
    await this.fakeSendCode(emailValue);

    this.sentToEmail = emailValue;
    this.isLoading = false;
    this.step = 'verify';
    this.startCooldown();
  }

  // PASO 2: Verificar código y cambiar contraseña
  async submitVerify() {
    if (this.verifyForm.invalid) {
      this.verifyForm.markAllAsTouched();
      return;
    }
    this.isLoading = true;

    const ok = await this.fakeVerifyAndReset(
      this.code?.value,
      this.password?.value
    );

    this.isLoading = false;
    if (ok) {
      this.step = 'done';
    } else {
      this.code?.setErrors({ invalid: true });
      this.verifyForm.markAllAsTouched();
    }
  }

  // Reenviar código
  async resend() {
    if (this.resendIn > 0 || !this.sentToEmail) return;
    this.isLoading = true;
    await this.fakeSendCode(this.sentToEmail);
    this.isLoading = false;
    this.startCooldown();
  }

  // Enfriamiento de reenvío
  private startCooldown() {
    this.resendIn = 30;
    const t = setInterval(() => {
      this.resendIn--;
      if (this.resendIn <= 0) clearInterval(t);
    }, 1000);
  }

  backToLogin() {
    this.router.navigate(['/login']);
  }

  // ====== Simulaciones de backend ======
  private fakeSendCode(email: string): Promise<void> {
    // Genera un código de 6 dígitos y “lo envía”
    this.mockServerCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('Código enviado a', email, '=>', this.mockServerCode);
    return new Promise((resolve) => setTimeout(resolve, 1000));
  }

  private fakeVerifyAndReset(code: string, newPassword: string): Promise<boolean> {
    const ok = code === this.mockServerCode;
    // Aquí actualizarías la contraseña del usuario si ok === true
    return new Promise((resolve) => setTimeout(() => resolve(ok), 1000));
  }
}
