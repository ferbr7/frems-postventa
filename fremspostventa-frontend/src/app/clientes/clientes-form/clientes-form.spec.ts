import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientesForm } from './clientes-form';

describe('ClientesForm', () => {
  let component: ClientesForm;
  let fixture: ComponentFixture<ClientesForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientesForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientesForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
