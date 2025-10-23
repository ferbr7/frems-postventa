import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../core/auth.service';

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
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);

  step: 'request' | 'verify' | 'done' = 'request';
  isLoading = false;
  resendIn = 0;
  sentToEmail = '';
  showPwd = false;
  showPwd2 = false;

  requestForm!: FormGroup;  // { email }
  verifyForm!: FormGroup;   // { code, password, confirm }

  ngOnInit() {
    this.requestForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
    this.verifyForm = this.fb.group(
      {
        code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirm: ['', [Validators.required]],
      },
      { validators: matchFields('password', 'confirm') }
    );
  }

  get email() { return this.requestForm.get('email'); }
  get code() { return this.verifyForm.get('code'); }
  get password() { return this.verifyForm.get('password'); }
  get confirm() { return this.verifyForm.get('confirm'); }
  get fieldsNotMatch() { return this.verifyForm.hasError('fieldsNotMatch') && this.verifyForm.touched; }

  async submitRequest() {
    if (this.requestForm.invalid) { this.requestForm.markAllAsTouched(); return; }
    this.isLoading = true;
    const emailValue = String(this.email?.value).trim();

    this.auth.forgot(emailValue).pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: () => {
          this.sentToEmail = emailValue;
          this.router.navigate(['/reset-password'], { queryParams: { email: emailValue } });
          this.step = 'verify';
          this.startCooldown();
        },
        error: () => {
          // Igual avanzamos (el backend no revela si existe); mostramos mensaje genérico si quieres
          this.sentToEmail = emailValue;
          this.step = 'verify';
          this.startCooldown();
        }
      });
  }

  submitVerify() {
    if (this.verifyForm.invalid) { this.verifyForm.markAllAsTouched(); return; }
    this.isLoading = true;

    const email = this.sentToEmail;
    const code = String(this.code?.value || '').trim();
    const newPassword = String(this.password?.value || '');

    this.auth.reset(email, code, newPassword).pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: () => { this.step = 'done'; },
        error: (e) => {
          this.code?.setErrors({ invalid: true });
          alert(e?.error?.message || 'Código inválido o vencido');
        }
      });
  }

  resend() {
    if (this.resendIn > 0 || !this.sentToEmail) return;
    this.isLoading = true;
    this.auth.forgot(this.sentToEmail).pipe(finalize(() => this.isLoading = false))
      .subscribe({ next: () => this.startCooldown(), error: () => this.startCooldown() });
  }

  private startCooldown() {
    this.resendIn = 30;
    const t = setInterval(() => {
      this.resendIn--;
      if (this.resendIn <= 0) clearInterval(t);
    }, 1000);
  }

  backToLogin() { this.router.navigate(['/login']); }
}
