# 🚀 DEPLOYMENT GUIDE — Advanced Accounting Agency

Vodič kako da deploy-ujete vaš softver za **~5€/mjesec** sa **24/7 uptime**.

---

## 📋 Šta ćete dobiti

- ✅ Backend (FastAPI + LibreOffice) na **Railway** (~5€/mj)
- ✅ Frontend (React) na **Vercel** (BESPLATNO)
- ✅ MongoDB baza na **MongoDB Atlas** (BESPLATNO — 512MB)
- ✅ Pravi 24/7 server, ne "zaspi" nakon neaktivnosti
- ✅ Auto HTTPS sertifikat (SSL)
- ✅ Vlastiti domen ako želite (npr. `advanced-accounting.com`)

**Ukupno mjesečno: ~5€** (samo Railway, ostalo besplatno)

---

## 🎯 KORAK 1: Save to GitHub (5 minuta)

1. U Emergent-u kliknite vaš profil (gore desno)
2. **"Connect GitHub"** ako još niste
3. U chat input boxu kliknite **"Save to GitHub"** dugme
4. Odaberite naziv repoa: `advanced-accounting` ili šta želite
5. Kliknite **"PUSH TO GITHUB"**

✅ Vaš kompletan kod (backend + frontend + sve `.docx`/`.pdf` šabloni) je sada na GitHub-u.

---

## 🎯 KORAK 2: MongoDB Atlas — Baza podataka (10 min, BESPLATNO)

1. Idite na **https://www.mongodb.com/cloud/atlas/register**
2. Sign up sa Google ili email-om
3. **"Create a deployment"** → odaberite **M0 FREE** (512MB besplatno zauvijek)
4. Cloud provider: **AWS**, Region: **Frankfurt (eu-central-1)** (najbliže Crnoj Gori)
5. Kliknite **"Create Deployment"**
6. **Sigurnost — kreiranje korisnika:**
   - Username: `getuard`
   - Password: kliknite **"Autogenerate"** → **KOPIRAJTE ovaj password u Notes!**
7. **Network Access:** kliknite **"Add IP Address"** → **"Allow Access From Anywhere"** (0.0.0.0/0)
8. Kliknite **"Connect"** → **"Drivers"** → **Python 3.6 or later**
9. **KOPIRAJTE connection string** (izgleda otprilike):
   ```
   mongodb+srv://getuard:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
10. Zamijenite `<password>` sa vašim stvarnim password-om iz koraka 6

✅ Sada imate `MONGO_URL` koji će vam trebati za Railway.

---

## 🎯 KORAK 3: Railway — Backend (15 min, ~5€/mj)

### Setup naloga
1. Idite na **https://railway.app**
2. **"Login with GitHub"** — autorizujte Railway na vašem GitHub nalogu
3. Aktivirajte **Hobby Plan ($5/mjesec)** — dobijate **$5 free credit** za korištenje
   - Idite na **Account Settings** → **Plans** → **Upgrade to Hobby**

### Deploy aplikacije
1. **"New Project"** → **"Deploy from GitHub repo"**
2. Odaberite vaš repo `advanced-accounting`
3. Railway će automatski detektovati Dockerfile (već sam vam ga pripremio u `/backend/Dockerfile`)
4. **VAŽNO:** Otvorite Settings:
   - **Root Directory:** `backend`
   - **Build Command:** (ostavite prazno — Dockerfile rješava)

### Environment varijable
Kliknite tab **"Variables"** i dodajte:

```
MONGO_URL=mongodb+srv://getuard:VASPASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
DB_NAME=advanced_accounting
JWT_SECRET=RANDOM-STRING-OD-NAJMANJE-64-KARAKTERA-PROMIJENI-OVO
CORS_ORIGINS=https://YOUR-FRONTEND.vercel.app
```

💡 **JWT_SECRET** generišite na: https://www.random.org/strings/ (64 chars, alphanumeric)

### Trajno skladište (Volume)
1. U Railway dashboard-u: **"+ New"** → **"Volume"**
2. Mount path: `/app/generated`
3. Veličina: **1GB** (dovoljno za hiljade dokumenata)
4. **Attach** na vaš backend service

### Generate Public Domain
1. Idite na **Settings** → **Networking** → **"Generate Domain"**
2. Dobićete URL: `https://advanced-accounting-production.up.railway.app`
3. **KOPIRAJTE ovaj URL** — trebaće vam za frontend

