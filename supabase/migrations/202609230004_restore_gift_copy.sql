update public.gifts
set title = 'TESTE — Pagamento repetido',
    description = 'Produto para testar pagamentos. Continua disponível após cada compra.'
where id = '2900779c-e3f3-475c-b6d4-240dd86203df';

update public.gifts
set title = 'Maquina de Lavar'
where id = 'dff3c89c-c369-4735-b569-a919c18030e7';

update public.gifts
set title = 'TESTE — Validação do pagamento'
where id = '59c682f6-c0e4-4a35-8389-71816c7de8f8';
