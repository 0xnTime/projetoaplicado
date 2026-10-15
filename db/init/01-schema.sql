CREATE TABLE usuario (
    id_usuario     SERIAL PRIMARY KEY,
    nome           VARCHAR(120)  NOT NULL,
    email          VARCHAR(160)  NOT NULL UNIQUE,
    senha_hash     VARCHAR(255)  NOT NULL,
    perfil         VARCHAR(20)   NOT NULL DEFAULT 'CONSUMIDOR'
                   CHECK (perfil IN ('ADMINISTRADOR', 'CONSUMIDOR')),
    saldo          NUMERIC(10,2) NOT NULL DEFAULT 0,
    ativo          BOOLEAN       NOT NULL DEFAULT TRUE,
    data_cadastro  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE produto (
    id_produto     SERIAL PRIMARY KEY,
    nome           VARCHAR(120)  NOT NULL,
    categoria      VARCHAR(60)   NOT NULL,
    preco          NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
    estoque        INTEGER       NOT NULL DEFAULT 0 CHECK (estoque >= 0),
    foto           VARCHAR(255),
    ativo          BOOLEAN       NOT NULL DEFAULT TRUE
);

CREATE TABLE recarga (
    id_recarga       SERIAL PRIMARY KEY,
    id_usuario       INTEGER       NOT NULL REFERENCES usuario (id_usuario),
    valor            NUMERIC(10,2) NOT NULL CHECK (valor > 0),
    forma_pagamento  VARCHAR(20)   NOT NULL
                     CHECK (forma_pagamento IN ('CREDITO', 'DEBITO', 'PIX')),
    data_hora        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE compra (
    id_compra    SERIAL PRIMARY KEY,
    id_usuario   INTEGER       NOT NULL REFERENCES usuario (id_usuario),
    valor_total  NUMERIC(10,2) NOT NULL CHECK (valor_total >= 0),
    data_hora    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE item_compra (
    id_compra       INTEGER       NOT NULL REFERENCES compra (id_compra) ON DELETE CASCADE,
    id_produto      INTEGER       NOT NULL REFERENCES produto (id_produto),
    quantidade      INTEGER       NOT NULL CHECK (quantidade > 0),
    valor_unitario  NUMERIC(10,2) NOT NULL CHECK (valor_unitario >= 0),
    PRIMARY KEY (id_compra, id_produto)
);

CREATE INDEX idx_recarga_usuario_data ON recarga (id_usuario, data_hora);
CREATE INDEX idx_compra_usuario_data  ON compra (id_usuario, data_hora);
CREATE INDEX idx_item_compra_produto  ON item_compra (id_produto);