✅ Backend je live 24/7!

Test: otvorite `https://advanced-accounting-production.up.railway.app/api/health` u browser-u, treba da vidite `{"status": "ok", "db": "connected"}`

---

## 🎯 KORAK 4: Vercel — Frontend (5 min, BESPLATNO)

1. Idite na **https://vercel.com**
2. **"Sign Up"** sa GitHub
3. **"Add New..."** → **"Project"**
4. Importujte vaš `advanced-accounting` repo
5. **Configuration:**
   - **Framework Preset:** Create React App
   - **Root Directory:** `frontend`
   - **Build Command:** `yarn build` (auto-detected)
   - **Output Directory:** `build`
6. **Environment Variables:** dodajte
   ```
   REACT_APP_BACKEND_URL=https://advanced-accounting-production.up.railway.app
   ```
   (URL iz Railway koraka 3)
7. **"Deploy"**

✅ Frontend je live!

Dobićete URL: `https://advanced-accounting-xyz.vercel.app`

---

## 🎯 KORAK 5: Ažuriraj CORS u Railway

1. Vratite se na Railway → vaš backend → **Variables**
2. Promijenite:
   ```
   CORS_ORIGINS=https://advanced-accounting-xyz.vercel.app
   ```
3. Railway će automatski restartovati backend
4. Testirajte login na vašem Vercel URL-u

---

## 🎯 KORAK 6: Migracija postojećih podataka (opciono)

Ako želite prebaciti firme/zaposlene iz Emergent baze u Atlas:

1. U Emergent terminalu pokrenite:
   ```bash
   mongodump --uri="$MONGO_URL" --out=/tmp/backup
   ```
2. Restore u Atlas:
   ```bash
   mongorestore --uri="mongodb+srv://getuard:PASS@cluster.mongodb.net/" /tmp/backup
   ```

Ili samo počnite ispočetka — kreirajte master korisnika i unesite firme ponovo (sve je brzo zbog IRMS auto-fetch).

---

## 🌐 KORAK 7 (Opciono): Vlastiti domen

Ako kupite domen (npr. **advanced-accounting.me** ~10€/godina na **GoDaddy** ili **Namecheap**):

1. U Vercel: **Settings** → **Domains** → **Add Domain**
2. Slijedite uputstvo za DNS CNAME zapise
3. SSL sertifikat se automatski generiše

✅ Vaš softver je na `https://advanced-accounting.me` — profesionalno!

---

## 💰 Mjesečni troškovi - rezime

| Servis | Cijena/mj | Šta dobijate |
|---|---|---|
| **Railway Hobby** | $5 | Backend 24/7 + 1GB skladište + 8GB RAM |
| **Vercel** | $0 | Frontend + auto-SSL + CDN |
| **MongoDB Atlas M0** | $0 | 512MB baza + auto-backup |
| **Domen (opciono)** | ~1€ | Vlastiti URL |
| **UKUPNO** | **~5€** | Kompletan SaaS 24/7 |

---

## 🆘 Kada nešto pukne / treba novu funkciju

1. Vratite se ovdje u Emergent
2. Recite mi šta treba dodati ili popraviti
3. Ja menjam kod
4. Kliknete **"Save to GitHub"** dugme u Emergent-u
5. Railway i Vercel **automatski** primjećuju izmjene u GitHub-u i deploy-uju nove verzije za 2-3 min
6. Vaš live softver se ažurira **bez prekida rada**

🎉 To je to — najjeftinija i najpouzdanija setup-a za vaš tip aplikacije.

---

## 🐛 Troubleshooting

**Backend ne radi?**
- Provjerite Railway logs (Deployments → View Logs)
- Najčešći problem: pogrešan `MONGO_URL` (vjerovatno niste zamijenili `<password>`)

**Login ne radi?**
- Provjerite da li je `CORS_ORIGINS` postavljen na pravi Vercel URL
- Provjerite da li je `REACT_APP_BACKEND_URL` u Vercel-u tačan Railway URL

**LibreOffice greška?**
- Pogledajte logs — možda treba `apt-get install libreoffice-writer` (već je u Dockerfile-u)

**Generisani dokumenti se gube?**
- Provjerite da li je Railway **Volume** montiran na `/app/generated` (Settings → Volumes)
