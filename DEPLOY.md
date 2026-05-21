# Deploy do Projeto

Este projeto pode ser publicado com mais facilidade na Vercel, porque ja usa Next.js puro e nao depende de backend proprio fora do Supabase.

## Antes do deploy

- confirmar que o projeto do Supabase esta na conta/organizacao certa
- revisar a senha do admin
- revisar os servicos e profissionais no painel admin
- validar pelo menos um agendamento completo
- validar pelo menos um bloqueio no admin

## Variaveis de ambiente

Configure no ambiente de deploy:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ADMIN_PASSWORD=
```

## Deploy na Vercel

1. importar o repositório no painel da Vercel
2. selecionar o framework `Next.js`
3. adicionar as variaveis de ambiente
4. publicar

## Cuidados com o Supabase Free

Para demonstracao e testes, o Free funciona.

Para cliente real:

- o ideal e migrar para Pro
- ou pelo menos garantir que o cliente entenda que projeto gratuito pode pausar por inatividade

## Dono da infraestrutura

O modelo mais seguro de entrega e:

- GitHub na conta do cliente ou compartilhado com ele
- Supabase na organizacao do cliente
- Vercel na conta do cliente

Assim o sistema nao fica preso em voce para operacao basica.
