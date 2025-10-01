import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntradaForm } from './entrada-form';

describe('EntradaForm', () => {
  let component: EntradaForm;
  let fixture: ComponentFixture<EntradaForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntradaForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntradaForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
