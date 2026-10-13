CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO usuario (nome, email, senha_hash, perfil, saldo) VALUES
    ('Administrador', 'admin@sc.senai.br',      crypt('senha123', gen_salt('bf')), 'ADMINISTRADOR', 0),
    ('Consumidor',    'consumidor@sc.senai.br', crypt('senha123', gen_salt('bf')), 'CONSUMIDOR',    20.00);

INSERT INTO produto (nome, categoria, preco, estoque, codigo_barras) VALUES
    ('Água mineral 500ml',  'Bebidas',  3.00, 24, '7891234560011'),
    ('Refrigerante lata',   'Bebidas',  5.50, 12, '7891234560028'),
    ('Barra de cereal',     'Snacks',   2.50, 30, '7891234560035'),
    ('Salgadinho 45g',      'Snacks',   4.00, 15, '7891234560042'),
    ('Chocolate 90g',       'Doces',    6.00, 10, '7891234560059');

INSERT INTO recarga (id_usuario, valor, forma_pagamento) VALUES
    (2, 20.00, 'PIX');
