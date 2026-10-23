/** Opens the printable documents of these orders (packing slips or invoices) in a new tab. */
export function openPrint(orderIds: string[], doc: 'packing' | 'invoice') {
  window.open(`/admin/print?doc=${doc}&orders=${orderIds.join(',')}`, '_blank', 'noopener');
}
