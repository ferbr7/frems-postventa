import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IaList } from './ia-list';

describe('IaList', () => {
  let component: IaList;
  let fixture: ComponentFixture<IaList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IaList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IaList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
