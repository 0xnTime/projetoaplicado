# Cantina da Honestidade Projeto Aplicado II

Monorepo usando TypeScript rodando inteiramente em containers Podman

- **Runtime:** Bun
- **Frontend:** Vue 3 + Vite (`apps/web`)
- **Backend:** Fastify + Zod (`apps/server`)
- **Banco:** PostgreSQL 17

## Estrutura
```
apps/
  server/          API Fastify
    src/config/    variáveis de ambiente validadas com Zod
    src/routes/    rotas
    src/app.ts     instância do Fastify
    src/server.ts  ponto de entrada
  web/             SPA Vue
packages/
  types/           tipos compartilhados
  utils/           funções compartilhadas
db/init/           schema e dados de exemplo do banco
Containerfile      imagem Bun usada pelos serviços
compose.yaml
tsconfig.base.json
```

## Uso
```sh
cp .env.example .env
podman-compose up -d
podman-compose ps
podman-compose logs -f server web
podman-compose down
podman-compose down -v
```

- Web: http://localhost:3000
- API: http://localhost:3333/api/
- PostgreSQL: `localhost:5432`
- psql: `podman exec -it cantina-db psql -U cantina -d cantina`

O código é montado nos containers, então possui hotreload.

Mudanças no `.env` ou no `compose.yaml` exigem recriar os containers: `podman-compose down && podman-compose up -d`.

## Autenticação
A API usa JWT. Defina `JWT_SECRET` no `.env` (`openssl rand -hex 32`).

- `POST /api/auth/cadastro` autocadastro (sempre Consumidor)
- `POST /api/auth/login` retorna `{ token, user }`
- `POST /api/auth/esqueci-senha` gera um link de redefinição (por enquanto aparece só no log do servidor: `podman logs cantina-server | grep "password reset"`)
- `POST /api/auth/redefinir-senha` recebe `{ token, password }` e retorna `{ token, user }`
- `GET /api/auth/me` usuário logado e saldo

## Fotos de produtos
- `PUT /api/produtos/:id/foto` recebe a imagem crua no corpo (JPEG, PNG ou WebP, até 5 MB), ex.: `fetch(url, { method: "PUT", headers, body: file })`
- `DELETE /api/produtos/:id/foto` remove a foto
- `GET /api/uploads/:arquivo` serve a imagem (público, para funcionar em `<img src>`), o campo `photo` do produto já vem com esse caminho

Os arquivos ficam no volume `uploads` do container (`UPLOAD_DIR`).

## Relatórios
Todos aceitam `from` e `to` (`YYYY-MM-DD`, opcionais).

- `GET /api/relatorios/vendas?groupBy=day|month|year` total arrecadado e quantidade de vendas, agrupados por período
- `GET /api/relatorios/produtos-mais-vendidos?limit=10` quantidade vendida por produto (`limit` opcional)
- `GET /api/relatorios/consumo/:idUsuario` total gasto e produtos adquiridos por um consumidor

## Comandos Bun dentro do container
```sh
podman exec -it cantina-server bun add <pacote> --cwd apps/server
podman exec -it cantina-web bun add <pacote> --cwd apps/web
podman exec -it cantina-server bun run typecheck
```

Usuários de exemplo (senha `senha123`): `admin@sc.senai.br`, `consumidor@sc.senai.br`.