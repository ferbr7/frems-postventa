import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductoNuevo } from './producto-nuevo';

describe('ProductoNuevo', () => {
  let component: ProductoNuevo;
  let fixture: ComponentFixture<ProductoNuevo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductoNuevo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductoNuevo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
