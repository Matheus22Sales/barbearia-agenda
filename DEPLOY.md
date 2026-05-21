# Deploy do Projeto

Este projeto pode ser publicado na Vercel sem backend proprio, porque o app usa Next.js e o banco fica no Supabase.

## Antes do deploy

- confirmar que o projeto do Supabase esta funcionando
- revisar a senha do admin
- revisar servicos e profissionais no painel admin
- validar pelo menos um agendamento completo
- validar pelo menos um bloqueio no admin

## Variaveis de ambiente

Configure no deploy:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ADMIN_PASSWORD=
```

Observacao:

- em deploy normal na Vercel nao precisa configurar `NEXT_DIST_DIR`
- esse ajuste so faz sentido para testes locais em pastas problemáticas, como OneDrive

## Deploy na Vercel

1. entrar em `https://vercel.com`
2. importar o repositorio do GitHub
3. confirmar o framework `Next.js`
4. adicionar as variaveis de ambiente
5. clicar em deploy

Depois do primeiro deploy:

1. abrir a URL publicada
2. testar a home
3. testar um agendamento real
4. testar `/admin`
5. testar bloqueio de horario

## Cuidados com o Supabase Free

Para demonstracao e testes, o plano Free funciona bem.

Para cliente real:

- o ideal e migrar para Pro
- ou pelo menos explicar que projeto gratuito pode pausar por inatividade

## Dono da infraestrutura

Para teste, pode ficar assim:

- GitHub na sua conta
- Supabase na sua conta
- Vercel na sua conta

Para entrega real, o modelo mais seguro e:

- GitHub na conta do cliente ou compartilhado com ele
- Supabase na organizacao do cliente
- Vercel na conta do cliente

Assim o sistema nao fica preso em voce para operacao basica.
