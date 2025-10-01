import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductosList } from './productos-list';

describe('ProductosList', () => {
  let component: ProductosList;
  let fixture: ComponentFixture<ProductosList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductosList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductosList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
