import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/enviroment';

export interface SalesResp {
  kpis: { totalSales:number; orders:number; avgTicket:number };
  trend: { date:string; orders:number; total:number }[];
  rows:  { date:string; orders:number; total:number }[];
}

export interface SalesByCustomerResp {
  kpis: { newCustomers:number; activePct:number; avgTicketPerCustomer:number };
  rows: { cliente:string; compras:number; total:number; last:string }[];
}

export interface TopProductsResp {
  kpis: { skuSold:number; topN:number; topParticipation:number };
  trend: { producto:string; qty:number; amount:number }[];
  rows:  { producto:string; qty:number; amount:number }[];
}

export interface AIRecsResp {
  kpis: { generated:number; contacted:number; conversion:number };
  trend: { date:string; generated:number; contacted:number; discarded:number }[];
  rows:  { date:string; generated:number; contacted:number; discarded:number }[];
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/reports`;

  private params(from:string, to:string, extra?:Record<string,any>) {
    let p = new HttpParams().set('from', from).set('to', to);
    if (extra) Object.entries(extra).forEach(([k,v]) => p = p.set(k, String(v)));
    return p;
  }

  sales(from:string, to:string) {
    return this.http.get<SalesResp>(`${this.API}/sales`, { params: this.params(from,to) });
  }
  salesByCustomer(from:string, to:string) {
    return this.http.get<SalesByCustomerResp>(`${this.API}/sales-by-customer`, { params: this.params(from,to) });
  }
  topProducts(from:string, to:string, topN=10) {
    return this.http.get<TopProductsResp>(`${this.API}/top-products`, { params: this.params(from,to,{ topN }) });
  }
  aiRecs(from:string, to:string) {
    return this.http.get<AIRecsResp>(`${this.API}/ai-recs`, { params: this.params(from,to) });
  }
}
