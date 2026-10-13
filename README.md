# Cantina da Honestidade Projeto Aplicado II

Ambiente de desenvolvimento com Podman: banco PostgreSQL com Adminer para inspecionar os dados.

## Requisitos
- `podman` e `podman-compose`

## Uso
```sh
cp .env.example .env
podman-compose up -d
podman-compose ps
podman-compose down
podman-compose down -v
```

- PostgreSQL: `localhost:5432` (db/usuário/senha: `cantina`)
- Adminer: http://localhost:8080 (sistema: PostgreSQL, servidor: `db`)
- psql: `podman exec -it cantina-db psql -U cantina -d cantina`

Os scripts em `db/init/` rodam apenas na primeira criação do volume. Depois de
alterá-los, suba novamente com `podman-compose down -v && podman-compose up -d`.

Usuários de exemplo (senha `senha123`): `admin@sc.senai.br`, `consumidor@sc.senai.br`.
