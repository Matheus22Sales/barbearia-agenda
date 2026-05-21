# Barbearia Golden

Sistema de agendamento online para barbearia, com fluxo publico para clientes e painel admin para controle de agenda e bloqueios.

## Funcionalidades

- selecao de servico
- escolha de profissional
- horarios calculados com base na disponibilidade real
- confirmacao de agendamento
- pagina de meus agendamentos
- painel admin com senha
- bloqueio por horario, periodo e dia inteiro
- filtro por data e barbeiro no admin

## Rodando localmente

No PowerShell:

```powershell
npm.cmd install
npm.cmd run dev
```

Abrir no navegador:

```text
http://localhost:3000
```

Admin:

```text
http://localhost:3000/admin
```

## Variaveis de ambiente

Crie um `.env.local` com:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ADMIN_PASSWORD=
```

Pode usar o arquivo [`.env.example`](./.env.example) como base.

## Producao

Build:

```powershell
npm.cmd run build
```

Em maquinas com OneDrive, pode ser necessario validar o build fora da pasta sincronizada, porque o Windows as vezes trava os artefatos gerados pelo Next.

## Entrega

Veja o arquivo [ENTREGA.md](./ENTREGA.md) para:

- handoff para cliente
- Supabase em teste vs producao
- senha do admin
- checklist de entrega
- fluxo recomendado de Git

## Deploy

Veja o arquivo [DEPLOY.md](./DEPLOY.md) para:

- publicar na Vercel
- configurar variaveis de ambiente
- entender o impacto do Supabase Free vs Pro
