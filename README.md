# Meva hisob-kitobi — fruit truck calculator

Enter what each truck brought (fruit, number of boxes, price per box in **yuan**) plus truck expenses, and see the cost in **¥ → $ → so'm**, including the cost of one box with expenses. Exchange rates come from the Central Bank of Uzbekistan (cbu.uz) and refresh every day. The interface is in Uzbek, Latin or Cyrillic.

Stack: Next.js 16, Supabase (login + database), Vercel (hosting + daily cron).

## 1. Supabase setup (once)

1. Create a free project at https://supabase.com.
2. **SQL Editor → New query**: paste the whole of [supabase/schema.sql](supabase/schema.sql) and click **Run**.
3. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up", so strangers cannot create accounts.
4. **Authentication → Users → Add user → Create new user**: enter your father's email and a password, and tick **Auto Confirm User**. Add more users the same way if needed. All users see the same trucks.
5. **Project Settings → API Keys**: copy the project URL, the publishable key and the secret key.

## 2. Run on your computer

```bash
cp .env.example .env.local   # then fill in the four values
npm install
npm run dev
```

Open http://localhost:3000 and log in.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. At https://vercel.com → **Add New → Project** → import the repository.
3. Under **Environment Variables**, add the same four values as `.env.local`.
4. Deploy. The cron job in [vercel.json](vercel.json) calls `/api/rates/refresh` every day at 09:00 Tashkent time. Rates are also refreshed when someone opens the site if they are more than 6 hours old.

## Updating an existing database

If you ran `schema.sql` before a feature was added, run the matching file from [supabase/migrations/](supabase/migrations/) in the SQL Editor once:

- [002_archive.sql](supabase/migrations/002_archive.sql) — archive for trucks (Settings → Ma'lumotlar).

## Settings page (⚙️ Sozlamalar)

- **Ko'rinish:** theme colour, light/dark/auto mode, font size, language. Saved per device (phone and computer can differ).
- **Hisob-kitob:** which currency the expenses field starts with.
- **Ma'lumotlar:** tick trucks to archive, restore or delete; download everything as a CSV that opens in Excel.
- **Hisob:** change password, log out.

## How the numbers are calculated

- Fruit row: `boxes × price per box (¥)` → ÷ (¥ per $) → × (so'm per $).
- Expenses are entered in ¥, $ or so'm and converted the same way.
- **Cost of 1 box** = fruit price per box + (all expenses ÷ total boxes in the truck).
- Each saved truck keeps the rate it was saved with, so old trucks don't change when the rate changes. Open a truck and press "Bugungi kursni qo'yish" to switch it to today's rate.
- Rates can be typed by hand (for example, the market rate instead of the bank rate).
# Currency
