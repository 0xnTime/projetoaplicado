ALTER TABLE compra ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(10,2);
UPDATE compra SET valor_pago = valor_total WHERE valor_pago IS NULL;
ALTER TABLE compra ALTER COLUMN valor_pago SET NOT NULL;
ALTER TABLE compra ADD CONSTRAINT compra_valor_pago_check CHECK (valor_pago >= 0);
