import { Pipe, PipeTransform } from '@angular/core';
import { DEFAULT_CURRENCY, formatMoney } from '../../core/utils/currency-format';

@Pipe({
  name: 'appCurrency',
  standalone: true
})
export class AppCurrencyPipe implements PipeTransform {
  transform(amount: number | string | null | undefined, currency: string = DEFAULT_CURRENCY): string {
    return formatMoney(amount, currency);
  }
}
