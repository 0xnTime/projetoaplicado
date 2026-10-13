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

## Comandos Bun dentro do container
```sh
podman exec -it cantina-server bun add <pacote> --cwd apps/server
podman exec -it cantina-web bun add <pacote> --cwd apps/web
podman exec -it cantina-server bun run typecheck
```

Usuários de exemplo (senha `senha123`): `admin@sc.senai.br`, `consumidor@sc.senai.br`.