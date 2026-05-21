# Entrega do Projeto

Este documento resume o que precisa estar em ordem para entregar a agenda da barbearia para um cliente sem depender de memoria ou conversa antiga.

## O que o projeto ja faz

- agendamento publico por servico
- escolha de profissional
- bloqueio de horarios ocupados
- painel admin com senha
- filtro por data e barbeiro
- bloqueio por horario, periodo e dia inteiro
- tela de meus agendamentos

## Senha atual do admin

Senha configurada hoje:

```text
golden123
```

Se for entregar para cliente real, troque essa senha antes do deploy.

## Variaveis de ambiente

O projeto depende de um arquivo `.env.local` com pelo menos:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ADMIN_PASSWORD=
```

## Como rodar localmente

No PowerShell:

```powershell
npm.cmd install
npm.cmd run dev
```

Abrir:

```text
http://localhost:3000
```

Admin:

```text
http://localhost:3000/admin
```

## Build de producao

Em maquinas com OneDrive, o Windows pode travar a pasta `.next` ou `.next-prod`.
Se isso acontecer, rode o build fora do OneDrive ou copie o projeto para uma pasta temporaria antes de validar.

Comando normal:

```powershell
npm.cmd run build
```

## Sobre o Supabase

### Posso usar sem pagar?

Sim. O projeto funciona com o plano gratuito para teste e demonstracao.

O ponto importante e:

- no Free, projetos podem ser pausados por inatividade
- em producao real para cliente, o mais seguro e usar Pro

### O cliente precisa ter acesso ao Supabase?

Idealmente, sim.

Melhor modelo de entrega:

- o projeto fica na organizacao do cliente no Supabase
- o cliente vira dono da infraestrutura
- voce pode continuar como colaborador tecnico, se precisar

Se o projeto ficar so na sua conta, so voce controla o dashboard e a operacao fica centralizada em voce.

### Quando usar Free e quando usar Pro

Use Free quando:

- for MVP
- for demonstracao
- for teste interno

Use Pro quando:

- for cliente real
- o sistema nao pode pausar
- voce quer operacao mais estavel e responsabilidade melhor definida

## Sobre WhatsApp

Hoje o projeto nao envia confirmacao automatica por WhatsApp.

Para isso, sera preciso integrar depois com:

- WhatsApp Cloud API da Meta
- ou provedor/BSP que entregue esse envio

Enquanto isso, o projeto ja mostra confirmacao no proprio fluxo do site e na pagina de "meus agendamentos".

## Checklist de entrega

- trocar a senha do admin
- revisar URL e chave do Supabase
- confirmar se o projeto do Supabase esta na conta certa
- validar um agendamento completo
- validar um bloqueio de horario
- validar um bloqueio de periodo
- validar um bloqueio de dia inteiro
- validar exclusao no admin
- validar pagina "meus agendamentos"

## Fluxo recomendado para novas features

```powershell
git switch main
git pull
git switch -c nome-da-feature
```

Quando terminar:

```powershell
git add .
git commit -m "Mensagem"
git push -u origin nome-da-feature
```
