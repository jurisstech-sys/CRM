# Variáveis de Ambiente para Vercel

Cadastre as seguintes variáveis no Vercel (Settings → Environment Variables):

## 1. NEXT_PUBLIC_SUPABASE_URL
```
https://krmbhkmgifiwvzhcvivj.supabase.co
```

## 2. NEXT_PUBLIC_SUPABASE_ANON_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtybWJoa21naWZpd3d6aGN2aXZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTA5NzQsImV4cCI6MjA5MDg4Njk3NH0.SvaoFww4A_LxQtVCC4ET8T9tixQjjXJbGEFGJwTXI8A
```

## 3. SUPABASE_SERVICE_ROLE_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtybWJoa21naWZpd3d6aGN2aXZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTMxMDk3NCwiZXhwIjoyMDkwODg2OTc0fQ.dFRwb8UzqiH1XeiiUhYFM99nNZodj93sbPVryxOC6KE
```

## 4. DATABASE_URL
```
postgresql://postgres.krmbhkmgifiwvzhcvivj:JurisCrm@12@aws-1-us-east-2.pooler.supabase.com:6543/postgres
```

---

### Como cadastrar no Vercel:

1. Acesse o **Vercel Dashboard**: https://vercel.com/dashboard
2. Clique no seu projeto **jurisla_crm**
3. Vá para **Settings** (Configurações)
4. Clique em **Environment Variables**
5. Para cada variável acima:
   - Clique em **Add New**
   - Cole o **nome da variável** (ex: NEXT_PUBLIC_SUPABASE_URL)
   - Cole o **valor** correspondente
   - Selecione os **ambientes**: Production, Preview, Development
   - Clique em **Save**
6. Redeploy a aplicação

### Observações importantes:
- **NEXT_PUBLIC_*** são públicas (expostas no navegador)
- **SUPABASE_SERVICE_ROLE_KEY** e **DATABASE_URL** são secretas (não exponha)
- Após adicionar as variáveis, você precisa fazer um **redeploy** no Vercel
