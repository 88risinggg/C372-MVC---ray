USE c372_supermarketdb;

ALTER TABLE orders
  ADD COLUMN refund_status VARCHAR(20) NOT NULL DEFAULT 'Not refunded',
  ADD COLUMN refunded_at DATETIME NULL;

ALTER TABLE users
  ADD COLUMN wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00;

UPDATE orders
  SET refund_status = 'Not refunded'
  WHERE refund_status IS NULL OR refund_status = '';
