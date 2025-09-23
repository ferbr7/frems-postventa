import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsuariosForm } from './usuarios-form';

describe('UsuariosForm', () => {
  let component: UsuariosForm;
  let fixture: ComponentFixture<UsuariosForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsuariosForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UsuariosForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
